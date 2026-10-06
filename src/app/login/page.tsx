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
    <div className="min-h-screen bg-gif-theme flex flex-col justify-between p-4 sm:p-6 relative overflow-x-hidden">
      
      {/* Subtle overlay for contrast */}
      <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-[2px] pointer-events-none z-0" />

      {/* Top Header */}
      <header className="relative z-10 max-w-5xl mx-auto w-full flex items-center justify-between pt-2">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-slate-800 font-semibold text-xs sm:text-sm bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/90 hover:bg-white transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700" />
          <span>Back to Home</span>
        </Link>
        <Link href="/" className="flex items-center gap-2.5 bg-white/75 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/80 shadow-sm">
          <div className="w-7 h-7 rounded-full bg-[#06555A] text-white flex items-center justify-center font-bold text-xs shadow">
            ✦
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-900">Translingua</span>
        </Link>
      </header>

      {/* Center Glass Card */}
      <div className="relative z-10 max-w-md w-full mx-auto my-auto py-8">
        <div className="glass-card-light rounded-3xl p-7 sm:p-10 border border-white/95 shadow-2xl backdrop-blur-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#06555A]/10 text-[#06555A] mb-3">
              <LogIn className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-600 text-sm mt-1.5">Sign in to continue your language journey</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-300 rounded-2xl text-rose-800 text-xs font-semibold">
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
                className="w-full px-4 py-3 rounded-2xl glass-input text-slate-900 text-sm placeholder-slate-400 focus:outline-none"
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
                  className="w-full px-4 py-3 pr-11 rounded-2xl glass-input text-slate-900 text-sm placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#06555A] hover:bg-[#054347] disabled:opacity-60 text-white font-bold py-3.5 rounded-full transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#06555A]/25 hover:shadow-xl hover:-translate-y-0.5 mt-2"
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

          <p className="text-center text-xs text-slate-600 mt-6 pt-6 border-t border-slate-200/60">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#06555A] font-bold hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs font-medium text-white/90 drop-shadow py-2">
        <p>© 2026 Translingua. Natural language mastery.</p>
      </footer>

    </div>
  );
}
