"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn, ArrowLeft } from "lucide-react";
import SandyLoading from "@/components/SandyLoading";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; code?: string; message?: string };
      const msg =
        e?.response?.data?.message ||
        (e?.code === "ERR_NETWORK" ? "Cannot connect to server. Please try again." : null) ||
        e?.message ||
        "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gif-theme flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Ambient background overlay for superior readability */}
      <div className="fixed inset-0 bg-slate-950/30 backdrop-blur-[2px] pointer-events-none z-0" />


      {/* Top Header */}
      <header className="relative z-10 max-w-5xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-slate-900 font-semibold text-xs sm:text-sm bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/80 hover:bg-white transition shadow-sm">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center font-bold text-sm shadow">
            ✦
          </div>
          <span className="font-bold text-lg text-slate-950">TransLang</span>
        </Link>
      </header>

      {/* Center Glass Card */}
      <div className="relative z-10 max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 border border-white/90 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">Welcome back</h1>
            <p className="text-slate-600 text-sm mt-1.5">Sign in to continue your fluency journey</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition text-slate-900 text-sm placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-2xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition text-slate-900 text-sm placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-2"
            >
              {loading ? (
                <SandyLoading size={24} />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-6 pt-6 border-t border-slate-100">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-slate-950 font-bold hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-slate-600 py-2">
        <p>© 2026 TransLang. Unhurried language mastery.</p>
      </footer>

    </div>
  );
}
