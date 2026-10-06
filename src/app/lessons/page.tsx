"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  BookOpen,
  CheckCircle2,
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
  Flame,
} from "lucide-react";
import Lottie from "lottie-react";
import deliveryAnimation from "../../../public/lotti/Delivery.json";
import treeAnimation from "../../../public/lotti/Tree Lottie animation.json";

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

const levelStyles: Record<string, {
  badge: string;
  glowBar: string;
  iconBg: string;
  tierLabel: string;
  accentBorder: string;
}> = {
  beginner: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    glowBar: "from-emerald-400 via-teal-400 to-cyan-500",
    iconBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
    tierLabel: "Tier I • Novice",
    accentBorder: "hover:border-emerald-400/70 hover:shadow-emerald-500/20",
  },
  intermediate: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    glowBar: "from-amber-400 via-orange-400 to-rose-500",
    iconBg: "bg-amber-500/20 text-amber-300 border-amber-400/40",
    tierLabel: "Tier II • Adept",
    accentBorder: "hover:border-amber-400/70 hover:shadow-amber-500/20",
  },
  advanced: {
    badge: "bg-purple-500/15 text-purple-300 border-purple-400/30",
    glowBar: "from-purple-400 via-fuchsia-400 to-pink-500",
    iconBg: "bg-purple-500/20 text-purple-300 border-purple-400/40",
    tierLabel: "Tier III • Master",
    accentBorder: "hover:border-purple-400/70 hover:shadow-purple-500/20",
  },
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
  const tts = useTTS(question.audioText || question.question, question.audioUrl);

  useEffect(() => {
    const timer = setTimeout(() => tts.play(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.audioText, question.audioUrl]);

  return (
    <div>
      <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 mb-6 text-center text-white shadow-inner">
        <div className="flex justify-center mb-3">
          <div className="relative w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 shadow-lg flex items-center justify-center">
            <Headphones className="w-8 h-8 text-cyan-300" />
            {tts.isPlaying && (
              <span className="absolute inset-0 rounded-2xl border-2 border-cyan-400 animate-ping opacity-40" />
            )}
          </div>
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
          {tts.isLoading ? "Loading Audio Frequency..." : tts.isPlaying ? "Playing Audio Stream..." : tts.hasPlayed ? "Replay Audio Clip" : "Tap to Play"}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={tts.isPlaying ? tts.stop : tts.play}
            disabled={tts.isLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#06555A] to-[#0ea5e9] hover:from-[#08737a] hover:to-[#38bdf8] disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md"
          >
            {tts.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : tts.isPlaying ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {tts.isLoading ? "Loading..." : tts.isPlaying ? "Stop" : tts.hasPlayed ? "Replay" : "Play Audio"}
          </button>
        </div>
        {tts.error && (
          <p className="text-xs text-rose-400 mt-2">Audio unavailable — please answer from the prompt text.</p>
        )}
      </div>

      <p className="text-center text-sm font-bold text-slate-200 mb-4">{question.question}</p>

      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isCorrect = option === question.correctAnswer;
          const isSelected = option === selectedAnswer;
          let cls = "w-full p-4 rounded-2xl border-2 text-left font-bold text-sm transition-all ";
          if (!showResult) {
            cls += "border-slate-700/80 bg-slate-800/80 hover:border-cyan-400 hover:bg-slate-800 text-white shadow-sm";
          } else if (isCorrect) {
            cls += "border-emerald-500 bg-emerald-500/20 text-emerald-200 shadow-md shadow-emerald-950";
          } else if (isSelected && !isCorrect) {
            cls += "border-rose-500 bg-rose-500/20 text-rose-200 shadow-md shadow-rose-950";
          } else {
            cls += "border-slate-800 bg-slate-900/50 text-slate-500";
          }
          return (
            <button key={`${option}-${idx}`} className={cls} onClick={() => !showResult && onAnswer(option)}>
              {isCorrect && showResult && <CheckCircle2 className="inline w-4 h-4 mr-2 text-emerald-400" />}
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
      <div className="bg-slate-800/90 rounded-3xl border border-slate-700/80 p-6 mb-5 text-white shadow-inner">
        <p className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <span>{typeIcons[question.type] || "❓"}</span>
          <span>{question.type} Challenge</span>
        </p>
        <h3 className="text-lg sm:text-xl font-black text-white">{question.question}</h3>
      </div>

      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isCorrect = option === question.correctAnswer;
          const isSelected = option === selectedAnswer;
          let cls = "w-full p-4 rounded-2xl border-2 text-left font-bold text-sm transition-all ";
          if (!showResult) {
            cls += "border-slate-700/80 bg-slate-800/80 hover:border-cyan-400 hover:bg-slate-800 text-white shadow-sm";
          } else if (isCorrect) {
            cls += "border-emerald-500 bg-emerald-500/20 text-emerald-200 shadow-md shadow-emerald-950";
          } else if (isSelected && !isCorrect) {
            cls += "border-rose-500 bg-rose-500/20 text-rose-200 shadow-md shadow-rose-950";
          } else {
            cls += "border-slate-800 bg-slate-900/50 text-slate-500";
          }
          return (
            <button key={`${option}-${idx}`} className={cls} onClick={() => !showResult && onAnswer(option)}>
              {isCorrect && showResult && <CheckCircle2 className="inline w-4 h-4 mr-2 text-emerald-400" />}
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
            <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveLesson(null)}
                    className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all shadow-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="font-black text-lg text-white tracking-tight">{activeLesson.title}</h2>
                    <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{activeLesson.language}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase tracking-wider bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700 text-slate-300">
                    {quizIndex + 1} / {phaseContent.length}
                  </span>
                  {currentQuestion?.type === "listening" && (
                    <p className="text-xs text-cyan-400 font-bold flex items-center justify-end gap-1 mt-1.5">
                      <Volume2 className="w-3.5 h-3.5" /> Audio Quest
                    </p>
                  )}
                  {currentQuestion?.type === "speaking" && (
                    <p className="text-xs text-emerald-400 font-bold flex items-center justify-end gap-1 mt-1.5">
                      <Mic className="w-3.5 h-3.5" /> Voice Challenge
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800/90 rounded-full h-2.5 mb-8 overflow-hidden p-0.5 border border-slate-700/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${
                    phase === "speaking" ? "from-emerald-500 to-teal-400" : "from-[#06555A] to-cyan-400"
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

                  {showResult && currentQuestion.explanation && (
                    <div
                      className={`mt-5 p-4 rounded-2xl text-xs font-semibold leading-relaxed border ${
                        selectedAnswer === currentQuestion.correctAnswer || currentQuestion.type === "speaking"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      💡 {currentQuestion.explanation}
                    </div>
                  )}

                  {showResult && (
                    <button
                      onClick={handleNext}
                      className={`w-full mt-6 text-white font-extrabold text-sm uppercase tracking-wider py-4 rounded-2xl transition-all duration-200 shadow-lg ${
                        phase === "speaking"
                          ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-950/60"
                          : "bg-gradient-to-r from-[#06555A] to-[#0ea5e9] hover:from-[#08737a] hover:to-[#38bdf8] shadow-cyan-950/60"
                      }`}
                    >
                      {quizIndex >= phaseContent.length - 1 ? "Complete Mission →" : "Next Stage →"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/80 rounded-3xl p-8 sm:p-12 text-center text-white shadow-2xl">
              <div className="flex justify-center mb-2">
                <Lottie animationData={treeAnimation} loop className="w-44 h-44" style={{ background: "transparent" }} />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">
                {listTab === "speaking" ? "Voice Quest Cleared! 🎙️" : "Mission Mastered! 🏆"}
              </h2>
              <p className="text-slate-300 text-sm font-medium mb-6">
                {listTab === "speaking"
                  ? speakScore === speakContent.length ? "Flawless pronunciation across all phrases!" : "Solid progress! Keep training your ear and voice."
                  : score === mainContent.length ? "Flawless victory! All answers correct." : "Great effort! Review and master the tricky spots."}
              </p>

              {/* Score card */}
              <div className="flex gap-4 justify-center mb-6">
                {listTab !== "speaking" && (
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl px-8 py-5 text-center shadow-inner">
                    <p className="text-xs font-black text-cyan-400 uppercase tracking-wider mb-1">Accuracy Score</p>
                    <p className="text-4xl font-black text-white">{score}<span className="text-lg font-bold text-slate-400"> / {mainContent.length}</span></p>
                  </div>
                )}
                {listTab === "speaking" && (
                  <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-8 py-5 text-center shadow-inner">
                    <p className="text-xs font-black text-emerald-300 uppercase tracking-wider mb-1">Voice Mastery</p>
                    <p className="text-4xl font-black text-emerald-200">{speakScore}<span className="text-lg font-bold text-emerald-400/60"> / {speakContent.length}</span></p>
                  </div>
                )}
              </div>

              {/* Reward Pills */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-400/40 px-4 py-2 rounded-2xl font-black text-sm shadow-inner">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  +{activeLesson.xpReward} XP Earned
                </div>
                <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 border border-yellow-400/40 px-4 py-2 rounded-2xl font-black text-sm shadow-inner">
                  <span className="text-base">🪙</span>
                  +{Math.max(5, Math.ceil(activeLesson.xpReward / 10))} Coins
                </div>
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => startLesson(activeLesson, listTab === "speaking" ? "speaking" : "main")}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition flex items-center gap-2 shadow-md"
                >
                  <RotateCcw className="w-4 h-4" /> Replay
                </button>
                <button
                  onClick={() => setActiveLesson(null)}
                  className="px-6 py-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition"
                >
                  Quest Board
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="px-6 py-3 bg-gradient-to-r from-[#06555A] to-[#0ea5e9] hover:from-[#08737a] hover:to-[#38bdf8] text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-cyan-950/60"
                >
                  Dashboard →
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Gaming Quest Board Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                ⚡ Mission Board
              </span>
              <span className="text-xs font-bold text-slate-300">
                {completedIds.length}/{lessons.length} Quests Mastered
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
              Language Quests
            </h1>
            <p className="text-slate-300 text-sm font-medium mt-1">
              {user?.role === "professional"
                ? "Conquer professional scenarios tailored for real-world fluency"
                : "Level up your fluency one interactive mission at a time"}
            </p>
          </div>

          {/* Top-level Mode Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 backdrop-blur-2xl rounded-2xl border border-slate-700/80 shadow-xl">
            <button
              onClick={() => setListTab("lessons")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 ${
                listTab === "lessons"
                  ? "bg-gradient-to-r from-[#06555A] to-[#0ea5e9] text-white shadow-lg shadow-cyan-900/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Standard Quests</span>
            </button>
            <button
              onClick={() => setListTab("speaking")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 ${
                listTab === "speaking"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-900/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Voice Lab</span>
            </button>
          </div>
        </div>

        {/* High-Tech Gaming Filter HUD */}
        <div className="bg-slate-900/85 backdrop-blur-2xl rounded-3xl border border-slate-700/80 shadow-2xl p-5 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Language filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 min-w-[70px]">
                <Globe className="w-3.5 h-3.5" /> Language
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                      selectedLanguage === lang
                        ? "bg-[#06555A] text-cyan-200 border border-cyan-400/50 shadow-md shadow-cyan-950"
                        : "bg-slate-800/80 text-slate-400 border border-slate-700/80 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Level filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5 min-w-[70px]">
                <Filter className="w-3.5 h-3.5" /> Tier
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all duration-200 ${
                      selectedLevel === level
                        ? "bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-md shadow-amber-950"
                        : "bg-slate-800/80 text-slate-400 border border-slate-700/80 hover:text-white hover:bg-slate-800"
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
            <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="mt-3 text-cyan-300 font-bold text-sm tracking-wider uppercase">Loading Quests...</span>
          </div>
        ) : (() => {
          const filtered = lessons.filter((l) =>
            listTab === "speaking"
              ? l.content.some((c) => c.type === "speaking")
              : l.content.some((c) => c.type !== "speaking")
          );
          if (filtered.length === 0) return (
            <div className="text-center py-20 animate-fade-in bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-slate-700/80 p-8">
              <Lottie animationData={deliveryAnimation} loop className="w-32 h-32 mx-auto mb-4" style={{ background: "transparent" }} />
              <h3 className="text-xl font-bold text-white">
                {listTab === "speaking" ? "No Voice Quests Found" : "No Quests Found"}
              </h3>
              <p className="text-slate-400 text-sm mt-1">Try switching languages or tier filters above</p>
            </div>
          );
          return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {filtered.map((lesson, idx) => {
              const isCompleted = completedIds.includes(lesson._id);
              const isLocked = false;
              const hasListening = lesson.content.some((c) => c.type === "listening");
              const currentStyle = levelStyles[lesson.level] || levelStyles.beginner;

              return (
                <div
                  key={lesson._id}
                  className={`bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-slate-700/80 p-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(6,182,212,0.25)] group relative overflow-hidden ${
                    currentStyle.accentBorder
                  }`}
                  style={{ animation: `fadeInUp 0.4s ease ${(idx * 0.05).toFixed(2)}s both` }}
                >
                  {/* Top Glowing Tier Accent Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${currentStyle.glowBar}`} />

                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      {/* Quest Crest Icon */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg transition-transform duration-300 group-hover:scale-110 ${
                          isCompleted
                            ? "bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-amber-950/50"
                            : isLocked
                            ? "bg-slate-800 text-slate-500 border-slate-700"
                            : listTab === "speaking"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-emerald-950/50"
                            : currentStyle.iconBg
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-amber-400" />
                        ) : isLocked ? (
                          <Lock className="w-6 h-6 text-slate-500" />
                        ) : listTab === "speaking" ? (
                          <Mic className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <BookOpen className="w-6 h-6 text-cyan-400" />
                        )}
                      </div>

                      {/* Badges / Tier */}
                      <div className="flex items-center gap-2">
                        {hasListening && listTab !== "speaking" && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-purple-500/15 text-purple-300 border border-purple-400/30 flex items-center gap-1 shadow-sm">
                            <Headphones className="w-3 h-3" /> AUDIO
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border shadow-sm ${currentStyle.badge}`}>
                          {currentStyle.tierLabel}
                        </span>
                      </div>
                    </div>

                    {/* Quest Title & Lore */}
                    <h3 className="font-black text-white text-lg tracking-tight group-hover:text-cyan-300 transition-colors drop-shadow-sm mb-1.5">
                      {lesson.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-300 line-clamp-2 leading-relaxed mb-4">
                      {lesson.description}
                    </p>

                    {/* Skill Loot Modules */}
                    {listTab !== "speaking" && (
                      <div className="flex gap-2 flex-wrap mb-4">
                        {Array.from(new Set(lesson.content.map((c) => c.type).filter((t) => t !== "speaking"))).map((t) => (
                          <span 
                            key={t} 
                            className="text-xs px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 font-bold capitalize shadow-sm flex items-center gap-1.5"
                          >
                            <span>{typeIcons[t]}</span>
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {listTab === "speaking" && (
                      <div className="flex gap-2 flex-wrap mb-4">
                        <span className="text-xs px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-bold shadow-sm flex items-center gap-1.5">
                          <span>🎙️</span>
                          <span>{lesson.content.filter((c) => c.type === "speaking").length} Voice Challenges</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Loot & CTA */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-800/70 border border-slate-700 px-2 py-1 rounded-lg">
                        <Globe className="w-3 h-3 text-cyan-400" />
                        {lesson.language}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-black text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-lg shadow-inner">
                        <Zap className="w-3 h-3 text-amber-400" />
                        +{lesson.xpReward} XP
                      </span>
                    </div>

                    {!isLocked && (
                      <button
                        onClick={() => startLesson(lesson, listTab === "speaking" ? "speaking" : "main")}
                        className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider px-4 py-2 rounded-xl transition-all duration-200 shadow-md ${
                          isCompleted
                            ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 hover:border-amber-400/80 shadow-amber-950/40"
                            : listTab === "speaking"
                            ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/60 hover:scale-105 active:scale-95"
                            : "bg-gradient-to-r from-[#06555A] to-[#0ea5e9] hover:from-[#08737a] hover:to-[#38bdf8] text-white shadow-cyan-950/60 hover:scale-105 active:scale-95"
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </>
                        ) : listTab === "speaking" ? (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>Practise</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Start Quest</span>
                          </>
                        )}
                      </button>
                    )}
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
