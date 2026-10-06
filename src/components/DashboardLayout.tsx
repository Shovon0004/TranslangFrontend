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
      <div className="flex items-center justify-center h-screen bg-slate-950 bg-gif-theme">
        <div className="bg-white/85 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl border border-white">
          <SandyLoading size={150} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gif-theme text-slate-900 font-sans flex overflow-x-hidden">
      {/* Ambient background overlay for superior readability */}
      <div className="fixed inset-0 bg-slate-950/25 backdrop-blur-[2px] pointer-events-none z-0" />
      
      <Sidebar />
      
      <main className="relative z-10 flex-1 md:ml-64 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 transition-all max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
