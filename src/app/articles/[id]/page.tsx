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
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.push("/articles")}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Articles
          </button>

          {/* Score Card */}
          <div className="bg-gradient-to-br from-[#3D8F8F] to-[#2f7373] rounded-3xl p-8 text-center mb-6 shadow-lg">
            <div className="text-5xl font-black text-white mb-2">
              {correctCount}/{questions.length}
            </div>
            <p className="text-white/90 text-lg font-semibold mb-4">
              {correctCount === questions.length
                ? "Perfect Score! 🎉"
                : correctCount >= questions.length / 2
                ? "Good job! 👏"
                : "Keep reading! 📚"}
            </p>
            {alreadyDone ? (
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-white text-sm">
                <CheckCircle className="w-4 h-4" />
                Already completed – XP previously awarded
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-yellow-300/30 rounded-full px-4 py-2 text-yellow-100 text-sm font-bold">
                <Star className="w-4 h-4 text-yellow-300" />
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
                  className={`rounded-2xl border p-5 ${
                    res?.isCorrect
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {res?.isCorrect
                      ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      : <XCircle    className="w-5 h-5 text-red-500   flex-shrink-0 mt-0.5" />
                    }
                    <p className="text-gray-900 font-semibold text-sm">{q.question}</p>
                  </div>
                  <div className="space-y-2 pl-8">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex;
                      const isChosen  = oi === res?.chosen;
                      return (
                        <div
                          key={oi}
                          className={`px-3 py-2 rounded-xl text-xs font-medium ${
                            isCorrect
                              ? "bg-green-100 text-green-700 border border-green-300"
                              : isChosen && !isCorrect
                              ? "bg-red-100 text-red-700 border border-red-300"
                              : "text-gray-400"
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
            className="w-full py-3 bg-[#3D8F8F] text-white font-bold rounded-2xl hover:bg-[#2f7373] transition shadow"
          >
            Read More Articles
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Quiz Stage ───────────────────────────────────────────────────────────────
  if (stage === "quiz") {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStage("reading")}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Article
          </button>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Comprehension Quiz</h2>
            <p className="text-gray-500 text-sm mt-1">
              Answer all {questions.length} questions · 10 XP per correct answer
            </p>
          </div>

          <div className="space-y-6">
            {questions.map((q, qi) => (
              <div key={qi} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-gray-900 font-semibold text-sm mb-4">
                  <span className="text-[#3D8F8F] font-bold mr-2">Q{qi + 1}.</span>
                  {q.question}
                </p>
                <div className="space-y-2.5">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => selectAnswer(qi, oi)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                          selected
                            ? "bg-[#3D8F8F] text-white border-[#3D8F8F] shadow"
                            : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-[#d0eaeb] hover:border-[#3D8F8F]/30"
                        }`}
                      >
                        <span className={`font-bold mr-2 ${selected ? "text-white" : "text-[#3D8F8F]"}`}>
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
            className="mt-8 w-full py-4 bg-[#3D8F8F] text-white font-bold rounded-2xl hover:bg-[#2f7373] transition disabled:opacity-50 shadow flex items-center justify-center gap-2"
          >
            {submitting
              ? <><RefreshCw className="w-5 h-5 animate-spin" /> Submitting…</>
              : <><Zap className="w-5 h-5" /> Submit Answers</>
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
        <div className="text-center py-32 text-gray-400">
          <RefreshCw className="w-10 h-10 mx-auto animate-spin mb-4 text-[#3D8F8F]" />
          <p className="font-semibold text-gray-700">Generating quiz questions…</p>
          <p className="text-sm mt-1">Gemini AI is reading the article</p>
        </div>
      </DashboardLayout>
    );
  }

  // ── Reading Stage ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push("/articles")}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Articles
        </button>

        {/* Article Hero Image */}
        {article.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image}
            alt=""
            className="w-full h-60 object-cover rounded-2xl mb-6 shadow-sm"
          />
        )}

        {/* Meta */}
        <div className="flex items-center flex-wrap gap-4 mb-4">
          {article.source && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
              <Globe className="w-3.5 h-3.5" />
              {article.source}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
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
              className="text-xs text-[#3D8F8F] hover:underline ml-auto"
            >
              Read original →
            </a>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-4">
          {article.title}
        </h1>

        {/* Description */}
        {article.description && (
          <p className="text-gray-700 text-base leading-relaxed mb-4 font-medium">
            {article.description}
          </p>
        )}

        {/* Content */}
        {article.content && article.content !== article.description && (
          <div className="mb-8 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
            {article.content
              .split(/\n{2,}/)
              .map((para, i) => para.trim())
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} className="text-gray-700 text-[15px] leading-relaxed">
                  {para}
                </p>
              ))}
          </div>
        )}

        {/* Error */}
        {genError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {genError}
          </div>
        )}

        {/* Take the Quiz CTA */}
        <div className="bg-[#d0eaeb] border border-[#3D8F8F]/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="text-gray-900 font-bold text-base">Ready to test your understanding?</p>
            <p className="text-gray-600 text-sm mt-0.5">
              3 questions generated by Gemini AI · Earn up to 30 XP
            </p>
          </div>
          <button
            onClick={handleFinishedReading}
            className="flex items-center gap-2 px-6 py-3 bg-[#3D8F8F] text-white font-bold rounded-xl hover:bg-[#2f7373] transition whitespace-nowrap shadow"
          >
            <BookOpen className="w-5 h-5" />
            Take the Quiz
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
