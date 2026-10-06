"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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

  const initial = (user?.name?.charAt(0) || "U").toUpperCase();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-slate-950/90 backdrop-blur-2xl border-r border-white/10 flex-col z-40 shadow-2xl text-slate-100">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-400 to-sky-400 text-slate-950 flex items-center justify-center font-bold text-base shadow-lg shadow-teal-500/20">
            ✦
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white block leading-tight">TransLang</span>
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">AI Fluency</span>
          </div>
        </div>

        {/* User Stats Card */}
        {user && (
          <div className="px-4 py-3.5 mx-3 mt-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-400 to-sky-400 p-0.5 shadow-sm flex-shrink-0">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{user.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {user.role === "professional" ? (
                    <Briefcase className="w-3 h-3 text-sky-400" />
                  ) : (
                    <GraduationCap className="w-3 h-3 text-teal-400" />
                  )}
                  <span className="text-[11px] text-slate-400 capitalize font-medium">{user.role}</span>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-white/10 text-center">
              <div className="bg-white/5 py-1 px-1.5 rounded-xl border border-white/5 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-extrabold text-slate-200">{user.streak ?? 0}</span>
              </div>
              <div className="bg-white/5 py-1 px-1.5 rounded-xl border border-white/5 flex items-center justify-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-extrabold text-slate-200">{user.xp ?? 0}</span>
              </div>
              <div className="bg-white/5 py-1 px-1.5 rounded-xl border border-white/5 flex items-center justify-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-extrabold text-slate-200">{user.coins ?? 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl font-medium text-sm transition-all duration-200 ${
                  active
                    ? "bg-white/20 text-white font-bold shadow-lg shadow-black/20 border border-white/20"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-teal-300" : "text-slate-400"}`} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="px-3 pb-6 pt-2 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl font-semibold text-sm text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Dock */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 py-2 shadow-2xl">
        {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-2xl transition-all ${
                active ? "text-teal-300 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${active ? "bg-teal-500/20" : ""}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-semibold">{label.split(" ")[0]}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-2xl text-rose-400 hover:text-rose-300 transition-all"
        >
          <div className="p-1 rounded-xl">
            <LogOut className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-semibold">Exit</span>
        </button>
      </nav>
    </>
  );
}
