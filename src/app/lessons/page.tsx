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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Lessons</h1>
          <p className="text-gray-500">
            {user?.role === "professional"
              ? "Professional language courses tailored for business"
              : "Learn at your own pace, one lesson at a time"}
          </p>
        </div>

        {/* Top-level tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setListTab("lessons")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition border-2 ${
              listTab === "lessons"
                ? "bg-[#3D8F8F] text-white border-[#3D8F8F] shadow-md shadow-[#6FB3B8]/30"
                : "bg-white text-gray-500 border-gray-200 hover:border-[#6FB3B8]"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Lessons
          </button>
          <button
            onClick={() => setListTab("speaking")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition border-2 ${
              listTab === "speaking"
                ? "bg-green-500 text-white border-green-500 shadow-md shadow-green-200"
                : "bg-white text-gray-500 border-gray-200 hover:border-green-400"
            }`}
          >
            <Mic className="w-4 h-4" />
            Speak Practice
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <Filter className="w-4 h-4" />
              Filter:
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Language</p>
              <div className="flex gap-2 flex-wrap">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedLanguage === lang
                        ? "bg-[#3D8F8F] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Level</p>
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      selectedLevel === level
                        ? "bg-[#3D8F8F] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
            <div className="w-10 h-10 border-4 border-[#3D8F8F] border-t-transparent rounded-full animate-spin" />
            <span className="mt-2 text-gray-400 text-sm">Loading lessons...</span>
          </div>
        ) : (() => {
          const filtered = lessons.filter((l) =>
            listTab === "speaking"
              ? l.content.some((c) => c.type === "speaking")
              : l.content.some((c) => c.type !== "speaking")
          );
          if (filtered.length === 0) return (
            <div className="text-center py-20 animate-fade-in">
              <Lottie animationData={deliveryAnimation} loop className="w-32 h-32 mx-auto mb-4" style={{ background: "transparent" }} />
              <h3 className="text-lg font-semibold text-gray-400">
                {listTab === "speaking" ? "No speak practice lessons yet" : "No lessons found"}
              </h3>
              <p className="text-gray-400 text-sm mt-1">Try changing the filters above</p>
            </div>
          );
          return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {filtered.map((lesson, idx) => {
              const isCompleted = completedIds.includes(lesson._id);
              const isLocked = false;
              const hasListening = lesson.content.some((c) => c.type === "listening");
              return (
                <div
                  key={lesson._id}
                  className={`bg-white rounded-3xl border shadow-sm p-6 flex flex-col transition-all duration-200 transform hover:scale-[1.025] hover:shadow-xl group relative overflow-hidden ${
                    listTab === "speaking" ? "hover:border-green-300" : "hover:border-[#4dd0e1]"
                  } ${
                    isLocked ? "opacity-60 border-gray-100" : "border-gray-100"
                  }`}
                  style={{ animation: `fadeInUp 0.5s ease ${(idx * 0.07).toFixed(2)}s both` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${
                        isCompleted ? "bg-[#e0f7fa]" : isLocked ? "bg-gray-100" :
                        listTab === "speaking" ? "bg-green-50" : "bg-[#e0f7fa]/60"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-[#00796b]" />
                      ) : isLocked ? (
                        <Lock className="w-6 h-6 text-gray-400" />
                      ) : listTab === "speaking" ? (
                        <Mic className="w-6 h-6 text-green-500" />
                      ) : (
                        <BookOpen className="w-6 h-6 text-[#4dd0e1]" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasListening && listTab !== "speaking" && (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-[#ede7f6] text-[#7e57c2] border border-[#b39ddb] flex items-center gap-1 shadow-sm">
                          <Headphones className="w-3 h-3" /> Voice
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize shadow-sm ${levelColors[lesson.level]}`}>
                        {lesson.level}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1 text-lg group-hover:text-[#00796b] transition-colors duration-150">{lesson.title}</h3>
                  <p className="text-sm text-gray-500 flex-1 mb-4 line-clamp-2">{lesson.description}</p>

                  {listTab !== "speaking" && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {Array.from(new Set(lesson.content.map((c) => c.type).filter((t) => t !== "speaking"))).map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[#f1f8e9] text-[#689f38] font-medium capitalize shadow-sm">
                          {typeIcons[t]} {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {listTab === "speaking" && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium shadow-sm">
                        🎤 {lesson.content.filter((c) => c.type === "speaking").length} phrase{lesson.content.filter((c) => c.type === "speaking").length !== 1 ? "s" : ""} to practise
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        {lesson.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                        {lesson.xpReward} XP
                      </span>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => startLesson(lesson, listTab === "speaking" ? "speaking" : "main")}
                        className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm ${
                          isCompleted
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : listTab === "speaking"
                            ? "bg-gradient-to-r from-green-400 to-emerald-600 hover:from-emerald-600 hover:to-green-700 text-white"
                            : "bg-gradient-to-r from-[#4dd0e1] to-[#00796b] hover:from-[#00796b] hover:to-[#4dd0e1] text-white"
                        }`}
                      >
                        {listTab === "speaking" ? <Mic className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                        {isCompleted ? "Review" : listTab === "speaking" ? "Practise" : "Start"}
                      </button>
                    )}
                  </div>

                  {/* Decorative gradient blob */}
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-[#e0f7fa] to-[#b39ddb] opacity-20 rounded-full blur-2xl pointer-events-none z-0" />
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
