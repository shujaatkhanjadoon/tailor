// src/app/orders/new/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { GarmentType, OrderRecipientRelation, PaymentMethod } from "@/types";
import { StepIndicator } from "@/components/orders/wizard/StepIndicator";
import { Step1Customer } from "@/components/orders/wizard/Step1Customer";
import { Step2Garment, formatStyleSelections, type StyleSelections } from "@/components/orders/wizard/Step2Garment";
import { Step3Confirm } from "@/components/orders/wizard/Step3Confirm";
import { useAuth } from "@/lib/auth/AuthContext";
import { orderOps, paymentOps, teamOps, uuid } from "@/lib/db/operations";
import type { TeamMemberRecord } from "@/lib/db/schema";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { AccessNotice } from "@/components/billing/AccessNotice";
import { getSelectableKarigarIds } from "@/lib/team/karigar-limits";
import { supabase } from "@/lib/supabase/client";
import { mapMeasurement } from "@/lib/supabase/records";
import { nowKarachiIso } from "@/lib/time";
import { isParentRelation } from "@/lib/order-recipient";
import { cloudinaryEnabled, uploadToCloudinary } from "@/lib/photos/cloudinary";

// ── Wizard data shape ────────────────────────────────────────────
interface WizardData {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerGender: "male" | "female" | "child";
  orderForRelation: OrderRecipientRelation;
  orderForName?: string;
  recipientGender: "male" | "female" | "child";
  garmentType: GarmentType;
  measurementId?: string;
  measurements: Record<string, string>;
  styleSelections: StyleSelections;
  specialInstructions: string;
  isUrgent: boolean;
  totalPrice: number;
  advancePaid: number;
  dueDate: string;
  paymentMethod: PaymentMethod;
  assignedTo?: string;
  assignedToName?: string;
  fabricPhotoBase64?: string;
}

const STEPS = ["Gahak Chunein", "Kapra & Nap", "Qeemat & Tarikh"];

const isRelationCheckError = (error: { message?: string } | null | undefined) =>
  !!error?.message?.includes("violates check constraint");

const measurementRelationForLegacyDb = (relation: OrderRecipientRelation) =>
  isParentRelation(relation) ? "other" : relation;

function isOrderRecipientRelation(value: unknown): value is OrderRecipientRelation {
  return typeof value === "string" && [
    "self", "wife", "husband", "son", "daughter", "brother", "sister", "father", "mother", "other",
  ].includes(value);
}

export default function NewOrderPage() {
  const { shopId, currentUser } = useAuth();
  const plan = usePlan();

  if (currentUser?.role === "karigar") {
    return (
      <AccessNotice
        icon="role"
        title="Owner access required"
        message="Naya order sirf owner create kar sakta hai. Karigar apne assigned orders dekh aur update kar sakte hain."
      />
    );
  }

  if (plan.isLoading) {
    return <div className="min-h-screen bg-white" />;
  }

  if (plan.isAtOrderLimit) {
    return (
      <AccessNotice
        title="Monthly order limit reached"
        message={`Starter plan mein ${plan.ordersLimit} orders per month allowed hain. Aur orders add karne ke liye Professional plan pe upgrade karein.`}
        requiredPlan="professional"
      />
    );
  }

  return <NewOrderWizard shopId={shopId} currentUser={currentUser} />;
}

function NewOrderWizard({
  shopId,
  currentUser,
}: {
  shopId: string | null
  currentUser: { id: string; role?: string } | null
}) {
  const router = useRouter();
  const plan = usePlan();
  const isSubmittingRef = useRef(false);

  // ── Page-level state ─────────────────────────────────────────
  // 'wizard' = the 3-step form, 'success' = order saved confirmation
  const [pageStep, setPageStep] = useState<"wizard" | "success">("wizard");
  const [wizardStep, setWizardStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string>("");
  const [savedOrderNo, setSavedOrderNo] = useState<number>(0);
  const [savedTrackingCode, setSavedTrackingCode] = useState("");
  const [karigars, setKarigars] = useState<TeamMemberRecord[]>([]);
  const relationDefaultedForCustomer = useRef<string | null>(null);

  // ── Form data ─────────────────────────────────────────────────
  const [data, setData] = useState<Partial<WizardData>>({
    paymentMethod: "cash",
    isUrgent: false,
    orderForRelation: "self",
    measurements: {},
  });

  const update = (updates: Partial<WizardData>) =>
    setData((prev) => ({ ...prev, ...updates }));

  useEffect(() => {
    if (!shopId) return;
    teamOps.getAll(shopId).then((all) => {
      setKarigars(
        all
          .filter((m) => m.role === "karigar")
          .sort((a, b) => {
            const joined = a.joinedAt.localeCompare(b.joinedAt);
            if (joined !== 0) return joined;
            return a.createdAt.localeCompare(b.createdAt);
          }),
      );
    });
  }, [shopId]);

  useEffect(() => {
    if (!data.customerId || relationDefaultedForCustomer.current === data.customerId) return;
    relationDefaultedForCustomer.current = data.customerId;

    let cancelled = false;
    const loadLatestRelation = async () => {
      const [orderRes, measurementRes] = await Promise.all([
        (supabase as any)
          .from("orders")
          .select("order_for_relation,order_for_name,recipient_gender,created_at")
          .eq("customer_id", data.customerId)
          .neq("order_for_relation", "self")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1),
        (supabase as any)
          .from("measurements")
          .select("order_for_relation,order_for_name,recipient_gender,taken_at")
          .eq("customer_id", data.customerId)
          .neq("order_for_relation", "self")
          .is("deleted_at", null)
          .order("taken_at", { ascending: false })
          .limit(1),
      ]);

      const candidates = [
        ...(orderRes.data ?? []).map((row: any) => ({ ...row, used_at: row.created_at })),
        ...(measurementRes.data ?? []).map((row: any) => ({ ...row, used_at: row.taken_at })),
      ].filter((row: any) => isOrderRecipientRelation(row.order_for_relation))
        .sort((a: any, b: any) => String(b.used_at ?? "").localeCompare(String(a.used_at ?? "")));

      const latest = candidates[0];
      if (!latest || cancelled) return;

      update({
        orderForName: latest.order_for_name?.trim() || undefined,
        recipientGender: latest.recipient_gender ?? data.customerGender,
        garmentType: undefined,
        measurementId: undefined,
        measurements: {},
        styleSelections: {},
      });
    };

    loadLatestRelation().catch(console.error);
    return () => { cancelled = true };
  }, [data.customerId, data.customerGender]);

  // ── Navigation ────────────────────────────────────────────────
  const handleBack = () => {
    if (wizardStep > 1) setWizardStep((s) => s - 1);
    else router.back();
  };

  // ── Final save ───────────────────────────────────────────────
  const handleFinalSubmit = async () => {
    // Hard guard — prevent any double-submission
    if (isSubmittingRef.current) return;

    // Validate required fields
    if (!shopId || !currentUser) {
      console.error("Missing shopId or currentUser", { shopId, currentUser });
      return;
    }
    if (
      !data.customerId ||
      !data.garmentType ||
      !data.dueDate ||
      !data.totalPrice
    ) {
      console.error("Missing required order fields", data);
      return;
    }

    // Lock immediately
    isSubmittingRef.current = true;
    setSaving(true);

    try {
      const filledMeasurements = Object.fromEntries(
        Object.entries(data.measurements ?? {}).filter(
          ([, v]) => v && v !== "0",
        ),
      );

      let measurementId = data.measurementId;
      if (!measurementId && Object.keys(filledMeasurements).length > 0) {
        measurementId = uuid();

        const selectedRelation = data.orderForRelation ?? "self";
        const measurementRow = {
          id: measurementId,
          customer_id: data.customerId!,
          shop_id: shopId,
          order_for_relation: selectedRelation,
          order_for_name: data.orderForName?.trim() || null,
          recipient_gender: data.recipientGender ?? data.customerGender,
          garment_type: data.garmentType!,
          values: filledMeasurements,
          taken_at: nowKarachiIso(),
        };

        let { error } = await (supabase as any).from("measurements").insert(measurementRow);
        if (error && isParentRelation(selectedRelation) && isRelationCheckError(error)) {
          const retry = await (supabase as any).from("measurements").insert({
            ...measurementRow,
            order_for_relation: measurementRelationForLegacyDb(selectedRelation),
            order_for_name: null,
          });
          error = retry.error;
        }
        if (error) throw new Error(error.message)
      }

      if (!measurementId) {
        const selectedRelation = data.orderForRelation ?? "self";
        const lookupRelation = measurementRelationForLegacyDb(selectedRelation);
        let query = (supabase as any)
          .from("measurements")
          .select("*")
          .eq("customer_id", data.customerId!)
          .eq("garment_type", data.garmentType)
          .eq("order_for_relation", lookupRelation)
          .is("deleted_at", null)
          .order("taken_at", { ascending: false })
          .limit(1);
        if (isParentRelation(selectedRelation)) {
          query = query.eq("recipient_gender", data.recipientGender ?? data.customerGender);
        }
        if (selectedRelation !== "self" && data.orderForName?.trim()) {
          query = query.eq("order_for_name", data.orderForName.trim());
        }
        const { data: latestRows, error } = await query;
        if (error) throw new Error(error.message);
        measurementId = latestRows?.[0] ? mapMeasurement(latestRows[0]).id : undefined;
      }
      // ── 1. Create the order (amountPaid starts at 0) ───────────
      const styleSummary = formatStyleSelections(data.styleSelections ?? {});
      const orderNotes = [styleSummary, data.specialInstructions?.trim()]
        .filter(Boolean)
        .join("\n\n");

      const order = await orderOps.add(shopId, {
        customerId: data.customerId,
        customerName: data.customerName!,
        customerPhone: data.customerPhone!,
        orderForRelation: data.orderForRelation ?? "self",
        orderForName: data.orderForName?.trim() || undefined,
        recipientGender: data.recipientGender ?? data.customerGender,
        garmentType: data.garmentType,
        measurementId,
        status: "received",
        dueDate: data.dueDate,
        totalPrice: data.totalPrice,
        isUrgent: data.isUrgent ? 1 : 0,
        specialInstructions: orderNotes || undefined,
        assignedTo: data.assignedTo,
        assignedToName: data.assignedToName,
      });

      if (data.fabricPhotoBase64) {
        if (cloudinaryEnabled && typeof navigator !== "undefined" && navigator.onLine) {
          const uploaded = await uploadToCloudinary(data.fabricPhotoBase64, shopId, order.id, "fabric");
          if (uploaded) {
            await (supabase as any).from("order_photos").insert({
              id: uuid(),
              order_id: order.id,
              shop_id: shopId,
              type: "fabric",
              cloud_url: uploaded.url,
              public_id: uploaded.publicId,
              cloud_size_kb: Math.round(uploaded.bytes / 1024),
              size_kb: Math.ceil((data.fabricPhotoBase64.length * 3) / 4 / 1024),
              taken_at: nowKarachiIso(),
              deleted_at: null,
            });
          } else {
            toast.warning("Order save ho gaya, photo upload nahi hui.");
          }
        } else {
          toast.warning("Order save ho gaya, photo upload ke liye Cloudinary/internet chahiye.");
        }
      }

      // ── 2. Record advance payment (paymentOps sets amountPaid correctly) ──
      if (data.advancePaid && data.advancePaid > 0) {
        const advanceAmount = Math.min(data.advancePaid, data.totalPrice);
        const surplus = Math.max(0, data.advancePaid - advanceAmount);
        if (advanceAmount > 0) {
          await paymentOps.add(shopId, {
            orderId: order.id,
            amount: advanceAmount,
            method: data.paymentMethod ?? "cash",
            recordedBy: currentUser.id,
            appliedToBalance: advanceAmount,
            notes:
              surplus > 0
                ? `Advance Rs. ${data.advancePaid.toLocaleString()} tha; Rs. ${advanceAmount.toLocaleString()} order par apply hua.`
                : undefined,
          });
        }
        if (surplus > 0) {
          await paymentOps.add(shopId, {
            orderId: order.id,
            amount: surplus,
            method: data.paymentMethod ?? "cash",
            recordedBy: currentUser.id,
            kind: "overpayment",
            appliedToBalance: 0,
            notes: `Advance ka extra overpayment: Rs. ${surplus.toLocaleString()}.`,
          });
        }
      }

      // ── 4. Store the saved order info for the success screen ───
      setSavedOrderId(order.id);
      setSavedOrderNo(order.orderNumber);
      setSavedTrackingCode(order.trackingCode);

      // ── 5. Show success screen ─────────────────────────────────
      setSaving(false);
      setPageStep("success");
      toast.success("Order Save Ho Gaya! ✓", {
        description: `#${String(order.orderNumber).padStart(3, "0")} · ${data.customerName}`,
      });
    } catch (e) {
      console.error("Order save failed:", e);
      toast.error("Order save nahi hua", {
        description: e instanceof Error ? e.message : "Dobara try karein.",
      });
      // Unlock on failure so user can retry
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // ── SUCCESS SCREEN ────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────
  if (pageStep === "success") {
    const trackUrl = `${window.location.origin}/track/${savedTrackingCode}`;
    const canShareTracking = plan.canUseTracking;

    // Build WhatsApp link with customer's actual number
    const cleanPhone = data.customerPhone
      ? `92${data.customerPhone.replace(/^0/, "").replace(/\D/g, "")}`
      : null;

    const waMsg = cleanPhone
      ? encodeURIComponent(
          `Assalam o Alaikum ${data.customerName}!\n\n` +
            `Aapka order #${String(savedOrderNo).padStart(3, "0")} receive ho gaya hai.\n\n` +
            (canShareTracking ? `👉 Order track karein:\n${trackUrl}\n\n` : '') +
            `Tayyar hone par aapko bata diya jayega. Shukriya! 🙏`,
        )
      : null;

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        {/* Success icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-1">
          Order Save Ho Gaya!
        </h2>
        <p className="text-slate-500 text-sm mb-2">
          Order #{String(savedOrderNo).padStart(3, "0")} · {data.customerName}
        </p>

        {canShareTracking ? (
          <div className="bg-slate-100 rounded-2xl px-4 py-2 mb-6 max-w-xs w-full">
            <p className="text-xs text-slate-500 font-mono truncate">
              {trackUrl}
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 max-w-xs w-full">
            <p className="text-xs text-amber-800">
              Online tracking Professional plan se unlock hoti hai.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* WhatsApp share — only shows if customer has phone */}
          {canShareTracking && cleanPhone && waMsg && (
            <a
              href={`https://wa.me/${cleanPhone}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-green-500
                         hover:bg-green-600 text-white font-semibold py-4 rounded-2xl
                         transition-colors active:scale-[0.98]"
            >
              <MessageCircle size={18} />
              WhatsApp Par Share Karein
            </a>
          )}

          <button
            onClick={() => router.push(`/orders/${savedOrderId}`)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold
                       py-4 rounded-2xl transition-colors active:scale-[0.98]"
          >
            Order Dekhein →
          </button>

          <button
            onClick={() => router.replace("/")}
            className="w-full text-slate-500 font-medium py-3
                       hover:text-slate-700 transition-colors"
          >
            Dashboard Par Jayein
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // ── WIZARD SCREEN (3 steps) ───────────────────────────────────
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Step progress bar + back button */}
      <StepIndicator
        currentStep={wizardStep}
        steps={STEPS}
        onBack={handleBack}
      />

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 pt-5">
        {wizardStep === 1 && (
          <Step1Customer
            data={data}
            onUpdate={update}
            onNext={() => setWizardStep(2)}
          />
        )}

        {wizardStep === 2 && (
          <Step2Garment
            data={data}
            onUpdate={update}
            onNext={() => setWizardStep(3)}
          />
        )}

        {wizardStep === 3 && (
          <Step3Confirm
            data={data}
            onUpdate={update}
            karigars={karigars}
            selectableKarigarIds={getSelectableKarigarIds(karigars, plan.karigarLimit)}
            saving={saving}
            onSubmit={handleFinalSubmit}
          />
        )}
      </div>
    </div>
  );
}
