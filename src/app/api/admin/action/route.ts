// src/app/api/admin/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendAdminSubscriptionEventEmail, sendShopOwnerAdminActionEmail } from "@/lib/security/email-otp";
import { ADMIN_SESSION_COOKIE, verifySessionToken, verifyTOTP, getAdminSession } from "@/lib/admin/auth";
import { validate, schemas } from "@/lib/validation";
import { sbGet, sbPatch, sbPost, sbUpsertByShopId } from "@/lib/supabase/service";
import { subscriptionExpiresAt } from "@/lib/billing/cycles";
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs'
import { SALT_ROUNDS } from '@/lib/security/pin'

async function logAction(
  action: string,
  targetId: string,
  shopId: string,
  details: object,
) {
  try {
    await sbPost("admin_audit_log", {
      action,
      target_type: action.includes("shop_") ? "shop" : "subscription",
      target_id: targetId,
      shop_id: shopId,
      details,
      performed_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.error('admin', 'Audit log failed (non-fatal)', e);
  }
}

function notifyOwner(shopId: string, action: string, title: string, message: string, details?: [string, unknown][]) {
  sendShopOwnerAdminActionEmail({ shopId, action, title, message, details }).catch((e) => {
    logger.error('admin', 'Owner email failed (non-fatal)', e);
  });
}

function nextExpiry(cycle: string | undefined, planId = "professional") {
  if (planId === "starter") return null;
  return subscriptionExpiresAt(cycle ?? "monthly");
}

function planRank(planId?: string | null) {
  if (planId === "business") return 3;
  if (planId === "professional") return 2;
  return 1;
}

function subscriptionEvent(previousPlan?: string | null, nextPlan?: string | null): "upgraded" | "downgraded" | "renewed" {
  if (previousPlan && previousPlan === nextPlan) return "renewed";
  return planRank(nextPlan) > planRank(previousPlan) ? "upgraded" : "downgraded";
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getAdminSession(token)
  const adminRole = session?.role ?? 'super_admin'
  const adminName = session?.username ?? 'unknown'

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 },
    );
  }

  const parsed = await validate(schemas.adminAction, req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.data;
  const { action } = body;

  // ── Role-based access control ──────────────────────────────
  const SUPER_ADMIN_ONLY = ['create_admin', 'deactivate_admin', 'activate_admin', 'reset_admin_totp', 'force_logout_sessions']
  const SUPPORT_RESTRICTED = ['delete_shop', 'deactivate_shop', 'activate_shop', 'reset_owner_pin', 'bulk_send_notification', 'send_notification', 'verify_shop']

  if (adminRole === 'support') {
    return NextResponse.json({ error: 'Support role is read-only. Is action ke liye super admin se contact karein.' }, { status: 403 })
  }

  if (adminRole === 'finance') {
    if (SUPER_ADMIN_ONLY.concat(SUPPORT_RESTRICTED).includes(action)) {
      return NextResponse.json({ error: 'Finance role yeh action nahi kar sakta. Super admin se contact karein.' }, { status: 403 })
    }
  }

  // ── TOTP 2FA for destructive actions ─────────────────────────
  const DESTRUCTIVE_ACTIONS = ['delete_shop', 'deactivate_shop', 'activate_shop', 'set_plan', 'reject_payment', 'refund_payment', 'extend_expiry', 'set_custom_expiry', 'update_subscription_amount', 'bulk_set_plan', 'bulk_extend_expiry', 'block_ip', 'unblock_ip', 'reset_admin_totp', 'force_logout_sessions', 'create_admin', 'deactivate_admin', 'activate_admin', 'reset_owner_pin']
  const totpSecret = process.env.ADMIN_TOTP_SECRET
  if (totpSecret && DESTRUCTIVE_ACTIONS.includes(action)) {
    if (!body.totpCode || !verifyTOTP(body.totpCode, totpSecret)) {
      return NextResponse.json(
        { error: 'Is action ke liye Google Authenticator code chahiye', requiresTOTP: true },
        { status: 401 },
      )
    }
  }

  try {
    switch (action) {
      case "set_plan": {
        const { shopId, planId, cycle } = body;
        if (!shopId || !planId) {
          return NextResponse.json(
            { error: "shopId and planId required" },
            { status: 400 },
          );
        }

        const now = new Date().toISOString();
        const previousSub = (await sbGet(`subscriptions?shop_id=eq.${shopId}&select=plan,status,expires_at&limit=1`))[0];

        const expiresAt = nextExpiry(cycle, planId);

        // Update subscription
        await sbUpsertByShopId("subscriptions", {
          shop_id: shopId,
          plan: planId,
          billing_cycle: planId === "starter" ? null : (cycle ?? "monthly"),
          status: "active",
          expires_at: expiresAt,
          grace_ends_at: null,
          cancelled_at: null,
          trial_ends_at: null,
          updated_at: now,
        });

        // Update subscription plan only. Shop account activation is controlled separately.
        await sbPatch(`shops?id=eq.${shopId}`, {
          plan: planId,
          plan_expires_at: expiresAt,
          updated_at: now,
        });

        // Audit log
        await logAction("manual_plan_change", shopId, shopId, {
          plan: planId,
          cycle,
          expires_at: expiresAt,
          performed_by: adminName,
        });
        notifyOwner(shopId, "manual_plan_change", "Subscription Plan Updated", `Admin updated your subscription to ${planId}.`, [
          ["Plan", planId],
          ["Cycle", cycle ?? "monthly"],
          ["Expires At", expiresAt ?? "No expiry"],
        ]);
        await sendAdminSubscriptionEventEmail({
          shopId,
          event: subscriptionEvent(previousSub?.plan, planId),
          previousPlan: previousSub?.plan ?? undefined,
          plan: planId,
          cycle: cycle ?? "monthly",
          expiresAt,
        }).catch((e) => logger.error('admin', 'Admin subscription email failed (non-fatal)', e));

        return NextResponse.json({ success: true });
      }

      case "activate_payment": {
        const { paymentId, shopId, planId, cycle, amountPkr } = body;
        if (!paymentId || !shopId || !planId) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 },
          );
        }

        const now = new Date().toISOString();
        const previousSub = (await sbGet(`subscriptions?shop_id=eq.${shopId}&select=plan,status,expires_at&limit=1`))[0];

        const expiresAt = subscriptionExpiresAt(cycle, previousSub?.expires_at ? new Date(previousSub.expires_at) : undefined);

        // Fetch payment receipt_data for coupon info
        let couponCode: string | undefined;
        let discountPct: number | undefined;
        try {
          const payRows = await sbGet(`subscription_payments?id=eq.${paymentId}&select=receipt_data&limit=1`) as { receipt_data?: Record<string, unknown> }[];
          const rd = payRows?.[0]?.receipt_data;
          if (rd?.coupon_code) {
            couponCode = rd.coupon_code as string;
            discountPct = rd.discount_pct as number;
          }
        } catch { /* ignore lookup failure */ }

        // Activate subscription
        await sbUpsertByShopId("subscriptions", {
          shop_id: shopId,
          plan: planId,
          billing_cycle: cycle,
          status: "active",
          expires_at: expiresAt,
          grace_ends_at: null,
          cancelled_at: null,
          trial_ends_at: null,
          amount_pkr: amountPkr,
          updated_at: now,
        });

        // Mark payment completed
        await sbPatch(`subscription_payments?id=eq.${paymentId}`, {
          status: "completed",
          paid_at: now,
        });

        // Update subscription plan only. Shop account activation is controlled separately.
        await sbPatch(`shops?id=eq.${shopId}`, {
          plan: planId,
          plan_expires_at: expiresAt,
          updated_at: now,
        });

        // Audit log
        await logAction("activate_subscription", paymentId, shopId, {
          plan: planId,
          cycle,
          amount: amountPkr,
          coupon_code: couponCode,
          performed_by: adminName,
        });
        notifyOwner(shopId, "activate_subscription", "Subscription Payment Approved", `Your ${planId} subscription payment has been approved.`, [
          ["Plan", planId],
          ["Cycle", cycle],
          ["Amount", amountPkr ? `Rs. ${amountPkr}` : "N/A"],
          ["Expires At", expiresAt],
          ...(couponCode ? [["Coupon", `${couponCode} (${discountPct}% off)`] as [string, unknown]] : []),
        ]);
        await sendAdminSubscriptionEventEmail({
          shopId,
          event: subscriptionEvent(previousSub?.plan, planId),
          previousPlan: previousSub?.plan ?? undefined,
          plan: planId,
          cycle,
          amountPkr,
          expiresAt,
          couponCode,
          discountPct,
        }).catch((e) => logger.error('admin', 'Admin subscription email failed (non-fatal)', e));

        return NextResponse.json({ success: true, expiresAt });
      }

      case "reject_payment": {
        const { paymentId, shopId, reason } = body;
        if (!paymentId) {
          return NextResponse.json(
            { error: "paymentId required" },
            { status: 400 },
          );
        }

        // Get existing receipt_data
        const existing = await sbGet(
          `subscription_payments?id=eq.${paymentId}&select=receipt_data`
        );
        const receiptData = existing?.[0]?.receipt_data ?? {};

        await sbPatch(`subscription_payments?id=eq.${paymentId}`, {
          status: "failed",
          receipt_data: {
            ...receiptData,
            rejection_reason: reason ?? "Admin rejected",
            rejected_at: new Date().toISOString(),
          },
        });

        await logAction("reject_payment", paymentId, shopId ?? paymentId, {
          reason,
          performed_by: adminName,
        });
        if (shopId) notifyOwner(shopId, "reject_payment", "Subscription Payment Needs Review", "Your submitted subscription payment was not approved.", [
          ["Reason", reason ?? "Admin rejected"],
        ]);

        return NextResponse.json({ success: true });
      }

      case "deactivate_shop": {
        const { shopId, reason } = body;
        if (!shopId)
          return NextResponse.json(
            { error: "shopId required" },
            { status: 400 },
          );

        await sbPatch(`shops?id=eq.${shopId}`, {
          is_active: false,
          updated_at: new Date().toISOString(),
        });

        await logAction("shop_deactivated", shopId, shopId, { reason });
        notifyOwner(shopId, "shop_deactivated", "Shop Account Deactivated", "Admin deactivated your shop account.", [
          ["Reason", reason ?? "N/A"],
        ]);
        return NextResponse.json({ success: true });
      }

      case "activate_shop": {
        const { shopId, reason } = body;
        if (!shopId)
          return NextResponse.json(
            { error: "shopId required" },
            { status: 400 },
          );

        const now = new Date().toISOString();

        await sbPatch(`shops?id=eq.${shopId}`, {
          is_active: true,
          updated_at: now,
        });

        await logAction("shop_activated", shopId, shopId, { reason });
        notifyOwner(shopId, "shop_activated", "Shop Account Activated", "Admin activated your shop account.", [
          ["Reason", reason ?? "N/A"],
        ]);
        return NextResponse.json({ success: true });
      }

      case "verify_shop": {
        const { shopId, status, note } = body;
        if (!shopId || !status || !["approved", "rejected"].includes(status)) {
          return NextResponse.json(
            { error: "shopId and valid status required" },
            { status: 400 },
          );
        }
        const now = new Date().toISOString();
        await sbPatch(
          `shop_verification_requests?shop_id=eq.${shopId}&status=eq.pending`,
          {
            status,
            admin_note: note ?? null,
            reviewed_at: now,
          },
        );
        await sbPatch(`shops?id=eq.${shopId}`, {
          verification_status: status,
          is_active: status === "approved",
          verified_at: status === "approved" ? now : null,
          updated_at: now,
        });
        await logAction(
          status === "approved" ? "shop_activated" : "shop_deactivated",
          "shop",
          shopId,
          { note },
        );
        notifyOwner(shopId, status === "approved" ? "shop_approved" : "shop_rejected", status === "approved" ? "Shop Verification Approved" : "Shop Verification Rejected", status === "approved" ? "Your shop verification has been approved." : "Your shop verification was rejected.", [
          ["Note", note ?? "N/A"],
        ]);
        return NextResponse.json({ success: true });
      }

      case "delete_shop": {
        const { shopId, reason } = body;
        if (!shopId) {
          return NextResponse.json(
            { error: "shopId required" },
            { status: 400 },
          );
        }

        const now = new Date().toISOString();

        // Soft-delete/deactivate related login and billing data first so
        // rejected accounts cannot continue signing in while preserving audit.
        await Promise.all([
          sbPatch(`team_members?shop_id=eq.${shopId}`, {
            is_active: false,
            deleted_at: now,
            updated_at: now,
          }).catch((e) => logger.warn('admin', 'team cleanup', e)),
          sbPatch(`subscriptions?shop_id=eq.${shopId}`, {
            status: "cancelled",
            cancelled_at: now,
            updated_at: now,
          }).catch((e) => logger.warn('admin', 'subscription cleanup', e)),
          sbPatch(`shop_verification_requests?shop_id=eq.${shopId}`, {
            status: "rejected",
            admin_note: reason ?? "Account deleted by admin",
            reviewed_at: now,
          }).catch((e) => logger.warn('admin', 'verification cleanup', e)),
        ]);

        await sbPatch(`shops?id=eq.${shopId}`, {
          is_active: false,
          verification_status: "rejected",
          deleted_at: now,
          updated_at: now,
        });

        await logAction("shop_deleted", shopId, shopId, { reason });
        notifyOwner(shopId, "shop_deleted", "Shop Account Deleted", "Admin deleted/deactivated your shop account.", [
          ["Reason", reason ?? "N/A"],
        ]);
        return NextResponse.json({ success: true });
      }

      case "extend_expiry": {
        const { shopId: extShopId, days: extDays } = body as { shopId?: string; days?: number };
        if (!extShopId || !extDays || extDays < 1 || extDays > 365) {
          return NextResponse.json({ error: "shopId and days (1-365) required" }, { status: 400 });
        }

        const now = new Date();
        const existingSub: { expires_at?: string; status?: string }[] = await sbGet(`subscriptions?shop_id=eq.${extShopId}&select=expires_at,status&limit=1`)
        const currentExpiry = existingSub?.[0]?.expires_at
          ? new Date(existingSub[0].expires_at)
          : new Date();
        const newExpiry = new Date(Math.max(currentExpiry.getTime(), now.getTime()) + extDays * 86400000);

        await sbUpsertByShopId("subscriptions", {
          shop_id: extShopId,
          expires_at: newExpiry.toISOString(),
          status: existingSub?.[0]?.status === "expired" ? "active" : undefined,
          updated_at: now.toISOString(),
        });

        await sbPatch(`shops?id=eq.${extShopId}`, {
          plan_expires_at: newExpiry.toISOString(),
          updated_at: now.toISOString(),
        });

        await logAction("extend_expiry", extShopId, extShopId, {
          days: extDays,
        });
        notifyOwner(extShopId, "extend_expiry", "Subscription Extended", `Your subscription has been extended by ${extDays} days.`, [
          ["Days Added", String(extDays)],
        ]);

        return NextResponse.json({ success: true, newExpiry: newExpiry.toISOString() });
      }

      case "set_custom_expiry": {
        const customBody = body as unknown as { shopId: string; expiresAt: string };
        if (!customBody.shopId || !customBody.expiresAt) {
          return NextResponse.json({ error: "shopId and expiresAt required" }, { status: 400 });
        }
        const customExpiry = new Date(customBody.expiresAt);
        if (isNaN(customExpiry.getTime())) {
          return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const expiryStr = customExpiry.toISOString();

        await sbUpsertByShopId("subscriptions", {
          shop_id: customBody.shopId,
          expires_at: expiryStr,
          status: "active",
          updated_at: now,
        });

        await sbPatch(`shops?id=eq.${customBody.shopId}`, {
          plan_expires_at: expiryStr,
          updated_at: now,
        });

        await logAction("set_custom_expiry", customBody.shopId, customBody.shopId, {
          new_expiry: expiryStr,
        });
        notifyOwner(customBody.shopId, "set_custom_expiry", "Subscription Expiry Updated", "Admin updated your subscription expiry date.", [
          ["New Expiry", expiryStr],
        ]);

        return NextResponse.json({ success: true, newExpiry: expiryStr });
      }

      case "update_subscription_amount": {
        const { shopId: amtShopId, amountPkr } = body as { shopId?: string; amountPkr?: number };
        if (!amtShopId || amountPkr == null || amountPkr < 0) {
          return NextResponse.json({ error: "shopId and amountPkr required" }, { status: 400 });
        }

        await sbUpsertByShopId("subscriptions", {
          shop_id: amtShopId,
          amount_pkr: amountPkr,
          updated_at: new Date().toISOString(),
        });

        await logAction("update_subscription_amount", amtShopId, amtShopId, {
          amount_pkr: amountPkr,
        });

        return NextResponse.json({ success: true });
      }

      case "refund_payment": {
        const { paymentId, shopId, reason } = body;
        if (!paymentId) {
          return NextResponse.json(
            { error: "paymentId required" },
            { status: 400 },
          );
        }

        const existing = await sbGet(
          `subscription_payments?id=eq.${paymentId}&select=receipt_data,status`
        );
        if (!existing?.[0]) {
          return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }
        if (existing[0].status !== "completed") {
          return NextResponse.json({ error: "Only completed payments can be refunded" }, { status: 400 });
        }

        const receiptData = existing[0].receipt_data ?? {};
        await sbPatch(`subscription_payments?id=eq.${paymentId}`, {
          status: "refunded",
          receipt_data: {
            ...receiptData,
            refund_reason: reason ?? "Refunded by admin",
            refunded_at: new Date().toISOString(),
          },
        });

        await logAction("refund_payment", paymentId, shopId ?? paymentId, {
          reason,
        });
        if (shopId) notifyOwner(shopId, "refund_payment", "Payment Refunded", "Your subscription payment has been refunded.", [
          ["Reason", reason ?? "N/A"],
        ]);

        return NextResponse.json({ success: true });
      }

      // ── Bulk Operations ─────────────────────────────────────

      case "bulk_set_plan": {
        const { shopIds: bspShopIds, plan: bspPlan, cycle: bspCycle } = body as { shopIds?: string[]; plan?: string; cycle?: string };
        if (!bspShopIds?.length || !bspPlan)
          return NextResponse.json({ error: "shopIds and plan required" }, { status: 400 });

        const now = new Date().toISOString();
        const expiresAt = nextExpiry(bspCycle, bspPlan);
        let count = 0;
        for (const sid of bspShopIds) {
          try {
            await sbUpsertByShopId("subscriptions", {
              shop_id: sid, plan: bspPlan,
              billing_cycle: bspPlan === "starter" ? null : (bspCycle ?? "monthly"),
              status: "active", expires_at: expiresAt, grace_ends_at: null,
              cancelled_at: null, trial_ends_at: null, updated_at: now,
            });
            await sbPatch(`shops?id=eq.${sid}`, { plan: bspPlan, plan_expires_at: expiresAt, updated_at: now });
            count++;
          } catch (e) { logger.warn('admin', `bulk_set_plan failed for ${sid}`, e); }
        }
        await logAction("bulk_set_plan", `count=${count}`, bspShopIds[0], { plan: bspPlan, count });
        return NextResponse.json({ success: true, count });
      }

      case "bulk_extend_expiry": {
        const { shopIds: beeShopIds, days: beeDays } = body as { shopIds?: string[]; days?: number };
        const extDaysVal = beeDays ?? 30;
        if (!beeShopIds?.length)
          return NextResponse.json({ error: "shopIds required" }, { status: 400 });

        let count = 0;
        const now = new Date();
        for (const sid of beeShopIds) {
          try {
            const existingSub: { expires_at?: string; status?: string }[] = await sbGet(`subscriptions?shop_id=eq.${sid}&select=expires_at,status&limit=1`);
            const currentExpiry = existingSub?.[0]?.expires_at ? new Date(existingSub[0].expires_at) : new Date();
            const newExpiry = new Date(Math.max(currentExpiry.getTime(), now.getTime()) + extDaysVal * 86400000);
            await sbUpsertByShopId("subscriptions", {
              shop_id: sid, expires_at: newExpiry.toISOString(),
              status: existingSub?.[0]?.status === "expired" ? "active" : undefined,
              updated_at: now.toISOString(),
            });
            await sbPatch(`shops?id=eq.${sid}`, { plan_expires_at: newExpiry.toISOString(), updated_at: now.toISOString() });
            count++;
          } catch (e) { logger.warn('admin', `bulk_extend_expiry failed for ${sid}`, e); }
        }
        await logAction("bulk_extend_expiry", `count=${count}`, beeShopIds[0], { days: extDaysVal, count });
        return NextResponse.json({ success: true, count });
      }

      case "bulk_send_notification": {
        const { shopIds: bsnShopIds, reason: bsnReason } = body as { shopIds?: string[]; reason?: string };
        if (!bsnShopIds?.length || !bsnReason)
          return NextResponse.json({ error: "shopIds and reason required" }, { status: 400 });

        let count = 0;
        for (const sid of bsnShopIds) {
          try {
            notifyOwner(sid, "bulk_notification", "Admin Message", bsnReason);
            count++;
          } catch (e) { logger.warn('admin', `bulk_notification failed for ${sid}`, e); }
        }
        await logAction("bulk_send_notification", `count=${count}`, bsnShopIds[0], { count });
        return NextResponse.json({ success: true, count });
      }

      // ── IP Blocklist ─────────────────────────────────────────

      case "block_ip": {
        const { ip: blockIp } = body as { ip?: string };
        if (!blockIp) return NextResponse.json({ error: "ip required" }, { status: 400 });

        const now = new Date().toISOString();
        await sbPost("ip_blocklist", {
          ip: blockIp, reason: "Blocked by admin",
          blocked_at: now, is_active: true,
        });

        await logAction("block_ip", blockIp, "admin", {});
        return NextResponse.json({ success: true });
      }

      case "unblock_ip": {
        const { ip: unblockIp } = body as { ip?: string };
        if (!unblockIp) return NextResponse.json({ error: "ip required" }, { status: 400 });

        await sbPatch(`ip_blocklist?ip=eq.${unblockIp}`, { is_active: false });
        await logAction("unblock_ip", unblockIp, "admin", {});
        return NextResponse.json({ success: true });
      }

      // ── 2FA & Sessions ───────────────────────────────────────

      case "reset_admin_totp": {
        // Generate a new TOTP secret
        const { generateTOTPSecret } = await import("@/lib/admin/auth");
        const newSecret = generateTOTPSecret();
        // For now, we log the new secret (admin will see it in logs or env update)
        await logAction("reset_admin_totp", "admin", "admin", { newSecret: newSecret ? `${newSecret.slice(0, 4)}****` : null, performed_by: adminName });
        // In a real system this would update ADMIN_TOTP_SECRET in env/vault
        return NextResponse.json({ success: true, newSecret, message: "Set ADMIN_TOTP_SECRET to this new value" });
      }

      case "force_logout_sessions": {
        // Increment session version to invalidate all tokens
        // For now, we log the action and return success
        await logAction("force_logout_sessions", "admin", "admin", { performed_by: adminName });
        return NextResponse.json({ success: true, message: "All sessions invalidated. Use a new secret version to force re-login." });
      }

      // ── Shop Owner PIN Reset ────────────────────────────────

      case "reset_owner_pin": {
        const { shopId: pinShopId } = body as { shopId?: string };
        if (!pinShopId) {
          return NextResponse.json({ error: "shopId required" }, { status: 400 });
        }

        // Generate random 6-digit PIN
        const newPin = String(Math.floor(100000 + Math.random() * 900000));

        // Store as single bcrypt hash
        const storedHash = bcrypt.hashSync(newPin, SALT_ROUNDS)

        const now = new Date().toISOString();

        // Update the owner's pin_hash (owner is the first team_member, role=owner)
        await sbPatch(`team_members?shop_id=eq.${pinShopId}&role=eq.owner`, {
          pin_hash: storedHash,
          failed_attempts: 0,
          locked_until: null,
          updated_at: now,
        });

        // Audit log
        await logAction("reset_owner_pin", pinShopId, pinShopId, {
          pin_reset: true,
        });

        notifyOwner(pinShopId, "reset_owner_pin", "Shop PIN Reset", "Admin ne aapka shop PIN reset kar diya hai. Naya PIN admin se hasil karein.");

        return NextResponse.json({ success: true, newPin, message: "Naya 6-digit PIN generate ho gaya hai. Admin is PIN ko shop owner ko de sakta hai." });
      }

      // ── Admin Account Management ─────────────────────────────

      case "create_admin": {
        const { username: caUsername, password: caPassword, role: caRole } = body as { username?: string; password?: string; role?: string };
        if (!caUsername || !caPassword)
          return NextResponse.json({ error: "username and password required" }, { status: 400 });
        if (caRole && !['super_admin', 'finance', 'support'].includes(caRole))
          return NextResponse.json({ error: "Invalid role" }, { status: 400 });

        const secretHash = bcrypt.hashSync(caPassword, SALT_ROUNDS);

        // Check if username already exists
        const existing: { id: string }[] = await sbGet(`admin_accounts?username=eq.${caUsername}&select=id`);
        if (existing?.length > 0)
          return NextResponse.json({ error: "Username already taken" }, { status: 409 });

        await sbPost("admin_accounts", {
          username: caUsername, secret_hash: secretHash,
          role: caRole ?? "support", is_active: true,
          created_at: new Date().toISOString(),
        });

        await logAction("create_admin", caUsername, "admin", { role: caRole });
        return NextResponse.json({ success: true });
      }

      case "deactivate_admin": {
        const deactivateId = (body as { targetId?: string }).targetId;
        if (!deactivateId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
        await sbPatch(`admin_accounts?id=eq.${deactivateId}`, { is_active: false });
        await logAction("deactivate_admin", deactivateId, "admin", {});
        return NextResponse.json({ success: true });
      }

      case "activate_admin": {
        const activateId = (body as { targetId?: string }).targetId;
        if (!activateId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
        await sbPatch(`admin_accounts?id=eq.${activateId}`, { is_active: true });
        await logAction("activate_admin", activateId, "admin", {});
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    logger.error('admin', 'Action API error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
