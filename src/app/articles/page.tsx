"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import SandyLoading from "@/components/SandyLoading";
import api from "@/lib/api";
import { BookOpen, Clock, Globe, Star } from "lucide-react";

interface Article {
  _id: string;
  title: string;
  description: string;
  image: string;
  source: string;
  language: string;
  publishedAt: string;
  createdAt: string;
}

export default function ArticlesPage() {
  const [articles, setArticles]   = useState<Article[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Article[]>("/articles");
        setArticles(data);
      } catch {
        setError("Failed to load articles.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <span className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#06555A] to-[#0A7A82] text-white flex items-center justify-center shadow">
                <BookOpen className="w-5 h-5" />
              </span>
              Bilingual Articles
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">
              Read authentic international literature &amp; test your reading comprehension with AI
            </p>
          </div>
        </div>

        {/* XP Info Banner */}
        <div className="flex items-center gap-3 bg-amber-50/80 border border-amber-200/80 rounded-3xl px-5 py-3.5 mb-7 shadow-sm">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500 flex-shrink-0" />
          <p className="text-amber-900 text-xs sm:text-sm font-semibold">
            Earn <span className="font-extrabold text-amber-700">+10 XP</span> for each comprehension question answered accurately after reading.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <SandyLoading size={180} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-20 text-rose-500 glass-card-light rounded-3xl p-8">
            <p className="font-semibold text-sm">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && articles.length === 0 && (
          <div className="text-center py-20 glass-card-light rounded-3xl p-8">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-700">No articles available yet</p>
            <p className="text-xs text-slate-400 mt-1">Check back soon for new publications!</p>
          </div>
        )}

        {/* Articles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link
              key={article._id}
              href={`/articles/${article._id}`}
              className="group glass-card-light hover:shadow-2xl border border-white/80 rounded-3xl overflow-hidden transition-all duration-300 flex flex-col hover:-translate-y-1.5"
            >
              {article.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <div className="w-full h-44 overflow-hidden relative">
                  <img
                    src={article.image}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="w-full h-44 bg-teal-50 flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-[#06555A]/40" />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <h2 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-2 mb-2 group-hover:text-[#06555A] transition-colors">
                  {article.title}
                </h2>
                {article.description && (
                  <p className="text-slate-600 text-xs line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {article.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/80 text-slate-500 text-xs font-semibold">
                  {article.source && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-[#06555A]" />
                      {article.source}
                    </span>
                  )}
                  {article.publishedAt && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
