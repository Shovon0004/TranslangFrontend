"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Lottie from "lottie-react";
import aiLogoAnimation from "../../public/lotti/Ai Translation.json";
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  Settings,
  LogOut,
  Flame,
  Star,
  GraduationCap,
  Briefcase,
  MessageCircle,
  Newspaper,
  Coins,
  Globe,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",   icon: LayoutDashboard },
  { href: "/lessons",      label: "Lessons",     icon: BookOpen },
  { href: "/articles",     label: "Articles",    icon: Newspaper },
  { href: "/talk",         label: "Talk to AI",  icon: MessageCircle },
  { href: "/global-test",  label: "Global Test", icon: Globe },
  { href: "/leaderboard",  label: "Leaderboard", icon: Trophy },
  { href: "/settings",     label: "Settings",    icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <>
    {/* Desktop Sidebar - hidden on mobile */}
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#06555A] border-r border-[#054a4e] flex-col z-40 shadow-lg">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="w-10 h-10 flex items-center justify-center">
          <Lottie animationData={aiLogoAnimation} loop className="w-full h-full" style={{ background: "transparent" }} />
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">Translingua</span>
      </div>

      {/* User Info */}
      {user && (
        <div className="px-4 py-4 mx-3 mt-4 bg-white/10 rounded-2xl border border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6FB3B8] flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{user.name}</p>
              <div className="flex items-center gap-1">
                {user.role === "professional" ? (
                  <Briefcase className="w-3 h-3 text-blue-500" />
                ) : (
                  <GraduationCap className="w-3 h-3 text-[#6FB3B8]" />
                )}
                <span className="text-xs text-white/60 capitalize">{user.role}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-white/80">{user.streak}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-bold text-white/80">{user.xp} XP</span>
            </div>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white/80">{user.coins ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                active
                  ? "bg-white/20 text-white shadow-md"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-red-300 hover:bg-white/10 transition-all duration-150"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>

    {/* Mobile Bottom Nav - visible only on mobile */}
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#06555A] border-t border-white/10 flex items-center justify-around px-2 py-2 shadow-2xl">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150 ${
              active ? "text-white" : "text-white/50"
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-all ${active ? "bg-white/20" : ""}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-red-300 transition-all duration-150"
      >
        <div className="p-1.5 rounded-lg">
          <LogOut className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold">Logout</span>
      </button>
    </nav>
    </>
  );
}
