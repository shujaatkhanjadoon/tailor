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
import { orderOps, paymentOps, teamOps } from "@/lib/db/operations";
import { db, TeamMemberRecord } from "@/lib/db/schema";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { AccessNotice } from "@/components/billing/AccessNotice";
import { getSelectableKarigarIds } from "@/lib/team/karigar-limits";
import { syncService } from "@/lib/supabase/sync-service";

// ── UUID helper ──────────────────────────────────────────────────
const uuid = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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

        await db.measurements.add({
          id: measurementId,
          customerId: data.customerId!,
          shopId,
          orderForRelation: data.orderForRelation ?? "self",
          orderForName: data.orderForRelation === "self" ? undefined : data.orderForName,
          recipientGender: data.recipientGender ?? data.customerGender,
          garmentType: data.garmentType!,
          values: filledMeasurements,
          takenAt: new Date().toISOString(),
          _synced: 0,
          _deleted: 0,
        });
      }

      if (!measurementId) {
        const latestMeasurement = await db.measurements
          .where("customerId")
          .equals(data.customerId!)
          .filter(
            (m) =>
              m._deleted === 0 &&
              m.garmentType === data.garmentType &&
              (m.orderForRelation ?? "self") === (data.orderForRelation ?? "self") &&
              ((data.orderForRelation ?? "self") === "self" || (m.orderForName ?? "") === (data.orderForName ?? "")),
          )
          .reverse()
          .sortBy("takenAt");

        measurementId = latestMeasurement[0]?.id;
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
        orderForName: data.orderForRelation === "self" ? undefined : data.orderForName,
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
        fabricPhotoUrl: data.fabricPhotoBase64,
      });

      if (data.fabricPhotoBase64) {
        await db.photos.add({
          id: uuid(),
          orderId: order.id,
          shopId,
          type: "fabric",
          base64: data.fabricPhotoBase64,
          sizeKB: Math.ceil((data.fabricPhotoBase64.length * 3) / 4 / 1024),
          takenAt: new Date().toISOString(),
          _synced: 0,
          _deleted: 0,
        });
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

      // ── 3. Save measurements if any fields were filled ─────────
      await syncService.pushAll(shopId).catch(console.error);

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
