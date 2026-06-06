// src/app/api/admin/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendAdminSubscriptionEventEmail, sendShopOwnerAdminActionEmail } from "@/lib/security/email-otp";
import { ADMIN_SESSION_COOKIE, verifySessionToken, verifyTOTP } from "@/lib/admin/auth";
import { validate, schemas } from "@/lib/validation";
import { sbGet, sbPatch, sbPost, sbUpsertByShopId } from "@/lib/supabase/service";
import { subscriptionExpiresAt } from "@/lib/billing/cycles";
import { logger } from '@/lib/logger';

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

  // ── TOTP 2FA for destructive actions ─────────────────────────
  const DESTRUCTIVE_ACTIONS = ['delete_shop', 'deactivate_shop', 'activate_shop', 'set_plan', 'reject_payment']
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

        const expiresAt = subscriptionExpiresAt(cycle);

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
        });
        notifyOwner(shopId, "activate_subscription", "Subscription Payment Approved", `Your ${planId} subscription payment has been approved.`, [
          ["Plan", planId],
          ["Cycle", cycle],
          ["Amount", amountPkr ? `Rs. ${amountPkr}` : "N/A"],
          ["Expires At", expiresAt],
        ]);
        await sendAdminSubscriptionEventEmail({
          shopId,
          event: subscriptionEvent(previousSub?.plan, planId),
          previousPlan: previousSub?.plan ?? undefined,
          plan: planId,
          cycle,
          amountPkr,
          expiresAt,
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

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    logger.error('admin', 'Action API error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
