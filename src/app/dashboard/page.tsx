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

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Mandarin", "Portuguese"];

const levelColors: Record<string, string> = {
  beginner: "bg-[#d0eaeb] text-[#3D8F8F]",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-purple-100 text-purple-700",
};

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    api.get("/users/me").then((res) => {
      setStats(res.data);
      // Keep auth context (and sidebar) in sync with latest XP, streak & coins
      updateUser({ xp: res.data.xp, streak: res.data.streak, coins: res.data.coins });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedCount = stats?.completedLessons?.length || 0;
  const xp = stats?.xp || user?.xp || 0;
  const coins = stats?.coins ?? user?.coins ?? 0;
  const streak = stats?.streak || user?.streak || 0;
  // Derive the most-recently-studied language from completed lessons (most accurate)
  const lastCompletedLanguage =
    stats?.completedLessons && stats.completedLessons.length > 0
      ? stats.completedLessons[stats.completedLessons.length - 1].language
      : null;
  const currentLanguage = lastCompletedLanguage || stats?.currentLanguage || null;
  const xpToNextLevel = 500;
  const xpProgress = Math.min((xp % xpToNextLevel) / xpToNextLevel, 1) * 100;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-gray-900">
              Hello, {user?.name?.split(" ")[0]} 👋
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                user?.role === "professional"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-[#d0eaeb] text-[#3D8F8F]"
              }`}
            >
              {user?.role === "professional" ? (
                <Briefcase className="w-3 h-3" />
              ) : (
                <GraduationCap className="w-3 h-3" />
              )}
              {user?.role}
            </span>
          </div>
          <p className="text-gray-500">
            {streak > 0
              ? `You're on a ${streak}-day streak! Keep it going 🔥`
              : "Start a lesson to build your streak!"}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Day Streak",
              value: streak,
              icon: Flame,
              color: "from-orange-400 to-red-400",
              bg: "bg-orange-50",
            },
            {
              label: "Total XP",
              value: xp,
              icon: Star,
              color: "from-yellow-400 to-amber-400",
              bg: "bg-yellow-50",
            },
            {
              label: "Coins",
              value: coins,
              icon: Coins,
              color: "from-amber-400 to-yellow-500",
              bg: "bg-amber-50",
            },
            {
              label: "Lessons Done",
              value: completedCount,
              icon: CheckCircle2,
              color: "from-[#6FB3B8] to-[#3D8F8F]",
              bg: "bg-[#d0eaeb]",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-5 border border-white shadow-sm`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* XP Progress */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#3D8F8F]" />
              <span className="font-semibold text-gray-800">Level Progress</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${levelColors[stats?.level || "beginner"]}`}>
              {stats?.level || "beginner"}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-[#6FB3B8] to-[#3D8F8F] h-3 rounded-full transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {xp % xpToNextLevel} / {xpToNextLevel} XP to next level
          </p>
        </div>

        {/* Currently Learning */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-[#3D8F8F]" />
              <h2 className="font-bold text-gray-800">Continue Learning</h2>
            </div>
            {currentLanguage ? (
              <div className="flex items-center justify-between p-4 bg-[#d0eaeb] rounded-xl border border-[#6FB3B8]/30">
                <div>
                  <p className="font-semibold text-gray-800">{currentLanguage}</p>
                  <p className="text-sm text-gray-500">{completedCount} lessons completed</p>
                </div>
                <Link
                  href="/lessons"
                  className="flex items-center gap-1 text-sm font-bold text-[#3D8F8F] hover:text-[#06555A]"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No language selected yet</p>
                <Link
                  href="/lessons"
                  className="mt-3 inline-block text-sm font-bold text-[#3D8F8F] hover:underline"
                >
                  Browse Lessons →
                </Link>
              </div>
            )}
          </div>

          {/* Pick a Language */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="font-bold text-gray-800">Available Languages</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => (
                <Link
                  key={lang}
                  href={`/lessons?language=${lang}`}
                  className="p-3 rounded-xl border border-gray-100 hover:border-[#6FB3B8] hover:bg-[#d0eaeb] transition text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <Globe className="w-4 h-4 text-gray-300" />
                  {lang}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {stats?.completedLessons && stats.completedLessons.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-4">Recent Lessons</h2>
            <div className="space-y-3">
              {stats.completedLessons.slice(-5).reverse().map((lesson) => (
                <div key={lesson._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50">
                  <CheckCircle2 className="w-5 h-5 text-[#3D8F8F] flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{lesson.title}</p>
                    <p className="text-xs text-gray-400">{lesson.language}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
