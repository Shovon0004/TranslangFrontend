"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";
import Lottie from "lottie-react";
import SandyLoading from "@/components/SandyLoading";
import translateAnimation from "../../../public/lotti/Translate illustration.json";
import aiLogoAnimation from "../../../public/lotti/Ai Translation.json";

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
    <div className="min-h-screen bg-[#EDE9E1] flex items-center justify-center p-6">
      {/* Unified card */}
      <div className="w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl shadow-gray-300/50">

        {/* Left panel — Lottie + branding */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 bg-[#3D8F8F] p-12 relative overflow-hidden">
          {/* subtle radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#6FB3B8_0%,_#3D8F8F_70%)] opacity-60 pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center gap-6 text-white text-center">
            <div className="w-20 h-20">
              <Lottie animationData={aiLogoAnimation} loop className="w-full h-full" style={{ background: "transparent" }} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Translingua</h2>
              <p className="text-white/75 mt-1 text-sm">Your language journey starts here</p>
            </div>
            <Lottie
              animationData={translateAnimation}
              loop
              className="w-full max-w-sm"
              style={{ background: "transparent" }}
              rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
            />
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {["🇪🇸 Spanish", "🇫🇷 French", "🇩🇪 German", "🇯🇵 Japanese"].map((lang) => (
                <span key={lang} className="text-xs bg-white/20 backdrop-blur-sm text-white font-medium px-3 py-1 rounded-full">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="w-full lg:w-[440px] shrink-0 bg-white flex flex-col items-center justify-center p-10">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex lg:hidden flex-col items-center mb-6">
              <div className="w-16 h-16">
                <Lottie animationData={aiLogoAnimation} loop className="w-full h-full" style={{ background: "transparent" }} />
              </div>
            </div>

            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-400 text-sm mb-8">Continue your language journey</p>

            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#6FB3B8] focus:border-transparent transition text-gray-900 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#6FB3B8] focus:border-transparent transition text-gray-900 placeholder-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#3D8F8F] hover:bg-[#06555A] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-[#6FB3B8]/30 mt-1"
              >
                {loading ? (
                  <SandyLoading size={28} />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Log In
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-8">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-[#3D8F8F] font-semibold hover:underline">
                Sign up free
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
