"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import SandyLoading from "@/components/SandyLoading";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  XCircle,
  Star,
  Zap,
  Globe,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface Article {
  _id: string;
  title: string;
  description: string;
  content: string;
  image: string;
  source: string;
  language: string;
  publishedAt: string;
  url: string;
}

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

interface SubmitResult {
  isCorrect: boolean;
  correctIndex: number;
  chosen: number;
}

type Stage = "reading" | "generating" | "quiz" | "results";

export default function ArticleDetailPage() {
  const { id }          = useParams<{ id: string }>();
  const router          = useRouter();
  const { refreshUser } = useAuth();

  const [article, setArticle]       = useState<Article | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const [stage, setStage]           = useState<Stage>("reading");
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [genError, setGenError]     = useState("");

  const [answers, setAnswers]       = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [results, setResults]       = useState<SubmitResult[]>([]);
  const [xpEarned, setXpEarned]     = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [alreadyDone, setAlreadyDone]   = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get<Article>(`/articles/${id}`);
        setArticle(data);
      } catch {
        setError("Article not found.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleFinishedReading = async () => {
    setStage("generating");
    setGenError("");
    try {
      const { data } = await api.post<{ questions: Question[] }>(`/articles/${id}/questions`);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setStage("quiz");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setGenError(e?.response?.data?.message || "Failed to generate questions. Please try again.");
      setStage("reading");
    }
  };

  const selectAnswer = (qIdx: number, optIdx: number) => {
    setAnswers((prev) => prev.map((a, i) => (i === qIdx ? optIdx : a)));
  };

  const handleSubmit = async () => {
    if (answers.some((a) => a === null)) {
      alert("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/articles/${id}/submit`, {
        answers,
        questions,
      });
      setResults(data.results);
      setXpEarned(data.xpEarned);
      setCorrectCount(data.correctCount);
      setAlreadyDone(data.alreadyCompleted);
      setStage("results");
      await refreshUser();
    } catch {
      alert("Failed to submit answers.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-10">
          <SandyLoading size={200} />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !article) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-red-500">
          <AlertCircle className="w-10 h-10 mx-auto mb-3" />
          <p>{error || "Article not found."}</p>
          <button onClick={() => router.back()} className="mt-4 text-gray-400 hover:text-gray-700 text-sm underline">
            Go back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Results Stage ────────────────────────────────────────────────────────────
  if (stage === "results") {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.push("/articles")}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-950 font-bold text-xs sm:text-sm mb-6 glass-pill px-4 py-2 rounded-full shadow-sm w-fit transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Articles
          </button>

          {/* Score Card */}
          <div className="relative overflow-hidden bg-slate-950 rounded-3xl p-8 text-center mb-6 shadow-2xl border border-white/20 text-white">
            <div className="text-5xl sm:text-6xl font-black text-white mb-2">
              {correctCount}/{questions.length}
            </div>
            <p className="text-slate-300 text-base sm:text-lg font-bold mb-5">
              {correctCount === questions.length
                ? "Perfect Comprehension! 🎉"
                : correctCount >= questions.length / 2
                ? "Strong Reading Mastery! 👏"
                : "Keep Practicing! 📚"}
            </p>
            {alreadyDone ? (
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-slate-200 text-xs sm:text-sm font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Completed – XP previously recorded
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/40 rounded-full px-5 py-2 text-amber-300 text-xs sm:text-sm font-extrabold shadow-sm">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                +{xpEarned} XP earned
              </div>
            )}
          </div>

          {/* Question Results */}
          <div className="space-y-4 mb-6">
            {questions.map((q, qi) => {
              const res = results[qi];
              return (
                <div
                  key={qi}
                  className={`glass-card-light rounded-3xl border p-6 shadow-md ${
                    res?.isCorrect
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-rose-200 bg-rose-50/40"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    {res?.isCorrect
                      ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      : <XCircle    className="w-5 h-5 text-rose-500   flex-shrink-0 mt-0.5" />
                    }
                    <p className="text-slate-900 font-bold text-sm leading-snug">{q.question}</p>
                  </div>
                  <div className="space-y-2 pl-8">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex;
                      const isChosen  = oi === res?.chosen;
                      return (
                        <div
                          key={oi}
                          className={`px-4 py-2.5 rounded-2xl text-xs font-semibold ${
                            isCorrect
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
                              : isChosen && !isCorrect
                              ? "bg-rose-100 text-rose-800 border border-rose-300 line-through"
                              : "text-slate-400 bg-white/40"
                          }`}
                        >
                          {isCorrect && "✓ "}
                          {isChosen && !isCorrect && "✗ "}
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => router.push("/articles")}
            className="w-full py-4 bg-slate-950 text-white font-extrabold rounded-full hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl text-sm"
          >
            Explore More Articles
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Quiz Stage ───────────────────────────────────────────────────────────────
  if (stage === "quiz") {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setStage("reading")}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-950 font-bold text-xs sm:text-sm mb-6 glass-pill px-4 py-2 rounded-full shadow-sm w-fit transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Article
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Comprehension Quiz</h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">
              Answer all {questions.length} questions · Earn +10 XP per correct response
            </p>
          </div>

          <div className="space-y-5">
            {questions.map((q, qi) => (
              <div key={qi} className="glass-card-light rounded-3xl border border-white/80 p-6 shadow-xl">
                <p className="text-slate-900 font-bold text-base mb-4 leading-snug">
                  <span className="text-[#06555A] font-extrabold mr-2">Q{qi + 1}.</span>
                  {q.question}
                </p>
                <div className="space-y-3">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => selectAnswer(qi, oi)}
                        className={`w-full text-left px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all border ${
                          selected
                            ? "bg-slate-950 text-white border-slate-950 shadow-md scale-[1.01]"
                            : "bg-white/70 text-slate-800 border-white/90 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className={`font-bold mr-2 ${selected ? "text-white" : "text-[#06555A]"}`}>
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || answers.some((a) => a === null)}
            className="mt-8 w-full py-4 bg-slate-950 text-white font-extrabold rounded-full hover:bg-slate-800 transition-all disabled:opacity-50 shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {submitting
              ? <><RefreshCw className="w-5 h-5 animate-spin" /> Evaluating…</>
              : <><Zap className="w-5 h-5 text-amber-400" /> Submit Answers</>
            }
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Generating Stage ─────────────────────────────────────────────────────────
  if (stage === "generating") {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto py-28 text-center flex flex-col items-center">
          <div className="glass-card-light rounded-3xl p-8 shadow-2xl border border-white/90 w-full flex flex-col items-center">
            <RefreshCw className="w-12 h-12 animate-spin mb-4 text-[#06555A]" />
            <p className="font-extrabold text-slate-900 text-lg">Synthesizing Quiz…</p>
            <p className="text-xs text-slate-500 mt-1">Gemini AI is analyzing article semantics &amp; vocabulary</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Reading Stage ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/articles")}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-950 font-bold text-xs sm:text-sm mb-6 glass-pill px-4 py-2 rounded-full shadow-sm w-fit transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Articles
        </button>

        {/* Article Hero Image */}
        {article.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <div className="w-full h-72 rounded-3xl overflow-hidden mb-6 shadow-xl relative border border-white/80">
            <img
              src={article.image}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center flex-wrap gap-4 mb-4">
          {article.source && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 glass-pill px-3 py-1 rounded-full shadow-sm">
              <Globe className="w-3.5 h-3.5 text-[#06555A]" />
              {article.source}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 glass-pill px-3 py-1 rounded-full shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              {new Date(article.publishedAt).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </span>
          )}
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#06555A] hover:underline ml-auto"
            >
              Read original article →
            </a>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-4 tracking-tight">
          {article.title}
        </h1>

        {/* Description */}
        {article.description && (
          <p className="text-slate-700 text-sm sm:text-base leading-relaxed mb-6 font-medium">
            {article.description}
          </p>
        )}

        {/* Content */}
        {article.content && article.content !== article.description && (
          <div className="mb-8 glass-card-light rounded-3xl p-6 sm:p-8 border border-white/90 shadow-xl space-y-4">
            {article.content
              .split(/\n{2,}/)
              .map((para, i) => para.trim())
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} className="text-slate-800 text-sm sm:text-base leading-relaxed">
                  {para}
                </p>
              ))}
          </div>
        )}

        {/* Error */}
        {genError && (
          <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 mb-4 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {genError}
          </div>
        )}

        {/* Take the Quiz CTA */}
        <div className="glass-card-light border border-white/90 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1">
            <p className="text-slate-900 font-extrabold text-lg">Ready to verify your comprehension?</p>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">
              AI-generated quiz questions · Earn up to +30 XP on completion
            </p>
          </div>
          <button
            onClick={handleFinishedReading}
            className="flex items-center gap-2 px-8 py-3.5 bg-slate-950 text-white font-extrabold rounded-full hover:bg-slate-800 transition-all whitespace-nowrap shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-sm"
          >
            <BookOpen className="w-4 h-4" />
            Start Comprehension Quiz
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
