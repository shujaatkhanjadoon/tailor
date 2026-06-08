import type { Metadata } from "next";
import { BillingContent } from "@/components/billing/BillingContent";

export const metadata: Metadata = {
  title: "Billing & Plans",
  description: "View and manage your subscription plan, billing history, and upgrade options.",
  openGraph: {
    title: "Billing & Plans - Mera Darzi",
    description: "Manage your subscription and billing.",
  },
};

export default function BillingPage() {
  return <BillingContent />;
}
