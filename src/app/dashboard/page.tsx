"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import Link from "next/link";
import {
  Flame,
  Star,
  BookOpen,
  Trophy,
  Globe,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  GraduationCap,
  Briefcase,
  Coins,
  MessageCircle,
  Sparkles,
} from "lucide-react";

interface UserStats {
  xp: number;
  coins: number;
  streak: number;
  completedLessons: { _id: string; title: string; language: string }[];
  enrolledLanguages: string[];
  currentLanguage: string;
  level: string;
}

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Mandarin", "Portuguese", "Hindi"];

const levelColors: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-800",
  intermediate: "bg-amber-100 text-amber-800",
  advanced: "bg-purple-100 text-purple-800",
};

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    api.get("/users/me").then((res) => {
      setStats(res.data);
      updateUser({ xp: res.data.xp, streak: res.data.streak, coins: res.data.coins });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedCount = stats?.completedLessons?.length || 0;
  const xp = stats?.xp || user?.xp || 0;
  const coins = stats?.coins ?? user?.coins ?? 0;
  const streak = stats?.streak || user?.streak || 0;
  const lastCompletedLanguage =
    stats?.completedLessons && stats.completedLessons.length > 0
      ? stats.completedLessons[stats.completedLessons.length - 1].language
      : null;
  const currentLanguage = lastCompletedLanguage || stats?.currentLanguage || null;
  const xpToNextLevel = 500;
  const xpProgress = Math.min((xp % xpToNextLevel) / xpToNextLevel, 1) * 100;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Top Welcome Banner */}
        <div className="bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 rounded-3xl p-6 sm:p-8 text-slate-950 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-slate-900 mb-3 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-teal-800" />
              <span>TransLang Active Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Welcome back, {user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-slate-900/80 text-sm mt-1.5 max-w-lg">
              {streak > 0
                ? `You are on a ${streak}-day continuous streak! Keep the momentum going today.`
                : "Complete your daily conversation practice to ignite your streak."}
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <Link
              href="/talk"
              className="bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-full shadow-md hover:shadow-xl transition-all flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Start AI Talk</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[
            {
              label: "Day Streak",
              value: streak,
              icon: Flame,
              color: "text-orange-500",
              bg: "bg-orange-50/80 border-orange-100",
            },
            {
              label: "Total XP",
              value: xp,
              icon: Star,
              color: "text-yellow-500",
              bg: "bg-yellow-50/80 border-yellow-100",
            },
            {
              label: "Fluency Coins",
              value: coins,
              icon: Coins,
              color: "text-amber-500",
              bg: "bg-amber-50/80 border-amber-100",
            },
            {
              label: "Completed Units",
              value: completedCount,
              icon: CheckCircle2,
              color: "text-teal-600",
              bg: "bg-teal-50/80 border-teal-100",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-4 sm:p-5 border shadow-sm transition-all hover:shadow-md`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-950">{value}</p>
            </div>
          ))}
        </div>

        {/* Level Progression */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <span className="font-bold text-sm text-slate-900">Fluency Progression</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${levelColors[stats?.level || "beginner"] || "bg-slate-100 text-slate-700"}`}>
              {stats?.level || "beginner"} Level
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-teal-400 to-sky-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {xp % xpToNextLevel} / {xpToNextLevel} XP towards next milestone
          </p>
        </div>

        {/* Learning Paths */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Course */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-teal-600" />
                <h2 className="font-bold text-sm text-slate-900">Current Target Language</h2>
              </div>
              {currentLanguage ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">{currentLanguage}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{completedCount} units mastered</p>
                  </div>
                  <Link
                    href="/lessons"
                    className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-full shadow transition flex items-center gap-1.5"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-6">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs font-medium">No language selected yet</p>
                  <Link
                    href="/lessons"
                    className="mt-3 inline-block text-xs font-bold text-teal-600 hover:underline"
                  >
                    Choose Language &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Available Languages */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-sm text-slate-900">Explore New Languages</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LANGUAGES.map((lang) => (
                <Link
                  key={lang}
                  href={`/lessons?language=${lang}`}
                  className="p-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all text-xs font-semibold text-slate-700 text-center flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>{lang}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
