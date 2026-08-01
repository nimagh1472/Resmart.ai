import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Super Admin",
  description: "ReSmart platform administration console.",
  // Internal console — keep it out of search indexes regardless of auth.
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <AdminHeader />
      <main className="min-h-dvh bg-canvas">
        <AdminDashboard />
      </main>
    </>
  );
}
