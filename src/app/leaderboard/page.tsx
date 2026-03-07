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
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  level: string;
  role: string;
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

  useEffect(() => {
    api
      .get("/users/leaderboard")
      .then((res) => setLeaders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentUserRank = leaders.findIndex((l) => l._id === (user as any)?._id) + 1;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-7 h-7 text-yellow-500" />
          <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
        </div>

        {/* Your rank banner */}
        {currentUserRank > 0 && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#6FB3B8] to-[#3D8F8F] p-4 flex items-center justify-between text-white shadow">
            <span className="font-semibold">Your Rank</span>
            <span className="text-2xl font-bold">#{currentUserRank}</span>
          </div>
        )}

        {/* Top 3 podium */}
        {!loading && leaders.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[leaders[1], leaders[0], leaders[2]].map((u, podiumIdx) => {
              const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
              const height = rank === 1 ? "pt-0" : "pt-6";
              return (
                <div key={u._id} className={`flex flex-col items-center ${height}`}>
                  <div
                    className={`w-full rounded-2xl border p-3 flex flex-col items-center gap-1 ${medalBg[rank - 1]}`}
                  >
                    <Trophy className={`w-5 h-5 ${medalColors[rank - 1]} mb-1`} />
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6FB3B8] to-[#3D8F8F] flex items-center justify-center text-white font-bold text-lg shadow overflow-hidden">
                      {u.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm text-center truncate w-full text-center">
                      {u.name.split(" ")[0]}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400" />
                      {u.xp} XP
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list — 5 rows visible, rest scrollable */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: "20rem" }}>
          {loading ? (
            <div className="flex justify-center py-6">
              <SandyLoading size={120} />
            </div>
          ) : leaders.length === 0 ? (
            <div className="p-10 text-center">
              <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No data yet.</p>
              <p className="text-gray-300 text-sm mt-1">Complete lessons to earn XP and appear here.</p>
            </div>
          ) : (
            leaders.map((u, idx) => {
              const isCurrentUser = u._id === (user as any)?._id;
              return (
                <div
                  key={u._id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                    isCurrentUser ? "bg-[#d0eaeb]/40" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Rank */}
                  <span
                    className={`w-8 text-center font-bold text-sm ${
                      idx === 0
                        ? "text-yellow-400"
                        : idx === 1
                        ? "text-gray-400"
                        : idx === 2
                        ? "text-amber-600"
                        : "text-gray-400"
                    }`}
                  >
                    {idx < 3 ? (
                      <Trophy className={`w-4 h-4 inline ${medalColors[idx]}`} />
                    ) : (
                      `#${idx + 1}`
                    )}
                  </span>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6FB3B8] to-[#3D8F8F] flex items-center justify-center text-white font-bold text-base shadow-sm flex-shrink-0 overflow-hidden">
                    {u.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      u.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">
                        {u.name}
                        {isCurrentUser && (
                          <span className="ml-1 text-xs text-[#3D8F8F] font-normal">(you)</span>
                        )}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-0.5 ${
                          levelColors[u.level] || "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.level}
                      </span>
                      {u.role === "professional" && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex items-center gap-0.5">
                          <Briefcase className="w-3 h-3" /> Pro
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                    {u.streak > 0 && (
                      <span className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-400" />
                        {u.streak}
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-semibold text-gray-700">
                      <Star className="w-4 h-4 text-yellow-400" />
                      {u.xp}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cat playing Lottie */}
        <div className="flex justify-center mt-6">
          <Lottie animationData={catAnimation} loop className="w-56 h-56" style={{ background: "transparent" }} />
        </div>
      </div>
    </DashboardLayout>
  );
}
