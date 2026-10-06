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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="text-gray-500 text-sm mt-1">
            Read articles and test your comprehension — earn XP for correct answers!
          </p>
        </div>

        {/* XP Info Banner */}
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-3 mb-7">
          <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <p className="text-yellow-700 text-sm font-medium">
            Earn <span className="font-bold">10 XP</span> for each correct comprehension answer after reading an article.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <SandyLoading size={180} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-20 text-red-500">
            <p>{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && articles.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No articles available yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}

        {/* Articles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {articles.map((article) => (
            <Link
              key={article._id}
              href={`/articles/${article._id}`}
              className="group bg-white hover:shadow-md border border-gray-100 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col shadow-sm"
            >
              {article.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.image}
                  alt=""
                  className="w-full h-40 object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-40 bg-[#d0eaeb] flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-[#3D8F8F]/50" />
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <h2 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-[#3D8F8F] transition-colors">
                  {article.title}
                </h2>
                {article.description && (
                  <p className="text-gray-500 text-xs line-clamp-2 mb-3 flex-1">
                    {article.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-gray-50">
                  {article.source && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Globe className="w-3 h-3" />
                      {article.source}
                    </span>
                  )}
                  {article.publishedAt && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(article.publishedAt).toLocaleDateString()}
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
