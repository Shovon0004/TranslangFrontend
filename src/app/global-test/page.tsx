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
        <div className="max-w-3xl mx-auto">
          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06555A] via-[#077a80] to-[#09a0a8] p-7 mb-6 shadow-lg">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Languages className="w-5 h-5 text-white" />
                </div>
                <span className="text-white/80 text-xs font-semibold uppercase tracking-widest">
                  Global Language Test
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-2 leading-tight">
                Prove Your Language Mastery
              </h1>
              <p className="text-white/70 text-sm max-w-lg">
                Take an AI-generated test sourced from the web, or try a hand-crafted
                curated test from our team. A full report is emailed once you finish.
              </p>
            </div>
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
            <div className="absolute -right-2 -bottom-12 w-56 h-56 bg-white/5 rounded-full pointer-events-none" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setTab("ai")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "ai"
                  ? "bg-white text-[#06555A] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Sparkles className="w-4 h-4" /> AI-Generated Test
            </button>
            <button
              onClick={() => setTab("curated")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "curated"
                  ? "bg-white text-[#06555A] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <ClipboardList className="w-4 h-4" /> Curated Tests
              {curatedTests.length > 0 && (
                <span className="bg-[#06555A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {curatedTests.length}
                </span>
              )}
            </button>
          </div>

          {/* ── AI Tab ─────────────────────────────────────────────────── */}
          {tab === "ai" && (
            <>
              {/* How it works */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { icon: Search,   label: "Web Search",    desc: "Live search for real articles" },
                  { icon: Sparkles, label: "AI Questions",  desc: "Gemini builds 10 grounded MCQs" },
                  { icon: Mail,     label: "Email Report",  desc: "Full review sent to your inbox" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-2">
                    <div className="w-8 h-8 bg-[#06555A]/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#06555A]" />
                    </div>
                    <p className="text-xs font-bold text-gray-800">{label}</p>
                    <p className="text-[11px] text-gray-400 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Language grid */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
                <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#06555A]" />
                  Choose a Language
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LANGUAGES.map(({ label, flag }) => (
                    <button
                      key={label}
                      onClick={() => { setLanguage(label); setError(""); }}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold border transition-all duration-150 ${
                        language === label
                          ? "bg-[#06555A] text-white border-[#06555A] shadow-md scale-[1.02]"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#06555A] hover:bg-[#e8f5f5] hover:scale-[1.01]"
                      }`}
                    >
                      <span className="text-2xl leading-none">{flag}</span>
                      <span>{label}</span>
                      {language === label && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="mt-4 text-sm text-red-500 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> {error}
                  </p>
                )}
              </div>

              <button
                onClick={handleStartTest}
                disabled={!language}
                className="w-full flex items-center justify-center gap-2 bg-[#06555A] hover:bg-[#054a4e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all text-base shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
              >
                <Globe className="w-5 h-5" />
                {language ? `Start ${language} Test` : "Search Web & Start Test"}
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
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-semibold text-gray-500">No curated tests available yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Check back soon!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {curatedTests.map((test) => (
                    <button
                      key={test._id}
                      onClick={() => handleStartCurated(test)}
                      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:border-[#06555A] hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 bg-[#06555A]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#06555A]/20 transition-colors">
                          <span className="text-xl">{LANGUAGE_FLAG[test.language] ?? "🌐"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm group-hover:text-[#06555A] transition-colors">
                              {test.title}
                            </p>
                            <span className="text-[10px] font-bold bg-[#d0eaeb] text-[#06555A] px-2 py-0.5 rounded-full">
                              {test.language}
                            </span>
                          </div>
                          {test.description && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{test.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                              <HelpCircle className="w-3 h-3" />
                              {test.questions.length} questions
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                              <Clock className="w-3 h-3" />
                              ~{Math.ceil(test.questions.length * 0.75)} min
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[#06555A] flex-shrink-0">
                          <Zap className="w-4 h-4" />
                          <span className="text-xs font-bold">Start</span>
                          <ChevronRight className="w-4 h-4" />
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
    { icon: Search,   label: "Searching the Web",       desc: `Finding real ${language} grammar articles…` },
    { icon: BookOpen, label: "Analysing Sources",        desc: "Reading snippets for accurate grounding…" },
    { icon: Sparkles, label: "Building Your Questions",  desc: "AI crafting 10 sourced MCQs…" },
  ];
  if (stage === "loading") {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[65vh] gap-6">
          <div className="w-16 h-16 bg-[#06555A]/10 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#06555A] animate-spin" />
          </div>
          <div className="text-center mb-2">
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">Preparing Your Test</h2>
            <p className="text-sm text-gray-400">This may take 5–15 seconds…</p>
          </div>
          <div className="w-full space-y-3">
            {LOADING_STEPS.map(({ icon: Icon, label, desc }, i) => (
              <div
                key={label}
                className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm"
                style={{ opacity: 1 }}
              >
                <div className="w-9 h-9 bg-[#06555A]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#06555A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <Loader2 className={`w-4 h-4 text-[#06555A] flex-shrink-0 ${i === 0 ? "animate-spin" : "opacity-30"}`} />
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Submitting ────────────────────────────────────────────────────────────
  if (stage === "submitting") {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[65vh] gap-5">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center border border-green-100">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">Submitting Your Test</h2>
            <p className="text-gray-500 text-sm">Scoring your answers &amp; sending your email report…</p>
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
    const OPTION_COLORS: Record<string, string> = {
      A: "emerald", B: "blue", C: "violet", D: "amber",
    };
    const optionAccent = (key: string, isSelected: boolean) => {
      const c = OPTION_COLORS[key] || "gray";
      if (isSelected) return `bg-[#06555A] text-white border-[#06555A] shadow-md`;
      return `bg-white text-gray-700 border-gray-200 hover:border-${c}-400 hover:bg-${c}-50/60`;
    };

    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#06555A] rounded-lg flex items-center justify-center">
                <Languages className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{language} Language Test</p>
                <p className="text-[11px] text-gray-400">Question {current + 1} of {questions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full font-semibold">
                {answered}/{questions.length} answered
              </span>
              <span className="text-[11px] font-bold text-[#06555A]">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
            <div
              className="h-1.5 bg-gradient-to-r from-[#06555A] to-[#09a0a8] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Question card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
            {/* Question number badge */}
            <div className="flex items-start gap-3 mb-5">
              <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#06555A]/10 flex items-center justify-center text-xs font-extrabold text-[#06555A] mt-0.5">
                {current + 1}
              </span>
              <p className="text-[15px] font-semibold text-gray-900 leading-relaxed">
                {q.question}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {Object.entries(q.options).map(([key, val]) => {
                const prev       = answers[String(q.id)];
                const isSelected = selected === key || (!selected && prev === key);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium text-left transition-all duration-150 ${optionAccent(key, isSelected)}`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
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
              <p className="mt-3 text-sm text-red-500 flex items-center gap-1">
                <XCircle className="w-4 h-4" /> {error}
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => saveCurrentAndGoto(current - 1)}
              disabled={current === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {!isLast ? (
              <button
                onClick={() => saveCurrentAndGoto(current + 1)}
                className="flex-1 flex items-center justify-center gap-2 bg-[#06555A] hover:bg-[#054a4e] text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-md"
              >
                <Send className="w-4 h-4" />
                Submit &amp; Get Report
              </button>
            )}
          </div>

          {/* Dot navigator */}
          <div className="flex flex-wrap gap-1.5 mt-5 justify-center">
            {questions.map((qDot, i) => {
              const isDone = i === current ? !!selected : !!answers[String(qDot.id)];
              return (
                <button
                  key={i}
                  onClick={() => saveCurrentAndGoto(i)}
                  title={`Question ${i + 1}`}
                  className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all ${
                    i === current
                      ? "bg-[#06555A] text-white shadow-sm"
                      : isDone
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-gray-100 text-gray-400 border border-gray-200 hover:border-[#06555A]"
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
        <div className="max-w-2xl mx-auto">

          {/* Score Hero */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#06555A] via-[#077a80] to-[#09a0a8] rounded-2xl p-6 mb-4 shadow-lg text-white">
            <div className="absolute -right-6 -top-6 w-36 h-36 bg-white/5 rounded-full pointer-events-none" />
            <div className="absolute -right-2 bottom-0 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">Test Complete!</h2>
                  <p className="text-white/70 text-xs">{result.language} Language Assessment</p>
                </div>
                {/* Grade badge */}
                <div className={`ml-auto flex flex-col items-center justify-center w-14 h-14 rounded-2xl border-2 ${gradeBg(result.grade)} shadow-sm`}>
                  <span className={`text-2xl font-extrabold leading-none ${gradeColor(result.grade)}`}>{result.grade}</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Grade</span>
                </div>
              </div>

              <div className="flex items-end gap-2 mb-3">
                <span className="text-5xl font-extrabold">{result.correct}</span>
                <span className="text-2xl text-white/50 mb-1">/ {result.total}</span>
                <span className="ml-2 text-white/70 text-lg font-semibold mb-1">
                  {result.passed ? "✅ Passed" : "❌ Failed"}
                </span>
              </div>

              <div className="w-full h-2 bg-white/20 rounded-full mb-1">
                <div
                  className="h-2 bg-white rounded-full transition-all duration-700"
                  style={{ width: `${result.percentage}%` }}
                />
              </div>
              <p className="text-white/60 text-xs">{result.percentage}% accuracy</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Target className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-600">{result.correct}</p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Correct</p>
            </div>
            <div className="bg-white rounded-xl border border-red-100 p-4 text-center shadow-sm">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-2xl font-extrabold text-red-500">{result.total - result.correct}</p>
              <p className="text-[11px] text-red-600 font-semibold mt-0.5">Incorrect</p>
            </div>
            <div className="bg-white rounded-xl border border-blue-100 p-4 text-center shadow-sm">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-extrabold text-blue-600">{result.percentage}%</p>
              <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Score</p>
            </div>
          </div>

          {/* Email confirmation */}
          <div className="flex items-start gap-3 bg-[#e8f5f5] text-[#06555A] text-xs rounded-xl p-4 border border-[#b2d8d8] mb-4">
            <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>A detailed report with all questions, correct answers, explanations and source links has been sent to your email.</span>
          </div>

          {/* Question Review accordion */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            <button
              onClick={() => setShowReview((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
            >
              <span className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#06555A]" />
                Review All Questions
                <span className="text-xs font-normal text-gray-400">({result.total} questions)</span>
              </span>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showReview ? "rotate-90" : ""}`} />
            </button>

            {showReview && (
              <div className="divide-y divide-gray-100">
                {result.reviewed.map((rq, i) => (
                  <div key={rq.id} className={`px-6 py-5 ${rq.isCorrect ? "bg-emerald-50/40" : "bg-red-50/40"}`}>
                    {/* Question header */}
                    <div className="flex items-start gap-2.5 mb-3">
                      {rq.isCorrect
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        : <XCircle     className="w-4 h-4 text-red-400   mt-0.5 flex-shrink-0" />}
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{i + 1}. {rq.question}</p>
                    </div>

                    {/* Options */}
                    <div className="ml-6 space-y-1 mb-3">
                      {Object.entries(rq.options).map(([key, val]) => {
                        let cls = "text-gray-400 bg-transparent";
                        if (key === rq.correct)                     cls = "text-emerald-700 font-bold bg-emerald-50 border border-emerald-200";
                        if (key === rq.userAnswer && !rq.isCorrect) cls = "text-red-400 line-through bg-red-50 border border-red-100";
                        return (
                          <div key={key} className={`text-xs px-2.5 py-1.5 rounded-lg ${cls}`}>
                            <span className="font-bold mr-1">{key}.</span> {val}
                            {key === rq.correct    && <span className="ml-1 text-emerald-600">✓ Correct</span>}
                            {key === rq.userAnswer && !rq.isCorrect && <span className="ml-1 text-red-400">✗ Your answer</span>}
                          </div>
                        );
                      })}
                    </div>

                    {!rq.userAnswer && (
                      <p className="ml-6 text-xs text-gray-400 italic mb-2">Not answered</p>
                    )}

                    {/* Explanation */}
                    {rq.explanation && (
                      <div className="ml-6 flex items-start gap-2 text-xs text-gray-600 bg-white rounded-xl p-3 border border-gray-100 mb-2 shadow-sm">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span>{rq.explanation}</span>
                      </div>
                    )}

                    {/* Source citation with year */}
                    {rq.source && rq.source.url && (
                      <div className="ml-6">
                        <SourceCitation source={rq.source} />
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
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-all text-sm hover:scale-[1.01]"
            >
              <RotateCcw className="w-4 h-4" /> New Test
            </button>
            <button
              onClick={() => setShowReview((v) => !v)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#06555A] hover:bg-[#054a4e] text-white font-bold py-3 rounded-xl transition-all text-sm shadow-sm hover:scale-[1.01]"
            >
              <BarChart3 className="w-4 h-4" /> {showReview ? "Hide" : "Review"} Answers
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return null;
}
