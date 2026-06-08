import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Order ${id.slice(0, 8)}...`,
    description: "View order details, status history, measurements, photos, and payment information.",
    openGraph: {
      title: `Order Details - Mera Darzi`,
      description: "View tailoring order details and status.",
    },
  };
}

export default function OrderDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
