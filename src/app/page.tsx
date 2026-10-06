"use client";
import Link from "next/link";
import { useState } from "react";
import { Sparkles, MessageCircle, BookOpen, Newspaper, Globe, ArrowRight, Play, CheckCircle } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"talk" | "lessons" | "articles" | "tests">("talk");

  return (
    <div className="min-h-screen bg-gif-theme text-slate-950 font-sans flex flex-col justify-between overflow-x-hidden relative selection:bg-teal-500 selection:text-white">
      
      {/* Cinematic Ambient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/20 to-slate-950/60 pointer-events-none" />

      {/* ── Top Floating Frosted Navigation ────────────────────────────── */}
      <header className="relative z-30 pt-6 px-4 sm:px-8 max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group bg-slate-950/70 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 shadow-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-400 to-sky-400 text-slate-950 flex items-center justify-center font-bold text-sm shadow">
            ✦
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">TransLang</span>
        </Link>

        {/* Center Pill Menu */}
        <nav className="bg-slate-950/70 backdrop-blur-xl border border-white/20 shadow-xl rounded-full p-1.5 hidden md:flex items-center gap-1 text-xs font-semibold text-slate-300">
          <button
            onClick={() => setActiveTab("talk")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "talk" ? "bg-white text-slate-950 shadow-md font-bold" : "hover:text-white"
            }`}
          >
            AI Talk
          </button>
          <button
            onClick={() => setActiveTab("lessons")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "lessons" ? "bg-white text-slate-950 shadow-md font-bold" : "hover:text-white"
            }`}
          >
            Lessons
          </button>
          <button
            onClick={() => setActiveTab("articles")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "articles" ? "bg-white text-slate-950 shadow-md font-bold" : "hover:text-white"
            }`}
          >
            Articles
          </button>
          <button
            onClick={() => setActiveTab("tests")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "tests" ? "bg-white text-slate-950 shadow-md font-bold" : "hover:text-white"
            }`}
          >
            Global Test
          </button>
        </nav>

        {/* Right Auth Buttons */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-bold text-white bg-slate-950/60 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-full hover:bg-slate-950/80 transition shadow"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="bg-white text-slate-950 text-xs sm:text-sm font-extrabold px-5 py-2.5 rounded-full hover:bg-teal-50 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
          >
            <span>Start Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero Center Section ────────────────────────────────────────── */}
      <main className="relative z-20 text-center max-w-4xl mx-auto px-4 pt-12 sm:pt-18 pb-8">
        <div className="inline-flex items-center gap-2 bg-slate-950/70 backdrop-blur-xl border border-teal-400/40 px-4 py-1.5 rounded-full text-xs font-bold text-teal-300 mb-6 shadow-xl">
          <Sparkles className="w-4 h-4 text-teal-300 animate-pulse" />
          <span>Powered by Gemini 2.5 Voice AI Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08] max-w-3xl mx-auto drop-shadow-lg">
          Master any language on a quieter, smarter rhythm.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-200 font-medium max-w-2xl mx-auto leading-relaxed drop-shadow">
          TransLang is an unhurried fluency platform for ambitious minds. Speak in natural real-time dialogue, read authentic curated articles, and build lasting fluency without the gamified noise.
        </p>

        {/* Hero CTA Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-white text-slate-950 text-sm sm:text-base font-extrabold px-8 py-4 rounded-full hover:bg-teal-50 shadow-2xl hover:scale-105 transition-all flex items-center gap-2.5"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Start 14-Day Free Pass</span>
          </Link>
          <Link
            href="/talk"
            className="bg-slate-950/80 backdrop-blur-2xl border border-white/30 text-white text-sm sm:text-base font-bold px-7 py-4 rounded-full hover:bg-slate-900 shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4 text-teal-400" />
            <span>Try AI Voice Demo</span>
          </Link>
        </div>
      </main>

      {/* ── Floating App Dashboard Preview Dock ────────────────────────── */}
      <section className="relative z-20 max-w-4xl mx-auto px-4 pb-14 w-full">
        <div className="glass-card-light rounded-3xl shadow-2xl p-4 sm:p-6 transition-all">
          
          {/* Dock Tabs Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setActiveTab("talk")}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === "talk"
                    ? "bg-slate-950 text-white shadow-lg"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>AI Voice Talk</span>
              </button>
              <button
                onClick={() => setActiveTab("lessons")}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === "lessons"
                    ? "bg-slate-950 text-white shadow-lg"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Lessons</span>
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">12</span>
              </button>
              <button
                onClick={() => setActiveTab("articles")}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === "articles"
                    ? "bg-slate-950 text-white shadow-lg"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Articles</span>
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === "tests"
                    ? "bg-slate-950 text-white shadow-lg"
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
                className="hidden sm:flex items-center gap-2 bg-slate-950 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-slate-800 transition shadow"
              >
                <span>Dashboard →</span>
              </Link>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-sky-500 text-white font-bold flex items-center justify-center text-xs shadow">
                TL
              </div>
            </div>
          </div>

          {/* Dynamic Tab Demonstration */}
          <div className="pt-5">
            {activeTab === "talk" && (
              <div className="flex flex-col gap-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-slate-950 text-teal-300 flex items-center justify-center text-xs font-bold shrink-0 shadow">
                    Aria
                  </div>
                  <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-none p-4 text-xs text-slate-800 max-w-lg shadow-sm">
                    <p className="leading-relaxed font-medium">
                      &quot;Good morning! How was your weekend? Did you try cooking that traditional dish we practiced last time?&quot;
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-teal-700 font-semibold">
                      <span>💡 Teacher Tip:</span>
                      <span>Share 2 ingredients you used in your response!</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <div className="bg-slate-950 text-white rounded-3xl rounded-tr-none px-5 py-3 text-xs shadow-md font-medium">
                    &quot;Yes! I made vegetable curry and it turned out delicious.&quot;
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shadow-inner">
                    You
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-semibold text-slate-600">Voice engine ready · Continuous conversational fluency</span>
                  </div>
                  <Link
                    href="/talk"
                    className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-full flex items-center gap-1.5 shadow transition"
                  >
                    <span>🎙️ Join Live Talk</span>
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "lessons" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-3xl border border-teal-200 bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700">Unit 1</span>
                    <h4 className="font-bold text-xs text-slate-900 mt-1">Everyday Greetings & Small Talk</h4>
                    <p className="text-[11px] text-slate-600 mt-1">Master real conversational idioms & polite questions.</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-extrabold text-teal-800">
                    <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-teal-600" /> Completed</span>
                    <span>+50 XP</span>
                  </div>
                </div>

                <div className="p-4 rounded-3xl border border-amber-200 bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Unit 2</span>
                    <h4 className="font-bold text-xs text-slate-900 mt-1">Cafes & Ordering Food</h4>
                    <p className="text-[11px] text-slate-600 mt-1">Practical speaking practice for travel & dining.</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-extrabold text-amber-800">
                    <span>In Progress (3/5)</span>
                    <span>+40 XP</span>
                  </div>
                </div>

                <div className="p-4 rounded-3xl border border-slate-200 bg-white/70 shadow-sm flex flex-col justify-between opacity-85">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Unit 3</span>
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
                <div className="p-4 rounded-3xl border border-slate-200 hover:border-teal-400 transition-all bg-white flex items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">Culture</span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 mt-1">The Art of Mindful Conversation in Japanese</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">3 min read · Intermediate vocabulary with AI comprehension quiz.</p>
                  </div>
                  <Link href="/articles" className="shrink-0 text-xs font-bold bg-slate-950 text-white px-5 py-2.5 rounded-full shadow hover:bg-slate-800 transition">
                    Read & Quiz
                  </Link>
                </div>

                <div className="p-4 rounded-3xl border border-slate-200 hover:border-teal-400 transition-all bg-white flex items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">Cognition</span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 mt-1">How Multilingual Brains Switch Languages Seamlessly</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">5 min read · Advanced idioms with AI sentence explanations.</p>
                  </div>
                  <Link href="/articles" className="shrink-0 text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 px-5 py-2.5 rounded-full transition">
                    Read & Quiz
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "tests" && (
              <div className="p-5 rounded-3xl border border-teal-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">Adaptive Global Test</span>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 mt-0.5">CEFR Fluency Assessment (A1 → C2)</h4>
                  <p className="text-xs text-slate-600 mt-1">10 source-grounded questions with instant Gemini evaluation and certified progress badge.</p>
                </div>
                <Link href="/global-test" className="shrink-0 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold px-6 py-3 rounded-full shadow-lg transition">
                  Take Global Test
                </Link>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-20 border-t border-white/20 bg-slate-950/80 backdrop-blur-xl py-6 px-4 text-center text-xs text-slate-400">
        <p>© 2026 TransLang. Built for unhurried, natural language mastery.</p>
      </footer>

    </div>
  );
}
