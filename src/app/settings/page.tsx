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
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-[#d0eaeb]">
            <Settings className="w-6 h-6 text-[#06555A]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-none">Settings</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your profile &amp; preferences</p>
          </div>
        </div>

        <div className="space-y-5">

          {/* ── Profile Info ─────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#3D8F8F]/10 to-transparent px-6 py-4 flex items-center gap-2 border-b border-gray-100">
              <User className="w-4 h-4 text-[#3D8F8F]" />
              <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Profile Info</span>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Full Name", value: user?.name },
                { label: "Email", value: user?.email },
                { label: "Role", value: user?.role, cap: true },
              ].map(({ label, value, cap }) => (
                <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className={`text-gray-900 font-semibold text-sm truncate ${cap ? "capitalize" : ""}`}>{value || "—"}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Profile Picture ───────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#3D8F8F]/10 to-transparent px-6 py-4 flex items-center gap-2 border-b border-gray-100">
              <Camera className="w-4 h-4 text-[#3D8F8F]" />
              <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Profile Picture</span>
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
                    dragOver ? "border-[#06555A]" : "border-[#3D8F8F]/40"
                  } bg-gradient-to-br from-[#3D8F8F] to-[#06555A] flex items-center justify-center shadow-lg transition-all`}
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
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 shadow">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex-1 space-y-3 w-full">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Change your photo</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Upload a JPG, PNG or GIF — max 5 MB. You can also drag &amp; drop onto the circle.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarSaving}
                    className="flex items-center gap-2 bg-[#3D8F8F] hover:bg-[#06555A] disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm hover:shadow"
                  >
                    {avatarSaving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Camera className="w-4 h-4" />}
                    Upload Photo
                  </button>

                  <button
                    onClick={handleReroll}
                    disabled={avatarSaving}
                    className="flex items-center gap-2 border-2 border-[#3D8F8F] hover:bg-[#d0eaeb] disabled:opacity-60 text-[#3D8F8F] font-semibold px-4 py-2 rounded-xl text-sm transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Random Avatar
                  </button>
                </div>

                {uploadError && (
                  <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    {uploadError}
                  </p>
                )}
                {avatarSaved && !uploadError && (
                  <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Photo saved successfully
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── XP Shop ──────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400/20 to-transparent px-6 py-4 flex items-center gap-2 border-b border-gray-100">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">XP Shop</span>
            </div>
            <div className="px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-gray-800">{user?.coins ?? 0} coins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-bold text-gray-800">{user?.xp ?? 0} XP</span>
                </div>
              </div>
              <Link
                href="/shop"
                className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow"
              >
                Open Shop <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>

          {/* ── Language ──────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#3D8F8F]/10 to-transparent px-6 py-4 flex items-center gap-2 border-b border-gray-100">
              <Globe className="w-4 h-4 text-[#3D8F8F]" />
              <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Languages</span>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Native */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-3">
                  🏠 Native Language
                  {nativeLanguage && (
                    <span className="ml-2 text-xs font-normal text-[#3D8F8F] bg-[#d0eaeb] px-2 py-0.5 rounded-full">
                      {LANGUAGES.find((l) => l.label === nativeLanguage)?.flag} {nativeLanguage}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LANGUAGES.map(({ label, flag }) => (
                    <button
                      key={`native-${label}`}
                      onClick={() => setNativeLanguage(label)}
                      className={`p-3 rounded-xl border-2 text-sm font-semibold text-left transition-all flex items-center gap-1.5 ${
                        nativeLanguage === label
                          ? "border-[#3D8F8F] bg-[#d0eaeb] text-[#06555A] shadow-sm"
                          : "border-gray-200 text-gray-600 hover:border-[#6FB3B8] hover:bg-gray-50"
                      }`}
                    >
                      <span>{flag}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Learning */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-3">
                  📚 Learning Language
                  {currentLanguage && (
                    <span className="ml-2 text-xs font-normal text-[#3D8F8F] bg-[#d0eaeb] px-2 py-0.5 rounded-full">
                      {LANGUAGES.find((l) => l.label === currentLanguage)?.flag} {currentLanguage}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LANGUAGES.map(({ label, flag }) => (
                    <button
                      key={`learning-${label}`}
                      onClick={() => setCurrentLanguage(label)}
                      className={`p-3 rounded-xl border-2 text-sm font-semibold text-left transition-all flex items-center gap-1.5 ${
                        currentLanguage === label
                          ? "border-[#3D8F8F] bg-[#d0eaeb] text-[#06555A] shadow-sm"
                          : "border-gray-200 text-gray-600 hover:border-[#6FB3B8] hover:bg-gray-50"
                      }`}
                    >
                      <span>{flag}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !nativeLanguage || !currentLanguage}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#3D8F8F] hover:bg-[#06555A] disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-sm hover:shadow"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : saved
                  ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                  : "Save Changes"
                }
              </button>
            </div>
          </section>

        </div>
      </div>
    </DashboardLayout>
  );
}

