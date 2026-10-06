"use client";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import {
  Globe,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  Trophy,
  Loader2,
  Mail,
  ClipboardList,
  Lightbulb,
  BarChart3,
  ExternalLink,
  Languages,
  BookOpen,
  Search,
  Sparkles,
  CalendarDays,
  Target,
  TrendingUp,
  Link2,
  Zap,
  Clock,
  HelpCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuestionSource {
  title: string;
  url: string;
  year?: number | null;
}

interface Question {
  id: number;
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
  source: QuestionSource | null;
}

interface ReviewedQuestion extends Question {
  userAnswer: string | null;
  isCorrect: boolean;
}

interface TestResult {
  language: string;
  correct: number;
  total: number;
  percentage: number;
  passed: boolean;
  grade: string;
  reviewed: ReviewedQuestion[];
}

interface CuratedTest {
  _id: string;
  title: string;
  language: string;
  description: string;
  questions: Question[];
}

type Stage = "select-language" | "loading" | "quiz" | "submitting" | "result";
type TestTab = "ai" | "curated";

// ─── Language options ──────────────────────────────────────────────────────────
const LANGUAGES = [
  { label: "English",    flag: "🇬🇧" },
  { label: "French",     flag: "🇫🇷" },
  { label: "Spanish",    flag: "🇪🇸" },
  { label: "German",     flag: "🇩🇪" },
  { label: "Japanese",   flag: "🇯🇵" },
  { label: "Mandarin",   flag: "🇨🇳" },
  { label: "Portuguese", flag: "🇧🇷" },
  { label: "Italian",    flag: "🇮🇹" },
  { label: "Korean",     flag: "🇰🇷" },
  { label: "Arabic",     flag: "🇸🇦" },
  { label: "Hindi",      flag: "🇮🇳" },
  { label: "Russian",    flag: "🇷🇺" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeColor(grade: string) {
  if (grade === "A+") return "text-purple-600";
  if (grade === "A")  return "text-emerald-600";
  if (grade === "B")  return "text-blue-600";
  if (grade === "C")  return "text-amber-600";
  return "text-red-500";
}
function gradeBg(grade: string) {
  if (grade === "A+") return "bg-purple-50 border-purple-200";
  if (grade === "A")  return "bg-emerald-50 border-emerald-200";
  if (grade === "B")  return "bg-blue-50 border-blue-200";
  if (grade === "C")  return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}


// ─── Source Citation Widget ──────────────────────────────────────────────────
function SourceCitation({ source }: { source: QuestionSource | null }) {
  if (!source || !source.url) return null;
  return (
    <div className="mt-5 rounded-xl border border-[#b2d8d8] bg-gradient-to-r from-[#f0fafa] to-[#e8f5f5] p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <BookOpen className="w-3.5 h-3.5 text-[#06555A]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#06555A]">
          Source
        </span>
        {source.year && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#06555A] bg-[#06555A]/10 rounded-full px-2 py-0.5">
            <CalendarDays className="w-2.5 h-2.5" />
            {source.year}
          </span>
        )}
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 group"
      >
        <Link2 className="w-3 h-3 text-[#06555A]/60 mt-0.5 flex-shrink-0 group-hover:text-[#06555A] transition-colors" />
        <span className="text-xs text-[#06555A] group-hover:text-[#054a4e] group-hover:underline leading-snug line-clamp-2 transition-colors">
          {source.title || source.url}
        </span>
        <ExternalLink className="w-3 h-3 text-[#06555A]/50 mt-0.5 flex-shrink-0 group-hover:text-[#06555A] transition-colors" />
      </a>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GlobalTestPage() {
  const [stage, setStage]           = useState<Stage>("select-language");
  const [tab, setTab]               = useState<TestTab>("ai");
  const [language, setLanguage]     = useState("");
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [current, setCurrent]       = useState(0);
  const [answers, setAnswers]       = useState<Record<string, string>>({});
  const [selected, setSelected]     = useState<string | null>(null);
  const [result, setResult]         = useState<TestResult | null>(null);
  const [error, setError]           = useState("");
  const [showReview, setShowReview] = useState(false);
  const [curatedTests, setCuratedTests] = useState<CuratedTest[]>([]);
  const [curatedLoading, setCuratedLoading] = useState(false);

  // Fetch curated tests once
  useEffect(() => {
    const load = async () => {
      setCuratedLoading(true);
      try {
        const { data } = await api.get("/global-test/curated");
        setCuratedTests(data);
      } catch { /* ignore */ }
      finally { setCuratedLoading(false); }
    };
    load();
  }, []);

  // ── Start Test ────────────────────────────────────────────────────────────
  const handleStartTest = async () => {
    if (!language) { setError("Please select a language to continue."); return; }
    setError("");
    setStage("loading");
    try {
      const { data } = await api.get("/global-test/questions", { params: { language } });
      setQuestions(data.questions);
      setAnswers({});
      setCurrent(0);
      setSelected(null);
      setStage("quiz");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Failed to load questions. Please try again.";
      setError(msg);
      setStage("select-language");
    }
  };

  // ── Save current answer & navigate ───────────────────────────────────────
  const saveCurrentAndGoto = (nextIndex: number) => {
    const q = questions[current];
    if (selected) setAnswers((prev) => ({ ...prev, [String(q.id)]: selected }));
    setSelected(answers[String(questions[nextIndex].id)] || null);
    setCurrent(nextIndex);
  };

  // ── Submit Test ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const q = questions[current];
    const finalAnswers = selected
      ? { ...answers, [String(q.id)]: selected }
      : answers;
    setStage("submitting");
    try {
      const { data } = await api.post("/global-test/submit", {
        language,
        questions,
        answers: finalAnswers,
      });
      setResult(data);
      setStage("result");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Submission failed. Please try again.";
      setError(msg);
      setStage("quiz");
    }
  };

  // ── Start Curated Test ────────────────────────────────────────────────────
  const handleStartCurated = (test: CuratedTest) => {
    setLanguage(test.language);
    // Normalise questions: ensure source is null if missing
    const qs: Question[] = test.questions.map((q) => ({ ...q, source: (q as Question & { source?: Question["source"] }).source ?? null }));
    setQuestions(qs);
    setAnswers({});
    setCurrent(0);
    setSelected(null);
    setError("");
    setStage("quiz");
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStage("select-language");
    setLanguage("");
    setQuestions([]);
    setCurrent(0);
    setAnswers({});
    setSelected(null);
    setResult(null);
    setError("");
    setShowReview(false);
  };

  // ─── Select Language ──────────────────────────────────────────────────────
  if (stage === "select-language") {
    const LANGUAGE_FLAG: Record<string, string> = {
      English: "🇬🇧", French: "🇫🇷", Spanish: "🇪🇸", German: "🇩🇪",
      Japanese: "🇯🇵", Mandarin: "🇨🇳", Portuguese: "🇧🇷", Italian: "🇮🇹",
      Korean: "🇰🇷", Arabic: "🇸🇦", Hindi: "🇮🇳", Russian: "🇷🇺",
    };
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 sm:p-10 mb-6 shadow-2xl border border-white/20 text-white">
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Languages className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-slate-300 text-xs font-bold uppercase tracking-widest">
                  Global Language Certification
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight leading-tight">
                Benchmark Your Fluency Globally
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
                Take an AI-powered assessment grounded in real-world sources or test with curated standardized exam modules. Receive an instant verified performance analysis.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 glass-pill p-1.5 rounded-full shadow-sm max-w-md">
            <button
              onClick={() => setTab("ai")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                tab === "ai"
                  ? "bg-slate-950 text-white shadow"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Live Assessment
            </button>
            <button
              onClick={() => setTab("curated")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                tab === "curated"
                  ? "bg-slate-950 text-white shadow"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" /> Curated Modules
              {curatedTests.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {curatedTests.length}
                </span>
              )}
            </button>
          </div>

          {/* ── AI Tab ─────────────────────────────────────────────────── */}
          {tab === "ai" && (
            <>
              {/* How it works */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
                {[
                  { icon: Search,   label: "Live Web Grounding",    desc: "Retrieves authentic regional linguistics" },
                  { icon: Sparkles, label: "Adaptive AI Questions", desc: "10 grounded multiple-choice questions" },
                  { icon: Mail,     label: "Instant Report",        desc: "Full analytical breakdown & scorecard" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="glass-card-light rounded-3xl p-5 shadow-md border border-white/80 flex flex-col gap-2">
                    <div className="w-9 h-9 bg-[#06555A]/10 rounded-2xl flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#06555A]" />
                    </div>
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">{label}</p>
                    <p className="text-xs text-slate-500 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Language grid */}
              <div className="glass-card-light rounded-3xl shadow-xl border border-white/80 p-6 sm:p-8 mb-6">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#06555A]" />
                  Select Assessment Language
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {LANGUAGES.map(({ label, flag }) => (
                    <button
                      key={label}
                      onClick={() => { setLanguage(label); setError(""); }}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold border transition-all duration-200 ${
                        language === label
                          ? "bg-slate-950 text-white border-slate-950 shadow-lg scale-[1.02]"
                          : "bg-white/70 text-slate-800 border-white/80 hover:bg-white hover:border-slate-300 hover:shadow-md"
                      }`}
                    >
                      <span className="text-2xl leading-none">{flag}</span>
                      <span className="truncate">{label}</span>
                      {language === label && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-400" />}
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="mt-4 text-xs font-bold text-rose-600 flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                    <XCircle className="w-4 h-4" /> {error}
                  </p>
                )}
              </div>

              <button
                onClick={handleStartTest}
                disabled={!language}
                className="w-full flex items-center justify-center gap-2.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-full transition-all text-sm sm:text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                <Globe className="w-5 h-5" />
                {language ? `Start ${language} Assessment` : "Select a Language to Begin"}
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* ── Curated Tab ────────────────────────────────────────────── */}
          {tab === "curated" && (
            <>
              {curatedLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-[#06555A] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : curatedTests.length === 0 ? (
                <div className="glass-card-light rounded-3xl p-12 text-center border border-white/80">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-bold text-slate-700">No curated tests available yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Check back soon for specialized certifications!</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {curatedTests.map((test) => (
                    <button
                      key={test._id}
                      onClick={() => handleStartCurated(test)}
                      className="w-full glass-card-light rounded-3xl border border-white/80 shadow-md p-6 text-left hover:border-slate-300 hover:shadow-xl transition-all duration-200 group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/80 border border-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          <span className="text-2xl">{LANGUAGE_FLAG[test.language] ?? "🌐"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-900 text-base group-hover:text-[#06555A] transition-colors">
                              {test.title}
                            </p>
                            <span className="text-[11px] font-bold bg-teal-100/80 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-full">
                              {test.language}
                            </span>
                          </div>
                          {test.description && (
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{test.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                              <HelpCircle className="w-3.5 h-3.5" />
                              {test.questions.length} questions
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                              <Clock className="w-3.5 h-3.5" />
                              ~{Math.ceil(test.questions.length * 0.75)} min
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 px-4 py-2 rounded-full bg-slate-950 text-white font-bold text-xs shadow group-hover:gap-1.5 transition-all">
                          <span>Start</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  const LOADING_STEPS = [
    { icon: Search,   label: "Searching the Web",       desc: `Finding authentic ${language} linguistics…` },
    { icon: BookOpen, label: "Analysing Sources",        desc: "Reading snippets for contextual grounding…" },
    { icon: Sparkles, label: "Building Your Questions",  desc: "AI synthesizing 10 structured MCQs…" },
  ];
  if (stage === "loading") {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[65vh] gap-6">
          <div className="glass-card-light rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/90 w-full text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-[#06555A]/10 rounded-2xl flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-[#06555A] animate-spin" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-1">Generating Assessment</h2>
            <p className="text-xs text-slate-500 mb-6">Live AI grounding in progress (5–12 seconds)…</p>
            <div className="w-full space-y-3 text-left">
              {LOADING_STEPS.map(({ icon: Icon, label, desc }, i) => (
                <div
                  key={label}
                  className="flex items-center gap-3.5 bg-white/80 rounded-2xl border border-slate-100 px-4 py-3 shadow-sm"
                >
                  <div className="w-8 h-8 bg-[#06555A]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#06555A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900">{label}</p>
                    <p className="text-[11px] text-slate-500">{desc}</p>
                  </div>
                  <Loader2 className={`w-3.5 h-3.5 text-[#06555A] flex-shrink-0 ${i === 0 ? "animate-spin" : "opacity-30"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Submitting ────────────────────────────────────────────────────────────
  if (stage === "submitting") {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[65vh]">
          <div className="glass-card-light rounded-3xl p-8 shadow-2xl border border-white/90 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-200 mb-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-1">Grading Assessment</h2>
            <p className="text-slate-500 text-xs">Scoring answers &amp; sending your analytical report…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────
  if (stage === "quiz" && questions.length > 0) {
    const q        = questions[current];
    const progress = ((current + 1) / questions.length) * 100;
    const answered = Object.keys(answers).length + (selected ? 1 : 0);
    const isLast   = current === questions.length - 1;

    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-slate-950 rounded-2xl flex items-center justify-center text-white shadow">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 leading-tight">{language} Assessment</p>
                <p className="text-xs text-slate-500">Question {current + 1} of {questions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 glass-pill px-3 py-1 rounded-full font-bold shadow-sm">
                {answered}/{questions.length} completed
              </span>
              <span className="text-xs font-extrabold text-slate-900">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100/80 rounded-full mb-6 overflow-hidden p-0.5 border border-slate-200/50">
            <div
              className="h-full bg-slate-950 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Question card */}
          <div className="glass-card-light rounded-3xl shadow-xl border border-white/80 p-6 sm:p-8 mb-6">
            {/* Question header */}
            <div className="flex items-start gap-3 mb-6">
              <span className="flex-shrink-0 w-8 h-8 rounded-2xl bg-slate-950 text-white flex items-center justify-center text-xs font-extrabold mt-0.5 shadow">
                {current + 1}
              </span>
              <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                {q.question}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {Object.entries(q.options).map(([key, val]) => {
                const prev       = answers[String(q.id)];
                const isSelected = selected === key || (!selected && prev === key);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl border text-sm font-semibold text-left transition-all duration-200 ${
                      isSelected
                        ? "bg-slate-950 text-white border-slate-950 shadow-md scale-[1.01]"
                        : "bg-white/70 text-slate-800 border-white/90 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-all ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {key}
                    </span>
                    <span className="flex-1">{val}</span>
                  </button>
                );
              })}
            </div>

            {/* Source citation */}
            <SourceCitation source={q.source} />

            {error && (
              <p className="mt-4 text-xs font-bold text-rose-600 flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                <XCircle className="w-4 h-4" /> {error}
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => saveCurrentAndGoto(current - 1)}
              disabled={current === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 transition shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {!isLast ? (
              <button
                onClick={() => saveCurrentAndGoto(current + 1)}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-bold py-3.5 rounded-full transition shadow-lg hover:shadow-xl text-xs sm:text-sm"
              >
                Next Question <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-full transition shadow-lg hover:shadow-xl text-xs sm:text-sm"
              >
                <Send className="w-4 h-4" />
                Submit Assessment
              </button>
            )}
          </div>

          {/* Dot navigator */}
          <div className="flex flex-wrap gap-1.5 mt-6 justify-center">
            {questions.map((qDot, i) => {
              const isDone = i === current ? !!selected : !!answers[String(qDot.id)];
              return (
                <button
                  key={i}
                  onClick={() => saveCurrentAndGoto(i)}
                  title={`Question ${i + 1}`}
                  className={`w-7 h-7 rounded-xl text-[11px] font-bold transition-all ${
                    i === current
                      ? "bg-slate-950 text-white shadow-md scale-110"
                      : isDone
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-white/70 text-slate-400 border border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Result ───────────────────────────────────────────────────────────────
  if (stage === "result" && result) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">

          {/* Score Hero */}
          <div className="relative overflow-hidden bg-slate-950 rounded-3xl p-8 mb-6 shadow-2xl border border-white/20 text-white">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">Assessment Complete!</h2>
                  <p className="text-slate-300 text-xs">{result.language} Proficiency Assessment</p>
                </div>
                {/* Grade badge */}
                <div className={`ml-auto flex flex-col items-center justify-center w-16 h-16 rounded-2xl border-2 ${gradeBg(result.grade)} shadow-lg`}>
                  <span className={`text-3xl font-extrabold leading-none ${gradeColor(result.grade)}`}>{result.grade}</span>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Grade</span>
                </div>
              </div>

              <div className="flex items-end gap-2 mb-4">
                <span className="text-5xl font-extrabold text-white">{result.correct}</span>
                <span className="text-2xl text-slate-400 mb-1">/ {result.total}</span>
                <span className="ml-3 text-sm font-bold px-3 py-1 rounded-full mb-2 bg-white/10 border border-white/20">
                  {result.passed ? "✅ Passed Certification" : "❌ Below Threshold"}
                </span>
              </div>

              <div className="w-full h-2 bg-white/20 rounded-full mb-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${result.percentage}%` }}
                />
              </div>
              <p className="text-slate-300 text-xs font-semibold">{result.percentage}% Accuracy Rate</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3.5 mb-6">
            <div className="glass-card-light rounded-3xl border border-white/80 p-5 text-center shadow-md">
              <div className="w-9 h-9 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-2 text-emerald-600">
                <Target className="w-4 h-4" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700">{result.correct}</p>
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mt-0.5">Correct</p>
            </div>
            <div className="glass-card-light rounded-3xl border border-white/80 p-5 text-center shadow-md">
              <div className="w-9 h-9 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-2 text-rose-500">
                <XCircle className="w-4 h-4" />
              </div>
              <p className="text-2xl font-extrabold text-rose-600">{result.total - result.correct}</p>
              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mt-0.5">Incorrect</p>
            </div>
            <div className="glass-card-light rounded-3xl border border-white/80 p-5 text-center shadow-md">
              <div className="w-9 h-9 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-2 text-blue-600">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-2xl font-extrabold text-blue-700">{result.percentage}%</p>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mt-0.5">Score</p>
            </div>
          </div>

          {/* Question Review accordion */}
          <div className="glass-card-light rounded-3xl shadow-xl border border-white/80 overflow-hidden mb-6">
            <button
              onClick={() => setShowReview((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-slate-900 hover:bg-white/60 transition-all"
            >
              <span className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#06555A]" />
                Review All Questions &amp; Explanations
                <span className="text-xs font-normal text-slate-500">({result.total} items)</span>
              </span>
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showReview ? "rotate-90" : ""}`} />
            </button>

            {showReview && (
              <div className="divide-y divide-slate-100/80">
                {result.reviewed.map((rq, i) => (
                  <div key={rq.id} className={`px-6 py-5 ${rq.isCorrect ? "bg-emerald-50/30" : "bg-rose-50/30"}`}>
                    {/* Question header */}
                    <div className="flex items-start gap-2.5 mb-3">
                      {rq.isCorrect
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        : <XCircle     className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />}
                      <p className="text-sm font-bold text-slate-900 leading-snug">{i + 1}. {rq.question}</p>
                    </div>

                    {/* Options */}
                    <div className="ml-6 space-y-1.5 mb-3">
                      {Object.entries(rq.options).map(([key, val]) => {
                        let cls = "text-slate-500 bg-white/40 border-transparent";
                        if (key === rq.correct)                     cls = "text-emerald-800 font-bold bg-emerald-100/80 border border-emerald-300";
                        if (key === rq.userAnswer && !rq.isCorrect) cls = "text-rose-600 line-through bg-rose-100/80 border border-rose-300";
                        return (
                          <div key={key} className={`text-xs px-3 py-2 rounded-xl border ${cls}`}>
                            <span className="font-bold mr-1">{key}.</span> {val}
                            {key === rq.correct    && <span className="ml-1 text-emerald-700 font-bold">✓ Correct</span>}
                            {key === rq.userAnswer && !rq.isCorrect && <span className="ml-1 text-rose-600 font-semibold">✗ Your answer</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {rq.explanation && (
                      <div className="ml-6 flex items-start gap-2 text-xs text-slate-700 bg-white/80 rounded-2xl p-3.5 border border-slate-100 mb-2 shadow-sm leading-relaxed">
                        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span>{rq.explanation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold py-3.5 rounded-full transition-all text-xs sm:text-sm shadow-sm"
            >
              <RotateCcw className="w-4 h-4 text-[#06555A]" /> Take Another Test
            </button>
            <button
              onClick={() => setShowReview((v) => !v)}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-bold py-3.5 rounded-full transition-all text-xs sm:text-sm shadow-md"
            >
              <BarChart3 className="w-4 h-4" /> {showReview ? "Hide" : "Review"} All Answers
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return null;
}
