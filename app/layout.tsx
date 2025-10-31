// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import SyncButton from "@/components/SyncButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Performance Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-black text-white min-h-screen">
        <nav className="bg-black border-b border-slate-700 px-3 py-2 text-xs text-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/orders" className="hover:text-white">
                Orders
              </Link>
              <Link href="/products" className="hover:text-white">
                Produkte / Kategorien
              </Link>
            </div>

            {/* Rechts im Header */}
            <SyncButton />
          </div>
        </nav>

        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
