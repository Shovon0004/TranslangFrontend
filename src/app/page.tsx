"use client";
import Link from "next/link";
import { useState } from "react";
import { Sparkles, MessageCircle, BookOpen, Newspaper, Globe, ArrowRight, Play, CheckCircle } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"talk" | "lessons" | "articles" | "tests">("talk");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#38bdf8] via-[#7dd3fc] to-[#e0f2fe] text-slate-900 font-sans flex flex-col justify-between overflow-x-hidden relative selection:bg-teal-500 selection:text-white">
      
      {/* ── Background Painterly Cloud Decorations ──────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
        <svg className="absolute -right-24 top-12 w-[700px] h-[450px] text-white/40" viewBox="0 0 500 300" fill="currentColor">
          <path d="M120,200 Q80,200 60,160 Q40,120 80,90 Q120,60 180,80 Q220,40 280,60 Q340,30 390,80 Q440,80 450,130 Q470,170 430,200 Z" />
        </svg>
        <svg className="absolute -left-32 top-36 w-[650px] h-[420px] text-white/30" viewBox="0 0 500 300" fill="currentColor">
          <path d="M100,220 Q50,210 50,160 Q50,110 100,90 Q140,40 210,60 Q270,30 330,70 Q380,60 410,110 Q450,140 430,200 Q390,230 330,220 Z" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-white via-white/50 to-transparent"></div>
      </div>

      {/* ── Top Floating Navigation ────────────────────────────────────── */}
      <header className="relative z-30 pt-6 px-4 sm:px-8 max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-full bg-slate-950 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-105 transition-all">
            ✦
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-950">TransLang</span>
        </Link>

        {/* Center Pill Navigation */}
        <nav className="bg-white/80 backdrop-blur-md border border-white/80 shadow-sm rounded-full p-1.5 hidden md:flex items-center gap-1 text-xs font-semibold text-slate-700">
          <button
            onClick={() => setActiveTab("talk")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "talk" ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-950"
            }`}
          >
            AI Talk
          </button>
          <button
            onClick={() => setActiveTab("lessons")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "lessons" ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-950"
            }`}
          >
            Lessons
          </button>
          <button
            onClick={() => setActiveTab("articles")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "articles" ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-950"
            }`}
          >
            Articles
          </button>
          <button
            onClick={() => setActiveTab("tests")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "tests" ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-950"
            }`}
          >
            Global Test
          </button>
        </nav>

        {/* Right Auth CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-semibold text-slate-800 hover:text-slate-950 px-3 py-1.5 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-slate-950 text-white text-xs sm:text-sm font-medium px-5 py-2.5 rounded-full hover:bg-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
          >
            <span>Start free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero Center Section ────────────────────────────────────────── */}
      <main className="relative z-20 text-center max-w-4xl mx-auto px-4 pt-12 sm:pt-16 pb-8">
        <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-md border border-white/60 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-800 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>Gemini 2.5 Voice AI Tutor Active</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-950 leading-[1.08] max-w-3xl mx-auto">
          Learn any language on a quieter kind of rhythm.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-800/90 font-normal max-w-2xl mx-auto leading-relaxed">
          TransLang is an unhurried fluency platform for ambitious minds. Speak in natural real-time dialogue, read authentic curated articles, and build lasting fluency without the gamified noise.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-slate-950 text-white text-sm sm:text-base font-medium px-7 py-3.5 rounded-full hover:bg-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start your 14-day free trial</span>
          </Link>
          <Link
            href="/talk"
            className="bg-white/80 backdrop-blur-md border border-white/90 text-slate-900 text-sm sm:text-base font-medium px-6 py-3.5 rounded-full hover:bg-white shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4 text-teal-700" />
            <span>Try AI Voice Demo</span>
          </Link>
        </div>
      </main>

      {/* ── Floating App Dashboard Preview Dock ────────────────────────── */}
      <section className="relative z-20 max-w-4xl mx-auto px-4 pb-12 w-full">
        <div className="bg-white/95 backdrop-blur-2xl border border-white/90 rounded-3xl shadow-2xl p-4 sm:p-6 transition-all">
          
          {/* Top Pill Tabs & Profile */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setActiveTab("talk")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTab === "talk"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>AI Voice Talk</span>
              </button>
              <button
                onClick={() => setActiveTab("lessons")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTab === "lessons"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Lessons</span>
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">12</span>
              </button>
              <button
                onClick={() => setActiveTab("articles")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTab === "articles"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Articles</span>
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTab === "tests"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Global Test</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                <span>Dashboard →</span>
              </Link>
              <div className="w-7 h-7 rounded-full bg-[#06555A] text-white font-bold flex items-center justify-center text-xs shadow-sm">
                TL
              </div>
            </div>
          </div>

          {/* Tab Content Dynamic Display */}
          <div className="pt-5">
            {activeTab === "talk" && (
              <div className="flex flex-col gap-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#06555A] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                    Aria
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-none p-4 text-xs text-slate-800 max-w-lg shadow-sm">
                    <p className="leading-relaxed">
                      &quot;Good morning! How was your weekend? Did you try cooking that traditional dish we practiced last time?&quot;
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-teal-700 font-medium">
                      <span>💡 Teacher Tip:</span>
                      <span>Share 2 ingredients you used in your response!</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <div className="bg-[#06555A] text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-xs shadow-md">
                    &quot;Yes! I made vegetable curry and it turned out delicious.&quot;
                  </div>
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                    You
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl p-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-medium text-slate-600">Voice engine ready · Continuous fluency</span>
                  </div>
                  <Link
                    href="/talk"
                    className="bg-[#06555A] hover:bg-[#054347] text-white text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm transition"
                  >
                    <span>🎙️ Join Live Talk</span>
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "lessons" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/50 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Unit 1</span>
                    <h4 className="font-bold text-xs text-slate-900 mt-1">Everyday Greetings & Small Talk</h4>
                    <p className="text-[11px] text-slate-600 mt-1">Master real conversational idioms & polite questions.</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold text-teal-800">
                    <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-teal-600" /> Completed</span>
                    <span>+50 XP</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Unit 2</span>
                    <h4 className="font-bold text-xs text-slate-900 mt-1">Cafes & Ordering Food</h4>
                    <p className="text-[11px] text-slate-600 mt-1">Practical speaking practice for travel & dining.</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold text-amber-800">
                    <span>In Progress (3/5)</span>
                    <span>+40 XP</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between opacity-80">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit 3</span>
                    <h4 className="font-bold text-xs text-slate-800 mt-1">Workplace & Meetings</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Expressing opinions, nuances & polite negotiations.</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-400">
                    <span>🔒 Next Level</span>
                    <span>+60 XP</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "articles" && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl border border-slate-200 hover:border-teal-400 transition-all bg-white flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Culture</span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 mt-1">The Art of Mindful Conversation in Japanese</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">3 min read · Intermediate vocabulary with AI comprehension quiz.</p>
                  </div>
                  <Link href="/articles" className="shrink-0 text-xs font-semibold bg-[#06555A] text-white px-4 py-2 rounded-full shadow-sm hover:bg-[#054347] transition">
                    Read & Quiz
                  </Link>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 hover:border-teal-400 transition-all bg-white flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">Cognition</span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 mt-1">How Multilingual Brains Switch Languages Seamlessly</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">5 min read · Advanced idioms with AI sentence explanations.</p>
                  </div>
                  <Link href="/articles" className="shrink-0 text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 px-4 py-2 rounded-full transition">
                    Read & Quiz
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "tests" && (
              <div className="p-5 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-sky-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Adaptive Global Test</span>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 mt-0.5">CEFR Fluency Assessment (A1 → C2)</h4>
                  <p className="text-xs text-slate-600 mt-1">10 source-grounded questions with instant Gemini evaluation and certified progress badge.</p>
                </div>
                <Link href="/global-test" className="shrink-0 bg-[#06555A] hover:bg-[#054347] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow transition">
                  Take Global Test
                </Link>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── Clean Footer ──────────────────────────────────────────────── */}
      <footer className="relative z-20 border-t border-white/60 bg-white/40 backdrop-blur-md py-6 px-4 text-center text-xs text-slate-600">
        <p>© 2026 TransLang. Built for unhurried, natural language mastery.</p>
      </footer>

    </div>
  );
}
