"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  BookOpen,
  CheckCircle2,
  Check,
  Lock,
  Star,
  ChevronRight,
  Globe,
  Filter,
  X,
  Zap,
  Volume2,
  VolumeX,
  Loader2,
  Headphones,
  Play,
  RotateCcw,
  Mic,
  StopCircle,
  Sparkles,
  LayoutGrid,
  Milestone,
} from "lucide-react";
import Lottie from "lottie-react";
import deliveryAnimation from "../../../public/lotti/Delivery.json";
import treeAnimation from "../../../public/lotti/Tree Lottie animation.json";

function ClimberAvatar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 90" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="30" cy="18" r="9" fill="#2563EB" />
      {/* Hair */}
      <path d="M22 14C23 8 37 8 38 14C39 18 36 21 30 21C24 21 21 18 22 14Z" fill="#FBBF24" />
      {/* Face glow */}
      <circle cx="30" cy="18" r="7" fill="#60A5FA" opacity="0.4" />
      {/* Arms reaching to ladder rails */}
      <path d="M22 30L8 16" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M38 30L52 16" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
      {/* Backpack */}
      <rect x="23" y="27" width="14" height="18" rx="4" fill="#CBD5E1" />
      <rect x="25" y="29" width="10" height="14" rx="2" fill="#3B82F6" />
      {/* Body / Shirt */}
      <rect x="22" y="26" width="16" height="20" rx="4" fill="#FFFFFF" />
      {/* Legs */}
      <path d="M25 46L17 68" stroke="#A855F7" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M35 46L43 66" stroke="#A855F7" strokeWidth="5.5" strokeLinecap="round" />
      {/* Shoes */}
      <circle cx="16" cy="70" r="4.5" fill="#EC4899" />
      <circle cx="44" cy="68" r="4.5" fill="#EC4899" />
    </svg>
  );
}

interface LessonContent {
  _id?: string;
  type: "vocabulary" | "grammar" | "quiz" | "listening" | "speaking";
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  audioText?: string;
  audioUrl?: string;  // pre-generated S3 URL (set by backend on lesson create/update)
  openEnded?: boolean; // if true, Gemini judges contextual correctness instead of word-matching
}

/** Normalise text for lenient speech matching: lowercase, strip punctuation, collapse spaces */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein edit distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Similarity ratio 0–1 between two normalised strings.
 * Bidirectional: checks how well spoken covers expected AND
 * how well expected covers spoken, so short/partial answers
 * cannot pass by accidentally matching a few common words.
 */
function speakingSimilarity(raw: string, expected: string): number {
  const a = normalize(raw);
  const b = normalize(expected);
  if (a === b) return 1;
  if (!a || !b) return 0;

  // --- Character-level similarity (penalises length differences naturally) ---
  const maxLen = Math.max(a.length, b.length);
  const charSim = 1 - levenshtein(a, b) / maxLen;

  // --- Bidirectional word-level similarity ---
  const aWords = a.split(" ");
  const bWords = b.split(" ");

  const bestMatch = (source: string[], target: string[]) =>
    source.map((sw) =>
      target.reduce((best, tw) => {
        const wLen = Math.max(sw.length, tw.length);
        const sim = wLen === 0 ? 1 : 1 - levenshtein(sw, tw) / wLen;
        return Math.max(best, sim);
      }, 0)
    ).reduce((s, v) => s + v, 0) / source.length;

  // Forward: how well spoken words match expected words
  const fwd = bestMatch(aWords, bWords);
  // Backward: how well expected words were covered by spoken words
  const bwd = bestMatch(bWords, aWords);
  // Harmonic-mean of both directions — punishes missing words hard
  const wordSim = fwd + bwd === 0 ? 0 : (2 * fwd * bwd) / (fwd + bwd);

  // Weighted blend: character similarity is the anchor, word similarity
  // adds fine-grained word-level tolerance (e.g. "Shobon" → "Shovon").
  return 0.5 * charSim + 0.5 * wordSim;
}

/** Returns true if the spoken answer is close enough to the expected phrase */
const SPEAK_THRESHOLD = 0.80; // 80% blended similarity required
function speakingCorrect(spoken: string, expected: string): boolean {
  return speakingSimilarity(spoken, expected) >= SPEAK_THRESHOLD;
}

interface Lesson {
  _id: string;
  title: string;
  description: string;
  language: string;
  level: "beginner" | "intermediate" | "advanced";
  xpReward: number;
  content: LessonContent[];
  order: number;
}

const LANGUAGES = ["All", "English", "Spanish", "French", "German", "Japanese", "Mandarin", "Portuguese"];
const LEVELS = ["All", "beginner", "intermediate", "advanced"];

const levelColors: Record<string, string> = {
  beginner: "bg-[#e0f7fa] text-[#00796b] border-[#4dd0e1]",
  intermediate: "bg-[#fff9c4] text-[#fbc02d] border-[#ffe082]",
  advanced: "bg-[#ede7f6] text-[#7e57c2] border-[#b39ddb]",
};

const typeIcons: Record<string, string> = {
  vocabulary: "📖",
  grammar: "✏️",
  quiz: "🧠",
  listening: "🎧",
  speaking: "🎤",
};

function useTTS(text: string | undefined, prebuiltUrl?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const fetchAudio = useCallback(async () => {
    // Use the pre-generated S3 URL if available — no server round-trip needed
    if (prebuiltUrl) {
      urlRef.current = prebuiltUrl;
      return prebuiltUrl;
    }
    if (!text) return null;
    setIsLoading(true);
    setError(false);
    try {
      const response = await api.get("/tts", {
        params: { text },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      return url;
    } catch {
      setError(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [text, prebuiltUrl]);

  const play = useCallback(async () => {
    let url = urlRef.current;
    if (!url) {
      url = await fetchAudio();
    }
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => { setIsPlaying(false); setHasPlayed(true); };
    audio.onerror = () => { setIsPlaying(false); setError(true); };
    audio.play();
  }, [fetchAudio]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    // Only revoke blob URLs, not external S3 URLs
    return () => {
      if (urlRef.current && urlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(urlRef.current);
      }
      urlRef.current = null;
      setIsPlaying(false);
      setHasPlayed(false);
    };
  }, [text, prebuiltUrl]);

  return { play, stop, isLoading, isPlaying, hasPlayed, error };
}

function SpeakingQuestion({
  question,
  onAnswer,
  showResult,
  selectedAnswer,
}: {
  question: LessonContent;
  onAnswer: (a: string, aiCorrect?: boolean) => void;
  showResult: boolean;
  selectedAnswer: string | null;
}) {
  const tts = useTTS(question.audioText || question.question, question.audioUrl);
  const [recState, setRecState] = useState<"idle" | "recording" | "analyzing">("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiEvaluated, setAiEvaluated] = useState<boolean | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);

  // Auto-play TTS on mount
  useEffect(() => {
    const t = setTimeout(() => tts.play(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.audioText, question.audioUrl]);

  const startRecording = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecState("analyzing");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const { data } = await api.post("/stt", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const text: string = data.text || "";
          setTranscript(text);

          if (question.openEnded) {
            // Open-ended: let Gemini judge contextual correctness
            const { data: evalData } = await api.post("/stt/evaluate", {
              transcript: text,
              question: question.question,
              correctAnswer: question.correctAnswer,
            });
            setAiFeedback(evalData.feedback || null);
            setAiEvaluated(!!evalData.correct);
            onAnswer(text, !!evalData.correct);
          } else {
            onAnswer(text);
          }
        } catch {
          setRecError("Could not process your speech. Please try again.");
          setRecState("idle");
        }
      };

      mr.start();
      setRecState("recording");
      // Auto-stop after 12 s
      setTimeout(() => {
        if (mediaRecRef.current?.state === "recording") mediaRecRef.current.stop();
      }, 12000);
    } catch {
      setRecError("Microphone access denied. Please allow microphone and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecRef.current?.state === "recording") mediaRecRef.current.stop();
  };

  // For open-ended questions, use Gemini's evaluation; otherwise word-similarity
  const isCorrect  = showResult && selectedAnswer !== null && (
    question.openEnded ? aiEvaluated === true : speakingCorrect(selectedAnswer, question.correctAnswer ?? "")
  );
  const isWrong    = showResult && selectedAnswer !== null && !isCorrect;
  const phraseText = question.audioText || question.correctAnswer || question.question;

  return (
    <div>
      {/* TTS player */}
      <div className="bg-gradient-to-br from-[#d0eaeb] to-[#b8dfe0] rounded-3xl border border-[#6FB3B8]/30 p-8 mb-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="relative w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center">
            <Headphones className="w-10 h-10 text-[#3D8F8F]" />
            {tts.isPlaying && (
              <span className="absolute inset-0 rounded-full border-4 border-[#3D8F8F] animate-ping opacity-40" />
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-[#3D8F8F] mb-3">
          {tts.isLoading ? "Loading audio..." : tts.isPlaying ? "Listen carefully..." : tts.hasPlayed ? "Listen again?" : "Tap to play"}
        </p>
        <div className="flex justify-center gap-3 mb-3">
          <button
            onClick={tts.isPlaying ? tts.stop : tts.play}
            disabled={tts.isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-[#3D8F8F] hover:bg-[#06555A] disabled:bg-gray-300 text-white font-bold rounded-2xl transition shadow-md"
          >
            {tts.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> :
              tts.isPlaying ? <VolumeX className="w-5 h-5" /> :
              <Play className="w-5 h-5" />}
            {tts.isLoading ? "Loading..." : tts.isPlaying ? "Stop" : tts.hasPlayed ? "Replay" : "Play"}
          </button>
        </div>
        {/* Show phrase after audio has played once */}
        {(tts.hasPlayed || tts.error || showResult) && (
          <p className="text-[#06555A] font-bold text-base mt-2">&ldquo;{phraseText}&rdquo;</p>
        )}
        {tts.error && (
          <p className="text-xs text-red-500 mt-1">Audio unavailable — read the phrase above and try to speak it.</p>
        )}
      </div>

      <p className="text-center text-sm font-semibold text-gray-600 mb-5">{question.question || "Listen and repeat the phrase:"}</p>

      {/* Recording controls */}
      {!showResult && (
        <div className="flex flex-col items-center gap-3">
          {recState === "idle" && (
            <>
              <button
                onClick={startRecording}
                disabled={!tts.hasPlayed && !tts.error}
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-400 text-white font-bold rounded-2xl transition shadow-lg text-base"
              >
                <Mic className="w-5 h-5" />
                Start Speaking
              </button>
              {!tts.hasPlayed && !tts.error && (
                <p className="text-xs text-gray-400">👆 Listen to the audio first, then speak</p>
              )}
            </>
          )}
          {recState === "recording" && (
            <>
              <div className="flex items-center gap-2 text-red-600 font-bold animate-pulse">
                <span className="w-3 h-3 rounded-full bg-red-600" />
                Recording... speak now
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition shadow-lg text-base"
              >
                <StopCircle className="w-5 h-5" />
                Stop Recording
              </button>
              <p className="text-xs text-gray-400">Auto-stops after 12 seconds</p>
            </>
          )}
          {recState === "analyzing" && (
            <div className="flex items-center gap-3 text-[#3D8F8F] font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" />
              {question.openEnded ? "AI is evaluating your response..." : "Checking your speech..."}
            </div>
          )}
          {recError && (
            <>
              <p className="text-sm text-red-500 text-center">{recError}</p>
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition"
              >
                <RotateCcw className="w-4 h-4" /> Try Again
              </button>
            </>
          )}
        </div>
      )}

      {/* Result banner */}
      {showResult && (
        <div className={`p-5 rounded-2xl border-2 text-center ${
          isCorrect ? "border-[#3D8F8F] bg-[#d0eaeb] text-[#06555A]" : "border-red-400 bg-red-50 text-red-800"
        }`}>
          <p className="font-bold text-lg mb-1">
            {isCorrect ? "🎉 Excellent!" : "❌ Not quite right — no XP for this one."}
          </p>
          {/* AI feedback for open-ended questions */}
          {question.openEnded && aiFeedback && (
            <p className="text-sm mt-1 italic">{aiFeedback}</p>
          )}
          {/* Word-match feedback for exact questions */}
          {!question.openEnded && isCorrect && <p className="text-sm">Your speech matched! +XP awarded ✓</p>}
          {isWrong && transcript !== null && (
            <p className="text-sm mt-1">You said: &ldquo;<em>{transcript || "(nothing detected)"}</em>&rdquo;</p>
          )}
          {isWrong && !question.openEnded && (
            <p className="text-sm mt-0.5">Expected: &ldquo;<em>{phraseText}</em>&rdquo;</p>
          )}
        </div>
      )}
    </div>
  );
}

function ListeningQuestion({
  question,
  onAnswer,
  showResult,
  selectedAnswer,
}: {
  question: LessonContent;
  onAnswer: (a: string) => void;
  showResult: boolean;
  selectedAnswer: string | null;
}) {
  // Prefer pre-generated S3 audio; fall back to live TTS API if not available
  const tts = useTTS(question.audioText || question.question, question.audioUrl);

  useEffect(() => {
    const timer = setTimeout(() => tts.play(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.audioText, question.audioUrl]);

  return (
    <div>
      <div className="bg-gradient-to-br from-[#d0eaeb] to-[#b8dfe0] rounded-3xl border border-[#6FB3B8]/30 p-8 mb-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="relative w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center">
            <Headphones className="w-10 h-10 text-[#3D8F8F]" />
            {tts.isPlaying && (
              <span className="absolute inset-0 rounded-full border-4 border-[#3D8F8F] animate-ping opacity-40" />
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-[#3D8F8F] mb-4">
          {tts.isLoading ? "Loading audio..." : tts.isPlaying ? "Playing audio..." : tts.hasPlayed ? "Listen again?" : "Tap to play"}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={tts.isPlaying ? tts.stop : tts.play}
            disabled={tts.isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-[#3D8F8F] hover:bg-[#06555A] disabled:bg-gray-300 text-white font-bold rounded-2xl transition shadow-md"
          >
            {tts.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : tts.isPlaying ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {tts.isLoading ? "Loading..." : tts.isPlaying ? "Stop" : tts.hasPlayed ? "Replay" : "Play"}
          </button>
        </div>
        {tts.error && (
          <p className="text-xs text-red-500 mt-2">Audio unavailable — answer from the text below.</p>
        )}
      </div>
      <p className="text-center text-sm font-semibold text-gray-600 mb-4">{question.question}</p>
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isCorrect = option === question.correctAnswer;
          const isSelected = option === selectedAnswer;
          let cls = "w-full p-4 rounded-2xl border-2 text-left font-semibold text-sm transition-all ";
          if (!showResult) {
            cls += "border-gray-200 hover:border-[#6FB3B8] hover:bg-[#d0eaeb] text-gray-800";
          } else if (isCorrect) {
            cls += "border-[#3D8F8F] bg-[#d0eaeb] text-[#06555A]";
          } else if (isSelected && !isCorrect) {
            cls += "border-red-400 bg-red-50 text-red-800";
          } else {
            cls += "border-gray-200 text-gray-400";
          }
          return (
            <button key={`${option}-${idx}`} className={cls} onClick={() => !showResult && onAnswer(option)}>
              {isCorrect && showResult && <CheckCircle2 className="inline w-4 h-4 mr-2 text-[#3D8F8F]" />}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StandardQuestion({
  question,
  onAnswer,
  showResult,
  selectedAnswer,
}: {
  question: LessonContent;
  onAnswer: (a: string) => void;
  showResult: boolean;
  selectedAnswer: string | null;
}) {
  return (
    <div>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 mb-4">
        <p className="text-xs font-bold text-[#3D8F8F] uppercase tracking-widest mb-3">
          {typeIcons[question.type] || "❓"} {question.type}
        </p>
        <h3 className="text-xl font-bold text-gray-900">{question.question}</h3>
      </div>
      <div className="flex justify-center mb-4">
        <Lottie animationData={deliveryAnimation} loop className="w-36 h-36" style={{ background: "transparent" }} />
      </div>
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isCorrect = option === question.correctAnswer;
          const isSelected = option === selectedAnswer;
          let cls = "w-full p-4 rounded-2xl border-2 text-left font-semibold text-sm transition-all ";
          if (!showResult) {
            cls += "border-gray-200 hover:border-[#6FB3B8] hover:bg-[#d0eaeb] text-gray-800";
          } else if (isCorrect) {
            cls += "border-[#3D8F8F] bg-[#d0eaeb] text-[#06555A]";
          } else if (isSelected && !isCorrect) {
            cls += "border-red-400 bg-red-50 text-red-800";
          } else {
            cls += "border-gray-200 text-gray-400";
          }
          return (
            <button key={`${option}-${idx}`} className={cls} onClick={() => !showResult && onAnswer(option)}>
              {isCorrect && showResult && <CheckCircle2 className="inline w-4 h-4 mr-2 text-[#3D8F8F]" />}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LessonsContent() {
  const { user, updateUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(searchParams.get("language") || "All");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  // "main" = listening/MCQ, "speaking" = speak practice, "done" = completion
  const [phase, setPhase] = useState<"main" | "speaking" | "done">("main");
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [speakScore, setSpeakScore] = useState(0);
  const [listTab, setListTab] = useState<"lessons" | "speaking">("lessons");
  const [viewMode, setViewMode] = useState<"path" | "grid">("path");

  useEffect(() => {
    const fetchLessons = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (selectedLanguage !== "All") params.language = selectedLanguage;
        if (selectedLevel !== "All") params.level = selectedLevel;
        const { data } = await api.get("/lessons", { params });
        setLessons(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    const fetchUser = async () => {
      try {
        const { data } = await api.get("/users/me");
        setCompletedIds(data.completedLessons?.map((l: { _id: string }) => l._id) || []);
      } catch { /* ignore */ }
    };
    fetchLessons();
    fetchUser();
  }, [selectedLanguage, selectedLevel]);

  const startLesson = (lesson: Lesson, startPhase: "main" | "speaking" = "main") => {
    setActiveLesson(lesson);
    setPhase(startPhase);
    setQuizIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setSpeakScore(0);
  };

  const playFeedback = (correct: boolean) => {
    const src = correct
      ? "/audio/u_3bsnvt0dsu-successed-295058.mp3"
      : "/audio/freesound_community-wronganswer-37702.mp3";
    const audio = new Audio(src);
    audio.play().catch(() => {/* ignore autoplay block */});
  };

  // Derived content split
  const mainContent  = activeLesson?.content.filter((c) => c.type !== "speaking") ?? [];
  const speakContent = activeLesson?.content.filter((c) => c.type === "speaking") ?? [];
  const phaseContent = phase === "speaking" ? speakContent : mainContent;
  const currentQuestion = phaseContent[quizIndex];

  const handleAnswer = (answer: string, aiCorrect?: boolean) => {
    if (showResult) return;
    setSelectedAnswer(answer);
    setShowResult(true);
    const q = phaseContent[quizIndex];
    if (phase === "speaking") {
      // Open-ended questions: use Gemini's verdict; word-match questions: use similarity
      const correct = q.openEnded ? !!aiCorrect : speakingCorrect(answer, q.correctAnswer ?? "");
      if (correct) setSpeakScore((s) => s + 1);
      playFeedback(correct);
    } else {
      if (answer === q.correctAnswer) setScore((s) => s + 1);
      playFeedback(answer === q.correctAnswer);
    }
  };

  const handleNext = async () => {
    const isLast = quizIndex >= phaseContent.length - 1;
    if (isLast) {
      if (phase === "main") {
        try {
          const { data } = await api.post(`/lessons/${activeLesson!._id}/complete`);
          setCompletedIds((prev) => [...prev, activeLesson!._id]);
          if (data.xp !== undefined) updateUser({ xp: data.xp, streak: data.streak, coins: data.coins });
        } catch { /* ignore */ }
      }
      setPhase("done");
    } else {
      setQuizIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  if (activeLesson) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          {phase !== "done" ? (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveLesson(null)}
                    className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                  <div>
                    <h2 className="font-bold text-gray-900">{activeLesson.title}</h2>
                    <p className="text-xs text-gray-500">{activeLesson.language}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-500">
                    {quizIndex + 1} / {phaseContent.length}
                  </span>
                  {currentQuestion?.type === "listening" && (
                    <p className="text-xs text-[#3D8F8F] font-medium flex items-center justify-end gap-1 mt-0.5">
                      <Volume2 className="w-3 h-3" /> Listening
                    </p>
                  )}
                  {currentQuestion?.type === "speaking" && (
                    <p className="text-xs text-green-600 font-medium flex items-center justify-end gap-1 mt-0.5">
                      <Mic className="w-3 h-3" /> Speak Practice
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
                <div
                  className={`h-2 rounded-full transition-all ${
                    phase === "speaking" ? "bg-green-500" : "bg-[#3D8F8F]"
                  }`}
                  style={{ width: `${((quizIndex + 1) / phaseContent.length) * 100}%` }}
                />
              </div>

              {currentQuestion && (
                <div>
                  {currentQuestion.type === "listening" ? (
                    <ListeningQuestion
                      key={quizIndex}
                      question={currentQuestion}
                      onAnswer={handleAnswer}
                      showResult={showResult}
                      selectedAnswer={selectedAnswer}
                    />
                  ) : currentQuestion.type === "speaking" ? (
                    <SpeakingQuestion
                      key={quizIndex}
                      question={currentQuestion}
                      onAnswer={handleAnswer}
                      showResult={showResult}
                      selectedAnswer={selectedAnswer}
                    />
                  ) : (
                    <StandardQuestion
                      key={quizIndex}
                      question={currentQuestion}
                      onAnswer={handleAnswer}
                      showResult={showResult}
                      selectedAnswer={selectedAnswer}
                    />
                  )}

                  {showResult && currentQuestion.explanation && currentQuestion.type !== "speaking" && (
                    <div
                      className={`mt-4 p-4 rounded-2xl text-sm font-medium ${
                        selectedAnswer === currentQuestion.correctAnswer
                          ? "bg-[#d0eaeb] text-[#06555A] border border-[#6FB3B8]/40"
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      💡 {currentQuestion.explanation}
                    </div>
                  )}
                  {showResult && currentQuestion.explanation && currentQuestion.type === "speaking" && (
                    <div className="mt-4 p-4 rounded-2xl text-sm font-medium bg-[#d0eaeb] text-[#06555A] border border-[#6FB3B8]/40">
                      💡 {currentQuestion.explanation}
                    </div>
                  )}

                  {showResult && (
                    <button
                      onClick={handleNext}
                      className={`w-full mt-6 text-white font-bold py-4 rounded-2xl transition shadow-md ${
                        phase === "speaking"
                          ? "bg-green-500 hover:bg-emerald-600 shadow-green-200"
                          : "bg-[#3D8F8F] hover:bg-[#06555A] shadow-[#6FB3B8]/30"
                      }`}
                    >
                      {quizIndex >= phaseContent.length - 1 ? "Finish" : "Next →"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="flex justify-center">
                <Lottie animationData={treeAnimation} loop className="w-48 h-48" style={{ background: "transparent" }} />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {listTab === "speaking" ? "Speaking Practice Done! 🎉" : "Lesson Complete! 🎉"}
              </h2>

              {/* Score card */}
              <div className="flex gap-3 justify-center mb-5">
                {listTab !== "speaking" && (
                  <div className="bg-[#d0eaeb] border border-[#6FB3B8]/40 rounded-2xl px-8 py-5 text-center">
                    <p className="text-xs font-bold text-[#3D8F8F] uppercase tracking-wide mb-1">📚 Score</p>
                    <p className="text-3xl font-bold text-[#06555A]">{score}<span className="text-lg font-semibold text-gray-400"> / {mainContent.length}</span></p>
                  </div>
                )}
                {listTab === "speaking" && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl px-8 py-5 text-center">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">🎤 Speaking Score</p>
                    <p className="text-3xl font-bold text-green-700">{speakScore}<span className="text-lg font-semibold text-gray-400"> / {speakContent.length}</span></p>
                  </div>
                )}
              </div>

              <p className="text-gray-400 text-sm mb-6">
                {listTab === "speaking"
                  ? speakScore === speakContent.length ? "Perfect! All phrases spoken correctly! 🎉" : speakScore >= speakContent.length / 2 ? "Good effort! Keep practising." : "Keep going — practice makes perfect!"
                  : score === mainContent.length ? "Perfect score! 🎉" : score >= mainContent.length / 2 ? "Great job! Keep practising." : "Keep going — practice makes perfect!"}
              </p>
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="flex items-center gap-2 text-yellow-600 font-bold text-lg">
                  <Star className="w-6 h-6 text-yellow-500" />
                  +{activeLesson.xpReward} XP earned
                </div>
                <div className="flex items-center gap-2 text-amber-600 font-bold text-lg">
                  <span className="text-xl">🪙</span>
                  +{Math.max(5, Math.ceil(activeLesson.xpReward / 10))} coins
                </div>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => startLesson(activeLesson, listTab === "speaking" ? "speaking" : "main")}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Try Again
                </button>
                <button
                  onClick={() => setActiveLesson(null)}
                  className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-2xl transition"
                >
                  Back to Lessons
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="px-6 py-3 bg-[#3D8F8F] hover:bg-[#06555A] text-white font-bold rounded-2xl transition shadow-md shadow-[#6FB3B8]/30"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header with Title and Mode Switchers */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/80 backdrop-blur-md text-[#7c3aed] border border-white shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#7c3aed]" />
                Fluency Journey
              </span>
              <span className="text-xs font-bold text-white drop-shadow">
                {completedIds.length}/{lessons.length} Lessons Cleared
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
              Learning Roadmap
            </h1>
            <p className="text-slate-100/90 text-sm font-medium mt-1 drop-shadow">
              {user?.role === "professional"
                ? "Ascend your business fluency track one level at a time"
                : "Climb the ladder to natural language mastery"}
            </p>
          </div>

          {/* View Mode & Mode Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Standard / Speaking toggle */}
            <div className="flex items-center gap-1 p-1 bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-sm">
              <button
                onClick={() => setListTab("lessons")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition ${
                  listTab === "lessons"
                    ? "bg-[#06555A] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Lessons</span>
              </button>
              <button
                onClick={() => setListTab("speaking")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition ${
                  listTab === "speaking"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Speak</span>
              </button>
            </div>

            {/* Path / Grid View Switch */}
            <div className="flex items-center gap-1 p-1 bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-sm">
              <button
                onClick={() => setViewMode("path")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition ${
                  viewMode === "path"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Pathway Ladder View"
              >
                <Milestone className="w-3.5 h-3.5" />
                <span>Path</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition ${
                  viewMode === "grid"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter HUD */}
        <div className="bg-white/85 backdrop-blur-2xl rounded-3xl border border-white shadow-lg p-4 text-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#06555A]" /> Language:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      selectedLanguage === lang
                        ? "bg-[#06555A] text-white shadow-sm"
                        : "bg-white/70 text-slate-700 hover:bg-white border border-slate-200/60"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-purple-600" /> Level:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                      selectedLevel === level
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-white/70 text-slate-700 hover:bg-white border border-slate-200/60"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <Lottie animationData={treeAnimation} loop className="w-24 h-24 mb-4" style={{ background: "transparent" }} />
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="mt-3 text-white font-bold text-sm tracking-wider drop-shadow">Loading Roadmap...</span>
          </div>
        ) : (() => {
          const filtered = lessons.filter((l) =>
            listTab === "speaking"
              ? l.content.some((c) => c.type === "speaking")
              : l.content.some((c) => c.type !== "speaking")
          );

          if (filtered.length === 0) return (
            <div className="text-center py-20 bg-white/80 backdrop-blur-2xl rounded-3xl border border-white p-8 shadow-xl">
              <Lottie animationData={deliveryAnimation} loop className="w-32 h-32 mx-auto mb-4" style={{ background: "transparent" }} />
              <h3 className="text-xl font-bold text-slate-800">
                {listTab === "speaking" ? "No Voice Lessons Found" : "No Lessons Found"}
              </h3>
              <p className="text-slate-500 text-sm mt-1">Try selecting a different language or level filter</p>
            </div>
          );

          const activeIndex = filtered.findIndex((l) => !completedIds.includes(l._id));
          const currentActiveId = activeIndex !== -1 ? filtered[activeIndex]._id : filtered[0]?._id;

          /* PATHWAY LADDER VIEW (INSPIRED BY USER IMAGE) */
          if (viewMode === "path") {
            return (
              <div className="relative py-12 px-2 max-w-4xl mx-auto overflow-hidden">
                {/* Center Ladder Rails */}
                <div className="absolute top-8 bottom-8 left-1/2 -translate-x-1/2 w-16 sm:w-20 flex justify-between px-2 sm:px-3 pointer-events-none z-0">
                  <div className="w-3 sm:w-3.5 h-full bg-gradient-to-b from-[#d8b4fe] via-[#c4b5fd] to-[#a78bfa] rounded-full shadow-[0_0_15px_rgba(196,181,253,0.7)] border border-white/50" />
                  <div className="w-3 sm:w-3.5 h-full bg-gradient-to-b from-[#d8b4fe] via-[#c4b5fd] to-[#a78bfa] rounded-full shadow-[0_0_15px_rgba(196,181,253,0.7)] border border-white/50" />
                </div>

                {/* Vertical Nodes List */}
                <div className="space-y-16 sm:space-y-20 relative z-10">
                  {filtered.map((lesson, idx) => {
                    const isCompleted = completedIds.includes(lesson._id);
                    const isActive = lesson._id === currentActiveId && !isCompleted;
                    const isLocked = !isCompleted && !isActive;
                    const isLeft = idx % 2 === 0;

                    return (
                      <div
                        key={lesson._id}
                        className="relative flex items-center justify-center min-h-[140px]"
                        style={{ animation: `fadeInUp 0.4s ease ${(idx * 0.06).toFixed(2)}s both` }}
                      >
                        {/* Horizontal Rung Bar Across Rails */}
                        <div className="absolute left-1/2 -translate-x-1/2 w-24 sm:w-28 h-3.5 sm:h-4 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-white z-0 flex items-center justify-center" />

                        {/* Center Milestone Badge */}
                        <div className="relative z-20">
                          {isCompleted ? (
                            <button
                              onClick={() => startLesson(lesson, listTab === "speaking" ? "speaking" : "main")}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#65a30d] to-[#84cc16] text-white flex items-center justify-center shadow-[0_4px_20px_rgba(132,204,22,0.65)] border-4 border-white hover:scale-110 active:scale-95 transition-all"
                              title="Completed! Click to review"
                            >
                              <Check className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3.5]" />
                            </button>
                          ) : isActive ? (
                            <div className="relative">
                              <button
                                onClick={() => startLesson(lesson, listTab === "speaking" ? "speaking" : "main")}
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-[#f59e0b] to-[#fbbf24] text-white flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.85)] border-4 border-white animate-bounce-subtle hover:scale-110 active:scale-95 transition-all"
                                title="Current Lesson - Click to start!"
                              >
                                <Star className="w-7 h-7 sm:w-8 sm:h-8 fill-white stroke-white stroke-[2]" />
                              </button>
                              {/* Climber Character Avatar */}
                              <div className="absolute -top-12 -right-10 sm:-right-12 w-14 h-18 sm:w-16 sm:h-20 pointer-events-none animate-wiggle">
                                <ClimberAvatar className="w-full h-full drop-shadow-md" />
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => startLesson(lesson, listTab === "speaking" ? "speaking" : "main")}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 backdrop-blur-md text-slate-400 flex items-center justify-center shadow-md border-4 border-white hover:scale-105 transition-all"
                              title="Locked - Click to unlock"
                            >
                              <Lock className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                            </button>
                          )}
                        </div>

                        {/* Connected Floating Lesson Card (Left / Right Layout) */}
                        <div
                          className={`w-full flex ${
                            isLeft ? "justify-start md:pr-24" : "justify-end md:pl-24"
                          } pointer-events-none`}
                        >
                          <div
                            onClick={() => startLesson(lesson, listTab === "speaking" ? "speaking" : "main")}
                            className={`pointer-events-auto w-[85%] sm:w-[320px] md:w-[360px] rounded-3xl p-5 sm:p-6 transition-all duration-300 transform hover:scale-[1.03] active:scale-95 cursor-pointer select-none ${
                              isActive
                                ? "bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#9333ea] text-white shadow-[0_20px_45px_rgba(124,58,237,0.4)] border-2 border-white/40 ring-4 ring-purple-400/20"
                                : isCompleted
                                ? "bg-white/95 backdrop-blur-2xl text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.06)] border border-white hover:shadow-xl"
                                : "bg-white/80 backdrop-blur-md text-slate-800 shadow-md border border-white/70 hover:bg-white/95 hover:shadow-lg opacity-90"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3
                                className={`text-base sm:text-lg font-black tracking-tight ${
                                  isActive ? "text-white drop-shadow" : "text-slate-900"
                                }`}
                              >
                                {lesson.title}
                              </h3>
                              <span
                                className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 ${
                                  isActive
                                    ? "bg-white/20 text-white border-white/30"
                                    : isCompleted
                                    ? "bg-lime-50 text-lime-700 border-lime-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                {lesson.level}
                              </span>
                            </div>

                            <p
                              className={`text-xs sm:text-sm line-clamp-2 leading-relaxed mb-4 ${
                                isActive ? "text-purple-100" : "text-slate-600"
                              }`}
                            >
                              {lesson.description}
                            </p>

                            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                                    isActive
                                      ? "bg-white/20 text-white"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <Globe className="w-3 h-3" />
                                  {lesson.language}
                                </span>
                                <span
                                  className={`text-xs font-black px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                                    isActive
                                      ? "bg-amber-400 text-slate-950 shadow-sm"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  <Zap className="w-3 h-3 fill-current" />
                                  +{lesson.xpReward} XP
                                </span>
                              </div>

                              <span
                                className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                                  isActive
                                    ? "text-yellow-300 group-hover:underline"
                                    : isCompleted
                                    ? "text-[#06555A]"
                                    : "text-purple-600"
                                }`}
                              >
                                {isActive ? "Continue →" : isCompleted ? "Review" : "Start"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          /* GRID VIEW */
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {filtered.map((lesson, idx) => {
                const isCompleted = completedIds.includes(lesson._id);
                const isLocked = false;
                const hasListening = lesson.content.some((c) => c.type === "listening");

                return (
                  <div
                    key={lesson._id}
                    onClick={() => startLesson(lesson, listTab === "speaking" ? "speaking" : "main")}
                    className="glass-card-light rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.025] hover:shadow-2xl border border-white cursor-pointer group relative overflow-hidden"
                    style={{ animation: `fadeInUp 0.4s ease ${(idx * 0.05).toFixed(2)}s both` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${
                          isCompleted
                            ? "bg-lime-500 text-white shadow-lime-200"
                            : listTab === "speaking"
                            ? "bg-emerald-500 text-white shadow-emerald-200"
                            : "bg-[#06555A] text-white shadow-teal-200"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : isLocked ? (
                          <Lock className="w-6 h-6" />
                        ) : listTab === "speaking" ? (
                          <Mic className="w-6 h-6" />
                        ) : (
                          <BookOpen className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasListening && listTab !== "speaking" && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 shadow-sm">
                            <Headphones className="w-3 h-3" /> Voice
                          </span>
                        )}
                        <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border shadow-sm bg-slate-100 text-slate-700 border-slate-200">
                          {lesson.level}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-slate-900 mb-1 text-lg group-hover:text-[#06555A] transition-colors">
                      {lesson.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                      {lesson.description}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                          <Globe className="w-3 h-3" />
                          {lesson.language}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                          <Zap className="w-3 h-3 text-amber-500" />
                          +{lesson.xpReward} XP
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startLesson(lesson, listTab === "speaking" ? "speaking" : "main");
                        }}
                        className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider px-4 py-2 rounded-xl transition shadow-md ${
                          isCompleted
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            : listTab === "speaking"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-[#06555A] hover:bg-[#054347] text-white"
                        }`}
                      >
                        {isCompleted ? "Review" : listTab === "speaking" ? "Practise" : "Start"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      
      </div>
    </DashboardLayout>
  );
}

export default function LessonsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="w-10 h-10 border-4 border-[#3D8F8F] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LessonsContent />
    </Suspense>
  );
}
