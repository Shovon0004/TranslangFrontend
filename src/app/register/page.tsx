"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap, Briefcase, UserPlus, ArrowLeft } from "lucide-react";
import SandyLoading from "@/components/SandyLoading";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student", nativeLanguage: "", currentLanguage: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Mandarin", "Portuguese", "Hindi"];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.nativeLanguage) {
      setError("Please select your native language.");
      return;
    }
    if (!form.currentLanguage) {
      setError("Please select a language to learn.");
      return;
    }
    if (form.nativeLanguage === form.currentLanguage) {
      setError("Please select different languages for native and learning.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.role, form.nativeLanguage, form.currentLanguage);
      router.push("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; code?: string; message?: string };
      const msg =
        e?.response?.data?.message ||
        (e?.code === "ERR_NETWORK" ? "Cannot connect to server. Please try again." : null) ||
        e?.message ||
        "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#38bdf8] via-[#7dd3fc] to-[#e0f2fe] flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
      
      {/* Background clouds */}
      <div className="absolute inset-0 pointer-events-none opacity-80">
        <svg className="absolute -right-20 top-10 w-[600px] h-[350px] text-white/40" viewBox="0 0 500 300" fill="currentColor">
          <path d="M120,200 Q80,200 60,160 Q40,120 80,90 Q120,60 180,80 Q220,40 280,60 Q340,30 390,80 Q440,80 450,130 Q470,170 430,200 Z" />
        </svg>
        <svg className="absolute -left-20 bottom-10 w-[550px] h-[320px] text-white/30" viewBox="0 0 500 300" fill="currentColor">
          <path d="M100,220 Q50,210 50,160 Q50,110 100,90 Q140,40 210,60 Q270,30 330,70 Q380,60 410,110 Q450,140 430,200 Q390,230 330,220 Z" />
        </svg>
      </div>

      {/* Header */}
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

      {/* Glass Card */}
      <div className="relative z-10 max-w-lg w-full mx-auto my-auto py-8">
        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 border border-white/90 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">Create your account</h1>
            <p className="text-slate-600 text-sm mt-1">Start your 14-day free fluency pass</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Doe"
                required
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-slate-900 text-sm placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-slate-900 text-sm placeholder-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Native Language</label>
                <select
                  name="nativeLanguage"
                  value={form.nativeLanguage}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-slate-900 text-xs font-medium"
                >
                  <option value="">Select Native</option>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Target Language</label>
                <select
                  name="currentLanguage"
                  value={form.currentLanguage}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-slate-900 text-xs font-medium"
                >
                  <option value="">Select Target</option>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                  required
                  className="w-full px-4 py-2.5 pr-11 rounded-2xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-slate-900 text-sm placeholder-slate-400"
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

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Learning Track</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: "student" })}
                  className={`p-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    form.role === "student"
                      ? "bg-slate-950 text-white border-slate-950 shadow"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Student Track</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: "professional" })}
                  className={`p-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    form.role === "professional"
                      ? "bg-slate-950 text-white border-slate-950 shadow"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Professional</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-4"
            >
              {loading ? (
                <SandyLoading size={24} />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-5 pt-5 border-t border-slate-100">
            Already have an account?{" "}
            <Link href="/login" className="text-slate-950 font-bold hover:underline">
              Sign in
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
