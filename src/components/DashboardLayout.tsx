"use client";
import Sidebar from "@/components/Sidebar";
import SandyLoading from "@/components/SandyLoading";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <SandyLoading size={160} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 bg-gradient-to-br from-sky-50/40 via-slate-50 to-teal-50/20 text-slate-900">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 transition-all">
        {children}
      </main>
    </div>
  );
}
