import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CustomersContent } from "@/components/customers/CustomersContent";

export const metadata: Metadata = {
  title: "Customers",
  description: "Manage your tailor shop customers. View order history, measurements, and contact details.",
  openGraph: {
    title: "Customers - Mera Darzi",
    description: "Manage your tailor shop customers.",
  },
};

export default function CustomersPage() {
  return (
    <ErrorBoundary>
      <CustomersContent />
    </ErrorBoundary>
  );
}
