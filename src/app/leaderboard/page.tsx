"use client";
import DashboardLayout from "@/components/DashboardLayout";
import SandyLoading from "@/components/SandyLoading";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Trophy, Flame, Star, Briefcase } from "lucide-react";
import Lottie from "lottie-react";
import catAnimation from "../../../public/lotti/Cat playing animation.json";

interface LeaderboardUser {
  _id: string;
  name?: string;
  avatar?: string;
  xp?: number;
  streak?: number;
  level?: string;
  role?: string;
}

const medalColors = ["text-yellow-400", "text-gray-400", "text-amber-600"];
const medalBg = ["bg-yellow-50 border-yellow-200", "bg-gray-50 border-gray-200", "bg-amber-50 border-amber-200"];
const levelColors: Record<string, string> = {
  beginner: "bg-[#d0eaeb] text-[#3D8F8F]",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-purple-100 text-purple-700",
};

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    api
      .get("/users/leaderboard")
      .then((res) => {
        if (Array.isArray(res.data)) {
          setLeaders(res.data);
        } else if (res.data && Array.isArray((res.data as any).users)) {
          setLeaders((res.data as any).users);
        } else {
          setLeaders([]);
        }
      })
      .catch(() => {
        setLeaders([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentUserId = (user as any)?._id || (user as any)?.id;
  const currentUserRank =
    Array.isArray(leaders) && currentUserId
      ? leaders.findIndex((l) => l?._id === currentUserId) + 1
      : 0;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <span className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                <Trophy className="w-5 h-5" />
              </span>
              Leaderboard
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">Compete with fellow language learners globally</p>
          </div>
        </div>

        {/* Your rank banner */}
        {currentUserRank > 0 && (
          <div className="mb-6 rounded-3xl bg-slate-950 text-white p-5 flex items-center justify-between shadow-xl border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-amber-400">
                ✦
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Standing</p>
                <p className="text-base font-bold text-white">Keep practicing to climb the ranks</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">#{currentUserRank}</span>
            </div>
          </div>
        )}

        {/* Top 3 podium */}
        {!loading && Array.isArray(leaders) && leaders.length >= 3 && leaders[0] && leaders[1] && leaders[2] && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            {[leaders[1], leaders[0], leaders[2]].map((u, podiumIdx) => {
              if (!u) return null;
              const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
              const height = rank === 1 ? "pt-0" : "pt-6";
              const displayName = u.name?.trim() || "Learner";
              const firstName = displayName.split(" ")[0] || displayName;
              const initial = (displayName.charAt(0) || "L").toUpperCase();

              return (
                <div key={u._id || `podium-${rank}`} className={`flex flex-col items-center ${height}`}>
                  <div
                    className={`w-full glass-card-light rounded-3xl p-4 flex flex-col items-center gap-2 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                      rank === 1 ? "border-2 border-amber-400/70 shadow-amber-500/10" : "border border-white/90"
                    }`}
                  >
                    <div className="absolute -top-3.5 px-3 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase shadow-sm bg-slate-950 text-white flex items-center gap-1">
                      <Trophy className={`w-3 h-3 ${rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-300" : "text-amber-600"}`} />
                      Rank {rank}
                    </div>

                    <div className={`mt-2 rounded-full p-1 ${
                      rank === 1 ? "ring-4 ring-amber-400/50" : rank === 2 ? "ring-2 ring-slate-300" : "ring-2 ring-amber-600/40"
                    }`}>
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-[#06555A] to-[#0A7A82] flex items-center justify-center text-white font-extrabold text-xl shadow overflow-hidden">
                        {u.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          initial
                        )}
                      </div>
                    </div>

                    <p className="font-bold text-slate-900 text-sm text-center truncate w-full mt-1">
                      {firstName}
                    </p>
                    <span className="text-xs font-extrabold text-slate-700 bg-white/80 border border-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {u.xp ?? 0} XP
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="glass-card-light rounded-3xl shadow-xl border border-white/80 divide-y divide-slate-100/80 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-10">
              <SandyLoading size={120} />
            </div>
          ) : !Array.isArray(leaders) || leaders.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-semibold">No rankings available yet.</p>
              <p className="text-slate-400 text-xs mt-1">Complete lessons to earn XP and appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80 max-h-[26rem] overflow-y-auto">
              {leaders.map((u, idx) => {
                if (!u) return null;
                const isCurrentUser = currentUserId && u._id === currentUserId;
                const displayName = u.name?.trim() || "Learner";
                const initial = (displayName.charAt(0) || "L").toUpperCase();
                const level = u.level || "beginner";

                return (
                  <div
                    key={u._id || `leader-${idx}`}
                    className={`flex items-center gap-3 sm:gap-4 px-5 py-3.5 transition-colors ${
                      isCurrentUser ? "bg-[#06555A]/10" : "hover:bg-white/60"
                    }`}
                  >
                    {/* Rank */}
                    <span
                      className={`w-7 text-center font-extrabold text-sm ${
                        idx === 0
                          ? "text-amber-500"
                          : idx === 1
                          ? "text-slate-400"
                          : idx === 2
                          ? "text-amber-700"
                          : "text-slate-400"
                      }`}
                    >
                      {idx < 3 ? (
                        <Trophy className={`w-4 h-4 inline ${medalColors[idx]}`} />
                      ) : (
                        `#${idx + 1}`
                      )}
                    </span>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#06555A] to-[#0A7A82] flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0 overflow-hidden">
                      {u.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                    </div>

                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 truncate text-sm">
                          {displayName}
                          {isCurrentUser && (
                            <span className="ml-1.5 text-xs text-[#06555A] font-semibold">(you)</span>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${
                            level === "advanced"
                              ? "bg-purple-100/80 text-purple-700 border-purple-200"
                              : level === "intermediate"
                              ? "bg-amber-100/80 text-amber-700 border-amber-200"
                              : "bg-teal-100/80 text-teal-700 border-teal-200"
                          }`}
                        >
                          {level}
                        </span>
                        {u.role === "professional" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/80 text-blue-700 border border-blue-200 flex items-center gap-0.5">
                            <Briefcase className="w-3 h-3" /> Pro
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold flex-shrink-0">
                      {(u.streak ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-orange-500 font-bold">
                          <Flame className="w-4 h-4 fill-orange-500" />
                          {u.streak}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-bold text-slate-800 bg-white/80 px-2.5 py-1 rounded-full border border-slate-100 shadow-sm">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        {u.xp ?? 0}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cat playing Lottie */}
        {mounted && (
          <div className="flex justify-center mt-4">
            <Lottie animationData={catAnimation} loop className="w-48 h-48" style={{ background: "transparent" }} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
