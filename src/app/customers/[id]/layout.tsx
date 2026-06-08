import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Customer ${id.slice(0, 8)}...`,
    description: "View customer profile, order history, measurements, and payment details.",
    openGraph: {
      title: `Customer Details - Mera Darzi`,
      description: "View customer details and order history.",
    },
  };
}

export default function CustomerDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
