"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  Settings,
  User,
  Globe,
  RefreshCw,
  Camera,
  CheckCircle2,
  Loader2,
  Coins,
  Star,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import api from "@/lib/api";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "zh", label: "Mandarin", flag: "🇨🇳" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
];

const DICEBEAR_STYLES = [
  "adventurer", "big-smile", "croodles", "fun-emoji",
  "lorelei", "notionists", "open-peeps", "personas", "pixel-art", "bottts",
];

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace("/api", "");

function randomDiceBearAvatar(seed: string) {
  const style = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

function resolveAvatar(url: string | undefined) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_BASE}${url}`;
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [nativeLanguage, setNativeLanguage] = useState(user?.nativeLanguage || "");
  const [currentLanguage, setCurrentLanguage] = useState(user?.currentLanguage || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>(resolveAvatar(user?.avatar));
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (nativeLanguage === currentLanguage) {
      alert("Please select different languages for native and learning.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/users/me", { nativeLanguage, currentLanguage });
      updateUser({ nativeLanguage, currentLanguage });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const uploadFile = async (file: File) => {
    setUploadError("");
    setAvatarSaving(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await api.post("/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = resolveAvatar(res.data.avatarUrl);
      setAvatarPreview(url);
      updateUser({ avatar: res.data.avatarUrl });
      setAvatarSaved(true);
      setTimeout(() => setAvatarSaved(false), 2500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadError(msg || "Upload failed. Try again.");
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  };

  const saveAvatarUrl = async (url: string) => {
    setAvatarSaving(true);
    setUploadError("");
    try {
      await api.put("/users/me", { avatar: url });
      updateUser({ avatar: url });
      setAvatarPreview(url);
      setAvatarSaved(true);
      setTimeout(() => setAvatarSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setAvatarSaving(false); }
  };

  const handleReroll = () => {
    const newAvatar = randomDiceBearAvatar((user?.name || "user") + Date.now());
    saveAvatarUrl(newAvatar);
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Account &amp; Language Settings</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">Customize your profile, target languages, and avatar</p>
          </div>
        </div>


        <div className="space-y-6">

          {/* ── Profile Info ─────────────────────────────── */}
          <section className="glass-card-light rounded-3xl border border-white/80 shadow-md overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-2 border-b border-slate-100/80 bg-white/40">
              <User className="w-4 h-4 text-[#06555A]" />
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Account Overview</span>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Learner Name", value: user?.name },
                { label: "Email Address", value: user?.email },
                { label: "Account Role", value: user?.role, cap: true },
              ].map(({ label, value, cap }) => (
                <div key={label} className="bg-white/70 border border-slate-100/80 rounded-2xl px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className={`text-slate-900 font-extrabold text-sm truncate ${cap ? "capitalize" : ""}`}>{value || "—"}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Profile Picture ───────────────────────────── */}
          <section className="glass-card-light rounded-3xl border border-white/80 shadow-md overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-2 border-b border-slate-100/80 bg-white/40">
              <Camera className="w-4 h-4 text-[#06555A]" />
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Avatar Customization</span>
            </div>

            <div className="px-6 py-6 flex flex-col sm:flex-row items-center gap-6">
              {/* Clickable / drag-drop avatar */}
              <div
                className={`relative group cursor-pointer flex-shrink-0 transition-transform ${dragOver ? "scale-105" : ""}`}
                onClick={() => !avatarSaving && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div
                  className={`w-28 h-28 rounded-full overflow-hidden border-4 ${
                    dragOver ? "border-[#06555A]" : "border-white"
                  } bg-gradient-to-tr from-[#06555A] to-[#0A7A82] flex items-center justify-center shadow-xl transition-all`}
                >
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-extrabold text-white">{initials}</span>
                  )}
                </div>
                {/* hover overlay */}
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {avatarSaving
                    ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                    : <Camera className="w-7 h-7 text-white" />}
                </div>
                {/* saved badge */}
                {avatarSaved && (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 shadow-md">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex-1 space-y-3 w-full text-center sm:text-left">
                <div>
                  <p className="font-extrabold text-slate-900 text-base">Update Profile Photo</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload a custom image (JPG, PNG, GIF) or instantly roll a dynamic DiceBear persona.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-wrap gap-2.5 justify-center sm:justify-start">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarSaving}
                    className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-full text-xs transition-all shadow-md hover:shadow-lg"
                  >
                    {avatarSaving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Camera className="w-4 h-4" />}
                    Upload Image
                  </button>

                  <button
                    onClick={handleReroll}
                    disabled={avatarSaving}
                    className="flex items-center gap-2 glass-pill hover:bg-white disabled:opacity-60 text-slate-800 font-bold px-5 py-2.5 rounded-full text-xs transition-all shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#06555A]" />
                    Random DiceBear Avatar
                  </button>
                </div>

                {uploadError && (
                  <p className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 px-3 py-2 rounded-2xl">
                    {uploadError}
                  </p>
                )}
                {avatarSaved && !uploadError && (
                  <p className="text-xs text-emerald-600 font-bold flex items-center gap-1 justify-center sm:justify-start">
                    <CheckCircle2 className="w-4 h-4" /> Avatar saved successfully!
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── XP Shop ──────────────────────────────────── */}
          <section className="glass-card-light rounded-3xl border border-white/80 shadow-md overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-2 border-b border-slate-100/80 bg-white/40">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Treasury Balance</span>
            </div>
            <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-extrabold text-slate-900">{user?.coins ?? 0} coins</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-extrabold text-slate-900">{user?.xp ?? 0} XP</span>
                </div>
              </div>
              <Link
                href="/shop"
                className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-full text-xs transition-all shadow-md hover:shadow-lg"
              >
                Visit Coin Shop <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>

          {/* ── Language ──────────────────────────────────── */}
          <section className="glass-card-light rounded-3xl border border-white/80 shadow-md overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-2 border-b border-slate-100/80 bg-white/40">
              <Globe className="w-4 h-4 text-[#06555A]" />
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Language Configuration</span>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Native */}
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  🏠 Native Language
                  {nativeLanguage && (
                    <span className="ml-2 text-xs font-bold text-teal-800 bg-teal-100/80 border border-teal-200 px-2.5 py-0.5 rounded-full">
                      {LANGUAGES.find((l) => l.label === nativeLanguage)?.flag} {nativeLanguage}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {LANGUAGES.map(({ label, flag }) => (
                    <button
                      key={`native-${label}`}
                      onClick={() => setNativeLanguage(label)}
                      className={`p-3 rounded-2xl border text-xs sm:text-sm font-bold text-left transition-all flex items-center gap-2 ${
                        nativeLanguage === label
                          ? "border-slate-950 bg-slate-950 text-white shadow-md"
                          : "border-white/80 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="text-xl">{flag}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Learning */}
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  📚 Learning Language
                  {currentLanguage && (
                    <span className="ml-2 text-xs font-bold text-teal-800 bg-teal-100/80 border border-teal-200 px-2.5 py-0.5 rounded-full">
                      {LANGUAGES.find((l) => l.label === currentLanguage)?.flag} {currentLanguage}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {LANGUAGES.map(({ label, flag }) => (
                    <button
                      key={`learning-${label}`}
                      onClick={() => setCurrentLanguage(label)}
                      className={`p-3 rounded-2xl border text-xs sm:text-sm font-bold text-left transition-all flex items-center gap-2 ${
                        currentLanguage === label
                          ? "border-slate-950 bg-slate-950 text-white shadow-md"
                          : "border-white/80 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="text-xl">{flag}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !nativeLanguage || !currentLanguage}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold px-8 py-3.5 rounded-full transition-all shadow-xl hover:shadow-2xl text-xs sm:text-sm"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : saved
                  ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Saved Preferences!</>
                  : "Save Preferences"
                }
              </button>
            </div>
          </section>

        </div>
      </div>
    </DashboardLayout>
  );
}


