import type { Metadata } from "next";
import { PricingContent } from "@/components/pricing/PricingContent";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Mera Darzi offers Starter, Professional, and Business plans for tailor shops and boutiques in Pakistan. Compare features and pricing.",
  openGraph: {
    title: "Mera Darzi - Pricing Plans for Tailor Management Software",
    description:
      "Choose the right plan for your tailor business. Starter, Professional, and Business plans with flexible billing.",
  },
};

export default function PricingPage() {
  return <PricingContent />;
}
