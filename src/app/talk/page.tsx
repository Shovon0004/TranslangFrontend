"use client";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Cookies from "js-cookie";
import Lottie from "lottie-react";
import maleAnimation   from "../../../public/lotti/Talking Character.json";
import femaleAnimation from "../../../public/lotti/talking girl.json";
import micAnimation    from "../../../public/lotti/AI logo Foriday.json";
import * as vad from "@ricky0123/vad-web";
import {
  MessageCircle, Mic, MicOff, Send, RotateCcw, Sparkles, User, Bot,
  ChevronRight, Lightbulb, RefreshCw, Volume2, VolumeX, Keyboard,
  MapPin, Zap, Radio, BookmarkPlus, BookOpen, Trash2, Clock,
  Save, CheckCircle, X, EyeOff, Eye,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Gender = "male" | "female";
type Stage  = "select-model" | "select-topic" | "chat";

interface Message {
  role: "user" | "assistant";
  content: string;
  feedback?: string | null;
}

interface SavedChatSummary {
  _id: string;
  title: string;
  topic: string;
  situation: string;
  gender: Gender;
  personaName: string;
  updatedAt: string;
}

// ─── Feedback parser ─────────────────────────────────────────────────────────
interface ParsedFeedback {
  original: string; corrected: string; mistakes: string[];
  betterToSay: string[]; pronunciationTip: string;
  vocabularyBoost: string; confidence: string;
}

function parseFeedback(raw: string): ParsedFeedback {
  const get = (key: string, nextKeys: string[]) => {
    const ek = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const np = nextKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const re = np
      ? new RegExp(`${ek}:\\s*([\\s\\S]*?)(?=(?:${np}):|$)`, "i")
      : new RegExp(`${ek}:\\s*([\\s\\S]*)`, "i");
    const m = raw.match(re);
    return m ? m[1].trim() : "";
  };
  const keys = ["ORIGINAL","CORRECTED","MISTAKES","BETTER TO SAY","PRONUNCIATION TIP","VOCABULARY BOOST","CONFIDENCE"];
  const original         = get("ORIGINAL",          keys.slice(1));
  const corrected        = get("CORRECTED",         keys.slice(2));
  const mistakesRaw      = get("MISTAKES",          keys.slice(3));
  const betterRaw        = get("BETTER TO SAY",     keys.slice(4));
  const pronunciationTip = get("PRONUNCIATION TIP", keys.slice(5));
  const vocabularyBoost  = get("VOCABULARY BOOST",  keys.slice(6));
  const confidence       = get("CONFIDENCE",        []);
  const mistakes   = mistakesRaw.split("\n").map(l => l.replace(/^[•\-*]\s*/,"").trim()).filter(Boolean);
  const betterToSay = betterRaw.split("\n").map(l => l.replace(/^\d+\.\s*/,"").replace(/^[""]|[""]$/g,"").trim()).filter(Boolean);
  return { original, corrected, mistakes, betterToSay, pronunciationTip, vocabularyBoost, confidence };
}

// ─── Thinking fillers — spoken instantly while Gemini generates ──────────────
// Realistic thinking fillers — spoken instantly while Gemini generates the real reply.
// Long enough to feel natural, short enough that the first real sentence is ready before they end.
const FILLERS_MALE   = [
  "Hmm...",
  "Right...",
  "Okay...",
  "Ah, I see...",
  "Sure...",
  "Oh, interesting...",
  "Yeah...",
  "Hmm, let me think...",
  "Oh, good question...",
  "Right, so...",
];
const FILLERS_FEMALE = [
  "Hmm...",
  "Oh, okay...",
  "Ah, I see...",
  "Right...",
  "Sure...",
  "Oh wow...",
  "Yeah...",
  "Hmm, okay...",
  "Oh, interesting...",
  "Ah, right...",
];

// ─── Language → BCP-47 code map for Web Speech API ─────────────────────
const LANG_CODES: Record<string, string> = {
  English: "en-US", Hindi: "hi-IN", Bengali: "bn-IN",
  Tamil: "ta-IN", Telugu: "te-IN", Marathi: "mr-IN",
  Gujarati: "gu-IN", Kannada: "kn-IN", Malayalam: "ml-IN",
  French: "fr-FR", Spanish: "es-ES", German: "de-DE",
  Portuguese: "pt-BR", Italian: "it-IT", Dutch: "nl-NL",
  Japanese: "ja-JP", Korean: "ko-KR", Chinese: "zh-CN",
  Arabic: "ar-SA", Russian: "ru-RU", Turkish: "tr-TR",
};

// ─── Sentence boundary extractor (for streaming TTS) ───────────────────────────
// Splits on:
//   1. Hard boundaries: . ! ? — always split
//   2. Soft boundaries: , ; : — only when the preceding text is ≥3 words
//      (prevents splitting "Hi, Alex" into two tiny fragments)
//   3. Eager word-count flush — remainder ≥12 words with no punctuation at all
const SOFT_BOUNDARY_MIN_WORDS = 2;   // fire TTS on clause after just 2 words
const EAGER_FLUSH_WORDS       = 4;    // flush every 4 words — more aggressive real-time (was 6)

function extractCompleteSentences(text: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let remaining = text;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // 1. Hard boundary: . ! ? (possibly followed by quote/paren then whitespace/end)
    const hardMatch = /[.!?。！？]+["'\])]* */.exec(remaining);
    // 2. Soft boundary: comma / semicolon / colon + space
    const softMatch = /[,;:] /.exec(remaining);

    let splitAt = -1;

    if (hardMatch) {
      splitAt = hardMatch.index + hardMatch[0].length;
    }

    if (softMatch) {
      const before     = remaining.slice(0, softMatch.index);
      const wordCount  = before.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount >= SOFT_BOUNDARY_MIN_WORDS) {
        const softEnd = softMatch.index + softMatch[0].length;
        if (splitAt === -1 || softEnd < splitAt) {
          splitAt = softEnd;
        }
      }
    }

    if (splitAt > 0) {
      const sentence = remaining.slice(0, splitAt).trim();
      remaining = remaining.slice(splitAt).trimStart();
      if (sentence) sentences.push(sentence);
      continue;
    }

    // 3. Eager flush — no boundary but buffer is very long
    const words = remaining.trim().split(/\s+/).filter(Boolean);
    if (words.length >= EAGER_FLUSH_WORDS) {
      const chunk = words.slice(0, EAGER_FLUSH_WORDS).join(" ");
      remaining   = words.slice(EAGER_FLUSH_WORDS).join(" ");
      sentences.push(chunk);
      continue;
    }

    break;
  }

  return { sentences, remainder: remaining };
}

// ─── Feedback card ────────────────────────────────────────────────────────────
function FeedbackCard({ feedback }: { feedback: string }) {
  const f = parseFeedback(feedback);
  const hasMistakes = f.mistakes.length > 0 && !f.mistakes[0].toLowerCase().startsWith("none");
  return (
    <div className="mt-2 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden text-sm w-full max-w-md shadow-sm">
      <div className="flex items-center gap-2 bg-amber-100 px-3 py-2 border-b border-amber-200">
        <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="font-bold text-amber-800 text-xs uppercase tracking-wide">English Teacher Feedback</span>
      </div>
      <div className="p-3 space-y-2.5">
        {f.original && (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-red-400 font-bold text-xs mt-0.5 w-4 flex-shrink-0">✕</span>
              <p className="text-red-600 line-through text-xs leading-relaxed">{f.original}</p>
            </div>
            {f.corrected && (
              <div className="flex items-start gap-2">
                <span className="text-green-500 font-bold text-xs mt-0.5 w-4 flex-shrink-0">✓</span>
                <p className="text-green-700 font-semibold text-xs leading-relaxed">{f.corrected}</p>
              </div>
            )}
          </div>
        )}
        {f.mistakes.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
              {hasMistakes ? "❌ Mistakes" : "✅ Grammar"}
            </p>
            <ul className="space-y-1">
              {f.mistakes.map((m, i) => (
                <li key={i} className={`text-xs leading-relaxed ${hasMistakes ? "text-red-700" : "text-green-700"}`}>
                  {hasMistakes ? "• " : ""}{m}
                </li>
              ))}
            </ul>
          </div>
        )}
        {f.betterToSay.length > 0 && (
          <div>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">💬 Better to Say</p>
            <ol className="space-y-1">
              {f.betterToSay.map((b, i) => (
                <li key={i} className="text-xs text-blue-800 leading-relaxed">
                  {i + 1}. &quot;{b}&quot;
                </li>
              ))}
            </ol>
          </div>
        )}
        {f.pronunciationTip && (
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">🗣️ Pronunciation</p>
            <p className="text-xs text-purple-800 leading-relaxed">{f.pronunciationTip}</p>
          </div>
        )}
        {f.vocabularyBoost && (
          <div>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-1">📚 Vocabulary</p>
            <p className="text-xs text-teal-800 leading-relaxed">{f.vocabularyBoost}</p>
          </div>
        )}
        {f.confidence && (
          <div className="pt-1 border-t border-amber-200">
            <p className="text-xs font-bold text-amber-800">{f.confidence}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Real-time waveform bars (driven by mic energy) ───────────────────────────
function WaveformBars({ active, energy }: { active: boolean; energy: number }) {
  // Static height multipliers give an organic bar shape
  const multipliers = [0.4, 0.65, 0.9, 1.0, 0.85, 0.7, 0.95, 0.6, 0.75, 0.5, 0.8, 0.45];
  if (!active) {
    return (
      <div className="flex items-center justify-center gap-0.5 h-6">
        {multipliers.map((_, i) => (
          <div key={i} className="w-0.5 h-1 bg-gray-300 rounded-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-0.5 h-6">
      {multipliers.map((base, i) => {
        const px = Math.max(2, Math.round(base * energy * 22));
        return (
          <div
            key={i}
            className="w-0.5 bg-red-500 rounded-full transition-all duration-75"
            style={{ height: `${px}px` }}
          />
        );
      })}
    </div>
  );
}

// ─── Clean / Render chat text without raw markdown asterisks ────────────────
function cleanChatText(text: string): string {
  if (!text) return "";
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
}

function renderChatContent(text: string) {
  if (!text) return "";
  if (!text.includes("**")) return text;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Typewriter effect for AI replies ─────────────────────────────────────────
function TypewriterText({ text, speed = 6 }: { text: string; speed?: number }) {
  const clean = cleanChatText(text);
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      if (i < clean.length) {
        setDisplayed(clean.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(id);
      }
    }, speed);
    return () => clearInterval(id);
  }, [clean, speed]);

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block w-0.5 h-[1em] bg-current ml-0.5 animate-pulse rounded-full align-middle" />
      )}
    </span>
  );
}

// ─── VAD tuning constants (Silero ML model) ─────────────────────────────────
// positiveSpeechThreshold: probability to treat a frame as speech (0-1)
// negativeSpeechThreshold: probability to treat a frame as silence (0-1)
//   (Silero creators recommend ~0.15 below the positive threshold)
// minSpeechMs: discard utterances shorter than this (avoids cough/click false triggers)
// preSpeechPadMs: ms of audio prepended before speech onset (avoids clipping first phoneme)
// redemptionMs: grace period after silence before onSpeechEnd fires (handles brief pauses mid-sentence)
const VAD_POSITIVE_THRESHOLD = 0.60;
const VAD_NEGATIVE_THRESHOLD = 0.40;
const VAD_MIN_SPEECH_MS      = 250;
const VAD_PRE_SPEECH_PAD_MS  = 200;
const VAD_REDEMPTION_MS      = 800; // 800ms grace period (prevents premature cutoffs)

// ═══════════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════════
export default function TalkToAI() {
  const { user, updateUser } = useAuth();

  // ── Stage & setup state ──────────────────────────────────────────────────
  const [stage,          setStage]          = useState<Stage>("select-model");
  const [gender,         setGender]         = useState<Gender>("male");
  const [topicMode,      setTopicMode]      = useState<"user"|"ai"|"situation"|null>(null);
  const [userTopic,      setUserTopic]      = useState("");
  const [userSituation,  setUserSituation]  = useState("");
  const [finalTopic,     setFinalTopic]     = useState("");
  const [finalSituation, setFinalSituation] = useState("");
  const [suggestedTopic, setSuggestedTopic] = useState<{ topic: string; description: string }|null>(null);
  const [personaName,    setPersonaName]    = useState("Alex");
  const [fetchingTopic,  setFetchingTopic]  = useState(false);

  // ── Chat state ───────────────────────────────────────────────────────────
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [latestMsgIdx,   setLatestMsgIdx]   = useState(-1);
  // isStreaming: true while SSE chunks are arriving; streamingMsgIdx marks
  // the message index receiving the stream (skip TypewriterText for it)
  const [isStreaming,     setIsStreaming]    = useState(false);
  const [streamingMsgIdx, setStreamingMsgIdx]= useState(-1);

  // ── Voice state ──────────────────────────────────────────────────────────
  const [aiSpeaking,     setAiSpeaking]     = useState(false);
  const [isListening,    setIsListening]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micBlocked,      setMicBlocked]      = useState(false);
  const [micEnergy,       setMicEnergy]       = useState(0);   // 0-1 for waveform
  const [interimTranscript, setInterimTranscript] = useState(""); // live Web Speech words

  // ── Settings ─────────────────────────────────────────────────────────────
  const [autoSpeak,      setAutoSpeak]      = useState(true);
  const [handsFree,      setHandsFree]      = useState(true);
  const [showTextInput,  setShowTextInput]  = useState(false);
  const [voiceOnlyMode,  setVoiceOnlyMode]  = useState(false);

  // ── Saved chats ───────────────────────────────────────────────────────────
  const [showSavedChats, setShowSavedChats] = useState(false);
  const [savedChatsList, setSavedChatsList] = useState<SavedChatSummary[]>([]);
  const [loadingSaved,   setLoadingSaved]   = useState(false);
  const [activeSavedId,  setActiveSavedId]  = useState<string|null>(null);
  const [showSaveModal,  setShowSaveModal]  = useState(false);
  const [saveTitle,      setSaveTitle]      = useState("");
  const [savingChat,     setSavingChat]     = useState(false);
  const [saveSuccess,    setSaveSuccess]    = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);
  // Debounce timer for text-input speculative pre-fire (mirrors VAD silence for voice)
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const audioRef         = useRef<HTMLAudioElement|null>(null); // legacy / unused after Web Audio migration
  // Web Audio API — TTS playback (shared context eliminates per-sentence decode latency)
  const ttsAudioCtxRef   = useRef<AudioContext|null>(null);
  const ttsSourceRef     = useRef<AudioBufferSourceNode|null>(null);
  // Gapless scheduling: both filler (HTTP) and main reply (WS) update this
  const ttsScheduleEndRef = useRef(0);
  // Sarvam streaming TTS WebSocket
  const ttsWsRef         = useRef<WebSocket | null>(null);
  const ttsWsReadyRef    = useRef(false);         // WS open + Sarvam config confirmed
  const ttsWsPendingRef  = useRef<string[]>([]);  // text buffered before WS ready
  const ttsWsFlushedRef  = useRef(false);         // flush sent = no more text coming
  const ttsWsFallbackRef = useRef<string>("");    // fallback buffer if WS fails
  const ttsWsAudioReceivedRef = useRef(false);    // true once first WS audio chunk is received
  const ttsWsDoneRef     = useRef(false);         // server sent {type:"done"} — no more audio chunks
  const ttsWsActiveSourcesRef = useRef(0);        // number of WS audio sources still playing
  const ttsGenRef        = useRef(0);             // incremented on stop to cancel stale callbacks
  // Silero ML VAD instance (replaces RMS analyser + silence timer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vadRef           = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef     = useRef<any>(null); // Web Speech API SpeechRecognition instance
  // Invoked by the VAD silence timer to send interim text immediately (before rec.onend)
  const speechSendRef    = useRef<(() => void) | null>(null);
  // Mirrors of state accessible inside async callbacks without stale closures
  const messagesRef      = useRef<Message[]>([]);
  const handsFreeRef     = useRef(true);
  const loadingRef       = useRef(false);
  // TTS sentence-streaming pipeline — stores pre-decoded AudioBuffer promises
  const ttsPipelineRef   = useRef<Array<Promise<AudioBuffer | null>>>([]);
  const ttsPlayingRef    = useRef(false);
  // Frontend ArrayBuffer audio cache — avoids re-fetching identical phrases
  // Key: "<gender>:<text>", Value: ArrayBuffer of WAV bytes (safe to reuse)
  const audioCacheRef    = useRef<Map<string, ArrayBuffer>>(new Map());
  const AUDIO_CACHE_MAX  = 80;
  // ── Speculative pre-fire refs ──────────────────────────────────────────────
  const finalTextRef      = useRef<string>("");           // mirrors Web Speech finalText
  const liveSpeechTextRef   = useRef<string>("");
  const useWebSpeechRef      = useRef<boolean>(true);           // final + interim fallback for Chrome timing races
  const speculativeRef    = useRef<{                      // in-flight speculative Gemini fetch
    text: string;
    fetchPromise: Promise<Response | null>;
    controller: AbortController;
  } | null>(null);
  // Active /api/ai-talk/chat/stream fetch for current turn (abort on barge-in)
  const activeTurnAbortRef = useRef<AbortController | null>(null);
  // Monotonic sequence id to ignore stale stream chunks after cancellation
  const turnSeqRef         = useRef(0);
  const aiSpeakingRef      = useRef(false);
  const isStreamingRef     = useRef(false);
  // Always-current openTTSStream ref (avoids stale closures inside event listeners)
  const openTTSStreamRef  = useRef<(() => void) | null>(null);
  // Mirrors of gender/topic/situation for use inside event listener closures
  const genderRef         = useRef<Gender>(gender);
  const finalTopicRef     = useRef<string>(finalTopic);
  const finalSituationRef = useRef<string>(finalSituation);

  useEffect(() => { messagesRef.current  = messages; },  [messages]);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { loadingRef.current   = loading;   }, [loading]);
  useEffect(() => { aiSpeakingRef.current = aiSpeaking; }, [aiSpeaking]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { genderRef.current         = gender;         }, [gender]);
  useEffect(() => { finalTopicRef.current     = finalTopic;     }, [finalTopic]);
  useEffect(() => { finalSituationRef.current = finalSituation; }, [finalSituation]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isListening, isTranscribing]);

  // Clean up AudioContext on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioCtxRef.current && ttsAudioCtxRef.current.state !== "closed") {
        ttsAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // ── Stop VAD (Silero) ────────────────────────────────────────────────────
  const stopVAD = useCallback(() => {
    if (vadRef.current) {
      try { vadRef.current.pause(); } catch { /**/ }
      vadRef.current = null;
    }
    setMicEnergy(0);
  }, []);

  // ── Stop Recording ────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    // Web Speech API path
    if (speechRecRef.current) {
      // VAD silence fires this path — call sendAndStop immediately so text is sent
      // before rec.onend propagates (saves ~50-200 ms of browser event delay)
      if (speechSendRef.current) {
        speechSendRef.current();
      } else {
        try { speechRecRef.current.stop(); } catch { /**/ }
      }
      return;
    }
    // MediaRecorder fallback path
    stopVAD();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, [stopVAD]);

  // ── TTS pipeline: fetch + PRE-DECODE one sentence immediately ───────────────
  // Returns a decoded AudioBuffer (not a URL). Decoding runs in parallel while
  // the previous sentence is already playing → source.start() is near-instant.
  const fetchTTSBlob = useCallback(async (text: string): Promise<AudioBuffer | null> => {
    try {
      // ── Ensure we have a live TTS AudioContext ─────────────────────────────
      if (!ttsAudioCtxRef.current || ttsAudioCtxRef.current.state === "closed") {
        ttsAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      if (ttsAudioCtxRef.current.state === "suspended") {
        await ttsAudioCtxRef.current.resume();
      }
      const ctx = ttsAudioCtxRef.current;

      // ── Check raw-bytes cache ──────────────────────────────────────────────
      const cacheKey = `${gender}:${text}`;
      let arrayBuf: ArrayBuffer;
      const cachedBytes = audioCacheRef.current.get(cacheKey);
      if (cachedBytes) {
        arrayBuf = cachedBytes;
      } else {
        const res = await api.get("/tts", { params: { text, gender }, responseType: "arraybuffer" });
        arrayBuf = res.data as ArrayBuffer;
        audioCacheRef.current.set(cacheKey, arrayBuf);
        if (audioCacheRef.current.size > AUDIO_CACHE_MAX) {
          audioCacheRef.current.delete(audioCacheRef.current.keys().next().value!);
        }
      }

      // ── Decode WAV → AudioBuffer immediately (while prev sentence plays) ──
      // decodeAudioData consumes the buffer, so pass a copy to preserve cache.
      return await ctx.decodeAudioData(arrayBuf.slice(0));
    } catch { return null; }
  }, [gender]);

  // ── TTS pipeline: drain queued AudioBuffer promises and play in order ──────
  // Each AudioBuffer is already decoded before we reach it here (fetch+decode
  // ran in parallel while the previous sentence was playing), so source.start()
  // fires with near-zero latency — no WAV decode delay between sentences.
  const drainTTSPipeline = useCallback(async () => {
    if (ttsPlayingRef.current) return;
    ttsPlayingRef.current = true;
    setAiSpeaking(true);

    while (ttsPipelineRef.current.length > 0) {
      const bufPromise = ttsPipelineRef.current.shift()!;
      const audioBuf   = await bufPromise; // almost always already resolved
      if (!audioBuf) continue;

      // Ensure context is alive and un-suspended
      if (!ttsAudioCtxRef.current || ttsAudioCtxRef.current.state === "closed") {
        ttsAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      if (ttsAudioCtxRef.current.state === "suspended") {
        await ttsAudioCtxRef.current.resume();
      }
      const ctx = ttsAudioCtxRef.current;

      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(ctx.destination);
        source.onended = () => { ttsSourceRef.current = null; resolve(); };
        ttsSourceRef.current = source;
        // Schedule after any WS audio already queued (e.g. a previous turn still playing)
        const now     = ctx.currentTime;
        const startAt = Math.max(now + 0.005, ttsScheduleEndRef.current);
        ttsScheduleEndRef.current = startAt + audioBuf.duration;
        source.start(startAt);
      });

      // stopSpeaking() clears ttsPlayingRef — exit if interrupted
      if (!ttsPlayingRef.current) break;
    }

    ttsPlayingRef.current = false;
    ttsSourceRef.current  = null;

    // ── Hands-Free: start mic after the full pipeline finishes ────────────────────────
    // ONLY if no WS stream is still active. When autoSpeak=true, the HTTP
    // pipeline drains the filler only; the WS delivers the main reply and
    // is responsible for firing hf-start-mic via its own "done" + source
    // counter logic. If ttsWsRef is still open here, do nothing — mic start
    // will happen in the WS onmessage handler once all audio has played.
    if (!ttsWsRef.current) {
      setAiSpeaking(false);
      if (handsFreeRef.current && !loadingRef.current && !isStreamingRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current && !loadingRef.current && !isStreamingRef.current) {
            window.dispatchEvent(new CustomEvent("hf-start-mic"));
          }
        }, 300);
      }
    }
  }, []);

  // ── TTS pipeline: enqueue one sentence (fetch starts immediately) ────────
  const enqueueTTSSentence = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    ttsPipelineRef.current.push(fetchTTSBlob(trimmed));
    // Kick off the drain loop if it isn't running
    if (!ttsPlayingRef.current) drainTTSPipeline();
  }, [fetchTTSBlob, drainTTSPipeline]);

  // ── Pre-warm filler cache when chat starts ───────────────────────────────
  // Fetches all filler phrases in parallel so the very first filler of the
  // session plays with 0 network latency — results are stored in audioCacheRef.
  useEffect(() => {
    if (stage !== "chat") return;
    const pool = gender === "female" ? FILLERS_FEMALE : FILLERS_MALE;
    pool.forEach(f => fetchTTSBlob(f));
  }, [stage, gender, fetchTTSBlob]);

  // ── speakText: split a full block into sentences and enqueue all ──────────
  const speakText = useCallback((text: string) => {
    const { sentences, remainder } = extractCompleteSentences(text);
    sentences.forEach(s => enqueueTTSSentence(s));
    if (remainder.trim()) enqueueTTSSentence(remainder.trim());
  }, [enqueueTTSSentence]);

  // ── stopSpeaking: clear pipeline + stop ALL scheduled audio + close TTS WS ─────
  const stopSpeaking = useCallback(() => {
    ttsPipelineRef.current = [];
    ttsPlayingRef.current  = false;
    // Increment generation — any in-flight WS callbacks will abort
    ttsGenRef.current++;
    // Close streaming TTS WebSocket
    if (ttsWsRef.current) {
      try { ttsWsRef.current.close(); } catch { /**/ }
      ttsWsRef.current = null;
    }
    ttsWsReadyRef.current         = false;
    ttsWsPendingRef.current       = [];
    ttsWsFlushedRef.current       = false;
    ttsWsFallbackRef.current      = "";
    ttsWsAudioReceivedRef.current = false;
    ttsWsDoneRef.current          = false;
    ttsWsActiveSourcesRef.current = 0;
    ttsScheduleEndRef.current     = 0;
    // Stop current source node but KEEP the AudioContext alive.
    // Closing and recreating the context requires a new user gesture to unlock —
    // which means audio silently fails after the first turn.
    if (ttsSourceRef.current) {
      try { ttsSourceRef.current.stop(); } catch { /**/ }
      ttsSourceRef.current = null;
    }
    setAiSpeaking(false);
  }, []);

  // ── Sarvam Streaming TTS WebSocket helpers ───────────────────────────────
  //
  // Flow per AI turn:
  //   openTTSStream()     → opens WS proxy, Sarvam sends "ready"
  //   sendToTTSStream(t)  → called for every Gemini SSE chunk (no sentence buffering)
  //   flushTTSStream()    → called when Gemini stream ends (tell Sarvam to finish)
  //   Audio chunks arrive → base64 WAV → decodeAudioData → source.start(scheduledTime)
  //
  // openTTSStream is called at the START of sendMessageText BEFORE the Gemini
  // fetch, so the WS handshake + Sarvam config runs in parallel with the Gemini
  // request. By the time the first Gemini token arrives, the WS is usually ready.

  const openTTSStream = useCallback(() => {
    if (ttsWsRef.current) {
      try { ttsWsRef.current.close(); } catch { /**/ }
      ttsWsRef.current = null;
    }
    ttsWsReadyRef.current        = false;
    ttsWsPendingRef.current       = [];
    ttsWsFlushedRef.current       = false;
    ttsWsFallbackRef.current      = "";
    ttsWsAudioReceivedRef.current = false;
    ttsWsDoneRef.current          = false;
    ttsWsActiveSourcesRef.current = 0;
    const thisGen = ++ttsGenRef.current;

    const token = Cookies.get("token");
    if (!token || !autoSpeak) return;

    // ── WS URL: connect DIRECTLY to the backend, bypassing Next.js dev proxy
    // Next.js rewrites only handle HTTP, not WebSocket upgrades.
    // Derive backend WS URL from NEXT_PUBLIC_API_URL:
    //   http://host/api  →  ws://host/api/tts/ws
    //   https://host/api →  wss://host/api/tts/ws
    //   /api (relative)  →  ws://localhost:5000/api/tts/ws  (dev default)
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    let wsBase: string;
    if (apiBase.startsWith("https://")) {
      wsBase = apiBase.replace(/^https:\/\//, "wss://");
    } else if (apiBase.startsWith("http://")) {
      wsBase = apiBase.replace(/^http:\/\//, "ws://");
    } else {
      // Relative path (/api) → dev server; go directly to backend
      wsBase = "ws://localhost:5000/api";
    }
    const wsUrl = `${wsBase}/tts/ws?token=${encodeURIComponent(token)}&gender=${encodeURIComponent(gender)}`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (event: MessageEvent) => {
      if (thisGen !== ttsGenRef.current) return; // this turn was cancelled
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "ready") {
          ttsWsReadyRef.current = true;
          // Drain any text queued before WS was ready
          const pending = ttsWsPendingRef.current.splice(0);
          for (const t of pending) {
            ws.send(JSON.stringify({ type: "text", data: { text: t } }));
          }

        } else if (msg.type === "audio" && msg.data?.audio) {
          // First audio received — discard fallback buffer (WS is delivering audio)
          if (!ttsWsAudioReceivedRef.current) {
            ttsWsAudioReceivedRef.current = true;
            ttsWsFallbackRef.current = "";
          }
          // Decode base64 WAV chunk from Sarvam
          const binStr = atob(msg.data.audio as string);
          const bytes  = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);

          // Lazily create/resume AudioContext (may have been closed by stopSpeaking)
          if (!ttsAudioCtxRef.current || ttsAudioCtxRef.current.state === "closed") {
            ttsAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
          }
          if (ttsAudioCtxRef.current.state === "suspended") {
            await ttsAudioCtxRef.current.resume();
          }
          const ctx = ttsAudioCtxRef.current;

          // Decode WAV while next chunk is still in-flight
          const audioBuf = await ctx.decodeAudioData(bytes.buffer);
          if (thisGen !== ttsGenRef.current) return; // cancelled during decode

          // Gapless scheduling: play after filler or previous chunk
          const now     = ctx.currentTime;
          const startAt = Math.max(now + 0.005, ttsScheduleEndRef.current);
          ttsScheduleEndRef.current = startAt + audioBuf.duration;

          const source = ctx.createBufferSource();
          source.buffer = audioBuf;
          source.connect(ctx.destination);
          ttsSourceRef.current = source;
          ttsWsActiveSourcesRef.current += 1;
          setAiSpeaking(true);

          source.onended = () => {
            if (thisGen !== ttsGenRef.current) return;
            ttsWsActiveSourcesRef.current = Math.max(0, ttsWsActiveSourcesRef.current - 1);
            // Only start mic when the server confirmed it sent all audio ("done")
            // AND every scheduled source has finished playing.
            if (ttsWsDoneRef.current && ttsWsActiveSourcesRef.current === 0) {
              setAiSpeaking(false);
              if (handsFreeRef.current && !loadingRef.current) {
                setTimeout(() => {
                  if (handsFreeRef.current && !loadingRef.current) {
                    window.dispatchEvent(new CustomEvent("hf-start-mic"));
                  }
                }, 40);
              }
            }
          };
          source.start(startAt);

        } else if (msg.type === "done") {
          // Server finished sending all audio for this turn.
          ttsWsDoneRef.current = true;
          // If all sources already finished playing (fast network / short reply)
          // we need to trigger mic start here since onended already fired.
          if (ttsWsActiveSourcesRef.current === 0) {
            setAiSpeaking(false);
            if (handsFreeRef.current && !loadingRef.current) {
              setTimeout(() => {
                if (handsFreeRef.current && !loadingRef.current) {
                  window.dispatchEvent(new CustomEvent("hf-start-mic"));
                }
              }, 40);
            }
          }
        }
      } catch { /* ignore parse / decode errors */ }
    };

    ws.onclose = () => {
      if (ttsWsRef.current === ws) ttsWsRef.current = null;
      // If flush was sent but Sarvam never delivered audio, fall back to HTTP TTS
      if (ttsWsFlushedRef.current && !ttsWsAudioReceivedRef.current) {
        const fallback = ttsWsFallbackRef.current.trim();
        if (fallback) {
          const { sentences, remainder } = extractCompleteSentences(fallback);
          sentences.forEach(s => enqueueTTSSentence(s));
          if (remainder) enqueueTTSSentence(remainder);
          ttsWsFallbackRef.current = "";
        }
      }
    };
    ws.onerror = () => {
      // WS failed — flush anything buffered via sentence splitter as fallback
      if (ttsWsRef.current === ws) ttsWsRef.current = null;
      const fallback = ttsWsFallbackRef.current.trim();
      if (fallback) {
        const { sentences, remainder } = extractCompleteSentences(fallback);
        sentences.forEach(s => enqueueTTSSentence(s));
        if (remainder) enqueueTTSSentence(remainder);
        ttsWsFallbackRef.current = "";
      }
    };
    ttsWsRef.current = ws;
  }, [gender, autoSpeak, enqueueTTSSentence]);

  // Keep openTTSStreamRef always pointing to the latest openTTSStream closure
  useEffect(() => { openTTSStreamRef.current = openTTSStream; }, [openTTSStream]);

  // ── Speculative pre-fire handler ───────────────────────────────────────────
  // Fired by VAD the moment the user first goes silent (well before the 450ms timer).
  // 1) Pre-opens Sarvam TTS WebSocket so the WS handshake completes ~150ms early.
  // 2) Fires a speculative Gemini SSE fetch with the text heard so far.
  //    If the user confirms at 450ms with matching text, sendMessageText reuses it
  //    (the Gemini request has been in-flight for ~300ms → near-instant first token).
  useEffect(() => {
    const onSilence = () => {
      if (autoSpeak) openTTSStreamRef.current?.();
      const textSoFar = (finalTextRef.current || liveSpeechTextRef.current).trim();
      if (textSoFar.length > 3) {
        if (speculativeRef.current && !speculativeRef.current.controller.signal.aborted) {
          speculativeRef.current.controller.abort();
        }
        const controller = new AbortController();
        const token = Cookies.get("token");
        const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api";
        speculativeRef.current = {
          text: textSoFar,
          controller,
          fetchPromise: fetch(`${baseURL}/ai-talk/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              messages: [...messagesRef.current, { role: "user", content: textSoFar }]
                .map(m => ({ role: m.role, content: m.content })),
              topic:        finalTopicRef.current     || null,
              situation:    finalSituationRef.current || null,
              chosenGender: genderRef.current,
            }),
            signal: controller.signal,
          }).catch((err: unknown) => {
            const e = err as { name?: string; message?: string };
            if (
              e?.name === "AbortError" ||
              e?.message === "The operation was aborted." ||
              (typeof err === "string" && err.toLowerCase().includes("abort"))
            ) return null;
            throw err;
          }),
        };
      }
    };
    const onResume = () => {
      // User started speaking again — cancel speculative fetch, it's stale
      if (speculativeRef.current) {
        if (!speculativeRef.current.controller.signal.aborted) {
          speculativeRef.current.controller.abort();
        }
        speculativeRef.current = null;
      }
    };
    window.addEventListener("vad-silence-early", onSilence);
    window.addEventListener("vad-speech-resume", onResume);
    return () => {
      window.removeEventListener("vad-silence-early", onSilence);
      window.removeEventListener("vad-speech-resume", onResume);
    };
  }, [autoSpeak]); // autoSpeak gates the TTS WS open; everything else uses refs

  // Forward each Gemini token directly to Sarvam — no sentence boundary wait.
  // Also accumulates into fallbackRef for the onerror fallback path.
  const sendToTTSStream = useCallback((text: string) => {
    if (!text.trim() || !autoSpeak) return;
    ttsWsFallbackRef.current += text; // always accumulate for fallback
    const ws = ttsWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && ttsWsReadyRef.current) {
      ws.send(JSON.stringify({ type: "text", data: { text } }));
    } else if (ws) {
      ttsWsPendingRef.current.push(text); // will be drained on "ready"
    }
  }, [autoSpeak]);

  // Tell Sarvam no more text → generate and send remaining audio.
  // If WS never connected / closed early, fall back to sentence-buffer TTS.
  const flushTTSStream = useCallback(() => {
    ttsWsFlushedRef.current = true;
    const ws = ttsWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "flush" }));
      // Keep ttsWsFallbackRef.current alive — it will be cleared once the first
      // audio chunk arrives (confirming Sarvam is actually delivering audio).
      // If the WS closes without sending audio, onclose will use it as fallback.
    } else {
      // WS unavailable — play everything via sentence splitter
      const fallback = ttsWsFallbackRef.current.trim();
      if (fallback) {
        const { sentences, remainder } = extractCompleteSentences(fallback);
        sentences.forEach(s => enqueueTTSSentence(s));
        if (remainder) enqueueTTSSentence(remainder);
      }
      ttsWsFallbackRef.current = "";
    }
  }, [enqueueTTSSentence]);

  // ── Cancel current AI turn (for barge-in / restart) ─────────────────────
  const cancelActiveTurn = useCallback(() => {
    turnSeqRef.current += 1;
    if (activeTurnAbortRef.current && !activeTurnAbortRef.current.signal.aborted) {
      activeTurnAbortRef.current.abort();
      activeTurnAbortRef.current = null;
    }
    if (speculativeRef.current) {
      if (!speculativeRef.current.controller.signal.aborted) {
        speculativeRef.current.controller.abort();
      }
      speculativeRef.current = null;
    }
    setLoading(false);
    setIsStreaming(false);
    setStreamingMsgIdx(-1);
  }, []);

  // User starts speaking while AI is talking/thinking → immediate barge-in
  useEffect(() => {
    const onBargeIn = () => {
      if (aiSpeakingRef.current || isStreamingRef.current || loadingRef.current) {
        stopSpeaking();
        cancelActiveTurn();
      }
    };
    window.addEventListener("vad-speech-resume", onBargeIn);
    return () => window.removeEventListener("vad-speech-resume", onBargeIn);
  }, [stopSpeaking, cancelActiveTurn]);

  // ── Send message to AI (streaming SSE) ──────────────────────────────────
  const sendMessageText = useCallback(async (text: string) => {
    if (!text) return;
    if (loadingRef.current || isStreamingRef.current) {
      stopSpeaking();
      cancelActiveTurn();
    }
    const newUserMsg: Message = { role: "user", content: text };
    const updatedHistory = [...messagesRef.current, newUserMsg];
    setMessages(updatedHistory);
    setInput("");
    setLoading(true);
    setIsStreaming(false);
    // Interrupt any ongoing TTS pipeline so response starts sooner
    stopSpeaking();

    // Check if the VAD early-silence handler already fired a speculative Gemini fetch
    // (that happened ~300ms ago when the user first paused). If text matches, reuse it.
    const speculativeMatch = speculativeRef.current?.text === text.trim();
    // Always open a FRESH TTS WS here — stopSpeaking() above already closed whatever
    // the vad-silence-early handler opened, so we need a new one every turn.
    if (autoSpeak) openTTSStream();

    // ── Instant filler: speaks while Gemini generates ────────────────────────
    if (autoSpeak) {
      const pool   = gender === "female" ? FILLERS_FEMALE : FILLERS_MALE;
      const filler = pool[Math.floor(Math.random() * pool.length)];
      enqueueTTSSentence(filler);
    }

    // The AI message will sit at this index once the first chunk arrives
    const aiIdx = updatedHistory.length;

    let streamedReply = "";
    let capturedFeedback: string | null = null;
    let firstChunk = true;
    let doneStreak: number | undefined;
    let doneXp: number | undefined;
    const thisTurnSeq = ++turnSeqRef.current;

    try {
      const token = Cookies.get("token");
      const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api";
      // Reuse speculative fetch if text matches — it's been in-flight since ~300ms ago
      let res: Response;
      if (speculativeMatch && speculativeRef.current) {
        const speculativeRes = await speculativeRef.current.fetchPromise;
        if (speculativeRes) {
          res = speculativeRes;
          activeTurnAbortRef.current = speculativeRef.current.controller;
        } else {
          const controller = new AbortController();
          activeTurnAbortRef.current = controller;
          res = await fetch(`${baseURL}/ai-talk/chat/stream`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              messages:     updatedHistory.map(m => ({ role: m.role, content: m.content })),
              topic:        finalTopic     || null,
              situation:    finalSituation || null,
              chosenGender: gender,
            }),
            signal: controller.signal,
          });
        }
        speculativeRef.current = null;
      } else {
        if (speculativeRef.current) {
          if (!speculativeRef.current.controller.signal.aborted) {
            speculativeRef.current.controller.abort();
          }
          speculativeRef.current = null;
        }
        const controller = new AbortController();
        activeTurnAbortRef.current = controller;
        res = await fetch(`${baseURL}/ai-talk/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages:     updatedHistory.map(m => ({ role: m.role, content: m.content })),
            topic:        finalTopic     || null,
            situation:    finalSituation || null,
            chosenGender: gender,
          }),
          signal: controller.signal,
        });
      }

      if (!res.ok || !res.body) throw new Error("Stream request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (thisTurnSeq !== turnSeqRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let data: {
            type: string; text?: string; feedback?: string;
            reply?: string; streak?: number; xp?: number; message?: string;
          };
          try { data = JSON.parse(raw); } catch { continue; }

          if (thisTurnSeq !== turnSeqRef.current) break;

          if (data.type === "feedback") {
            capturedFeedback = data.feedback ?? null;

          } else if (data.type === "chunk" && data.text) {
            streamedReply += data.text;
            // ── Stream each token directly to Sarvam TTS (no sentence boundary wait) ──
            if (autoSpeak) sendToTTSStream(data.text);
            if (firstChunk) {
              firstChunk = false;
              setLoading(false);
              setIsStreaming(true);
              setStreamingMsgIdx(aiIdx);
              setLatestMsgIdx(aiIdx);
              // Insert the AI bubble into the messages array for the first time
              setMessages(prev => [
                ...prev,
                { role: "assistant", content: streamedReply, feedback: null },
              ]);
            } else {
              setMessages(prev => {
                const updated = [...prev];
                updated[aiIdx] = { role: "assistant", content: streamedReply, feedback: null };
                return updated;
              });
            }

          } else if (data.type === "done") {
            capturedFeedback = capturedFeedback ?? (data.feedback ?? null);
            doneStreak = data.streak;
            doneXp    = data.xp;
            const finalReply = streamedReply || data.reply || "";

            if (firstChunk) {
              // No chunk events arrived — just show the full reply
              firstChunk = false;
              setLoading(false);
              setStreamingMsgIdx(aiIdx);
              setLatestMsgIdx(aiIdx);
              setMessages(prev => [
                ...prev,
                { role: "assistant", content: finalReply, feedback: capturedFeedback },
              ]);
            } else {
              // Attach feedback to the already visible streaming bubble
              setMessages(prev => {
                const updated = [...prev];
                updated[aiIdx] = { role: "assistant", content: finalReply, feedback: capturedFeedback };
                return updated;
              });
            }
            setIsStreaming(false);

          } else if (data.type === "error") {
            throw new Error(data.message || "Stream error");
          }
        }
      }

      if (doneStreak !== undefined) updateUser({ streak: doneStreak, xp: doneXp });

      // Tell Sarvam no more text is coming — it will generate and send final audio chunks
      if (autoSpeak) flushTTSStream();
      if (thisTurnSeq === turnSeqRef.current) {
        activeTurnAbortRef.current = null;
      }

    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (
        e?.name === "AbortError" ||
        e?.message === "The operation was aborted." ||
        (typeof err === "string" && err.toLowerCase().includes("abort"))
      ) {
        if (thisTurnSeq === turnSeqRef.current) activeTurnAbortRef.current = null;
        return;
      }
      setLoading(false);
      setIsStreaming(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        const errMsg: Message = { role: "assistant", content: "Oops! Something went wrong. Try again.", feedback: null };
        // Replace empty placeholder if present, otherwise append
        if (last?.role === "assistant" && !last.content) return [...prev.slice(0, -1), errMsg];
        return [...prev, errMsg];
      });
    }
  }, [finalTopic, finalSituation, gender, autoSpeak, enqueueTTSSentence, updateUser, stopSpeaking,
      openTTSStream, sendToTTSStream, flushTTSStream, cancelActiveTurn]);

  // ── Voice Activity Detection (Silero ML VAD) ─────────────────────────────
  //
  // Silero VAD runs a tiny ONNX model in a Web Worker. It classifies each
  // 30ms audio frame as speech/silence using ML — far more accurate than
  // simple RMS threshold in noisy rooms, background music, or accents.
  //
  // getStream: reuses the already-granted MediaStream (no second mic prompt).
  // onSpeechStart  → user started speaking → cancel stale speculative fetch
  // onSpeechEnd    → speech ended → fire speculative pre-warm + stopListening
  // onFrameProcessed → per-frame speech probability → drives waveform bars
  const startVAD = useCallback(async (stream: MediaStream) => {
    // Destroy any stale instance first
    if (vadRef.current) { try { vadRef.current.pause(); } catch { /**/ } vadRef.current = null; }
    try {
      const instance = await vad.MicVAD.new({
        getStream:               () => Promise.resolve(stream), // reuse existing stream, no second mic prompt
        positiveSpeechThreshold: VAD_POSITIVE_THRESHOLD,
        negativeSpeechThreshold: VAD_NEGATIVE_THRESHOLD,
        minSpeechMs:             VAD_MIN_SPEECH_MS,
        preSpeechPadMs:          VAD_PRE_SPEECH_PAD_MS,
        redemptionMs:            VAD_REDEMPTION_MS,
        // Serve WASM/ONNX/worklet assets from our own public/vad/ folder
        // (avoids CDN fetches which are blocked in some environments)
        baseAssetPath:    "/vad/",
        onnxWASMBasePath: "/vad/",
        onSpeechStart: () => {
          // User started speaking — cancel stale speculative fetch
          window.dispatchEvent(new CustomEvent("vad-speech-resume"));
        },
        onSpeechEnd: (_audio: Float32Array) => {
          const spoken = (finalTextRef.current || liveSpeechTextRef.current).trim();
          // Do NOT stop if user hasn't spoken anything yet
          if (!spoken && (!audioChunksRef.current || audioChunksRef.current.length === 0)) {
            return;
          }
          // Speech ended — pre-warm TTS WS + fire speculative Gemini, then stop
          window.dispatchEvent(new CustomEvent("vad-silence-early"));
          setTimeout(() => {
            const hasSpoken = (finalTextRef.current || liveSpeechTextRef.current).trim();
            if (hasSpoken) {
              stopListening();
            }
          }, 400);
        },
        onFrameProcessed: (probs: { isSpeech: number }) => {
          // Speech probability (0-1) drives the waveform bars in real-time
          setMicEnergy(probs.isSpeech ?? 0);
        },
        onVADMisfire: () => { /* utterance too short — ignore */ },
      });
      await instance.start();
      vadRef.current = instance;
    } catch {
      // Silero WASM unavailable (old browser) — no VAD, mic still records normally
    }
  }, [stopListening]);

  // ── Start Recording (Web Speech API → fallback to MediaRecorder+Gemini STT) ──
  //
  // Web Speech API (Chrome / Edge / Samsung Browser):
  //   • Zero-latency: text returned the instant user stops speaking
  //   • Live interim words shown in the recording bubble as user speaks
  //   • No upload/transcription backend call needed
  //
  // Fallback (Firefox / Safari):
  //   • MediaRecorder + VAD silence detection → backend Gemini STT (existing logic)
    const startMediaRecorder = useCallback(async () => {
    try {
      const token = Cookies.get("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      let wsBase: string;
      if (apiBase.startsWith("https://")) wsBase = apiBase.replace(/^https:\/\//, "wss://");
      else if (apiBase.startsWith("http://")) wsBase = apiBase.replace(/^http:\/\//, "ws://");
      else wsBase = "ws://localhost:5000/api";

      const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("Base64 conversion failed"));
            return;
          }
          const b64 = result.split(",")[1] || "";
          resolve(b64);
        };
        reader.onerror = () => reject(new Error("Base64 conversion failed"));
        reader.readAsDataURL(blob);
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, noiseSuppression: true,
          autoGainControl: true, sampleRate: { ideal: 48000 }, channelCount: { ideal: 1 },
        },
      });
      const mimeType =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
          .find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128_000 })
        : new MediaRecorder(stream);

      let sttWs: WebSocket | null = null;
      let sttReady = false;
      let sttFailed = false;
      let sttLatestPartial = "";
      let sttFinal = "";
      let lastChunkSentAt = 0;
      const rollingChunks: Blob[] = [];
      const STREAM_SEND_INTERVAL_MS = 220;
      const STREAM_WINDOW_CHUNKS = 3;

      if (token) {
        try {
          const sttWsUrl = `${wsBase}/stt/ws?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(user?.currentLanguage || "English")}`;
          sttWs = new WebSocket(sttWsUrl);
          sttWs.onmessage = (event: MessageEvent) => {
            try {
              const msg = JSON.parse(event.data as string);
              if (msg.type === "ready") {
                sttReady = true;
              } else if (msg.type === "partial") {
                sttLatestPartial = (msg.text || "").trim();
                const merged = `${sttFinal} ${sttLatestPartial}`.trim();
                setInterimTranscript(merged);
              } else if (msg.type === "final") {
                sttFinal = (msg.text || "").trim() || sttFinal;
                setInterimTranscript(sttFinal);
              } else if (msg.type === "error") {
                sttFailed = true;
              }
            } catch {
              sttFailed = true;
            }
          };
          sttWs.onerror = () => { sttFailed = true; };
          sttWs.onclose = () => {
            if (!sttReady) sttFailed = true;
          };
        } catch {
          sttFailed = true;
        }
      }

      audioChunksRef.current = [];
      recorder.ondataavailable = async (e) => {
        if (e.data.size <= 0) return;
        audioChunksRef.current.push(e.data);

        if (!sttWs || sttFailed || !sttReady || sttWs.readyState !== WebSocket.OPEN) return;

        rollingChunks.push(e.data);
        if (rollingChunks.length > STREAM_WINDOW_CHUNKS) rollingChunks.shift();

        const now = Date.now();
        if (now - lastChunkSentAt < STREAM_SEND_INTERVAL_MS) return;
        lastChunkSentAt = now;

        try {
          const rollingBlob = new Blob(rollingChunks, { type: mimeType || "audio/webm" });
          const audio = await blobToBase64(rollingBlob);
          if (sttWs.readyState === WebSocket.OPEN) {
            sttWs.send(JSON.stringify({
              type: "chunk",
              data: { audio, mimeType: mimeType || "audio/webm" },
            }));
          }
        } catch {
          sttFailed = true;
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); stopVAD();
        mediaRecorderRef.current = null; setIsListening(false);
        setInterimTranscript("");

        let wsCommitted = "";
        if (sttWs && !sttFailed && sttReady && sttWs.readyState === WebSocket.OPEN) {
          try {
            sttWs.send(JSON.stringify({ type: "commit" }));
            wsCommitted = sttFinal || sttLatestPartial;
          } catch { /**/ }
        }

        try { sttWs?.close(); } catch { /**/ }

        const wsText = (wsCommitted || "").trim();
        if (wsText) {
          sendMessageText(wsText);
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        if (blob.size < 800) return;
        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "rec.webm");
          const res  = await api.post("/stt", form, { headers: { "Content-Type": "multipart/form-data" } });
          const text = (res.data.text || "").trim();
          if (text) sendMessageText(text);
        } catch { /**/ }
        finally { setIsTranscribing(false); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(120);
      setIsListening(true);
      startVAD(stream);
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setMicBlocked(true); setShowTextInput(true);
      }
    }
  }, [stopVAD, startVAD, sendMessageText, user?.currentLanguage]);

  // ── Start Recording (Web Speech API → seamless fallback to MediaRecorder) ──
  const startListening = useCallback(async () => {
    if (micBlocked || isTranscribing) return;

    if (loadingRef.current || isStreamingRef.current) {
      cancelActiveTurn();
    }

    // Interrupt AI if it is speaking
    stopSpeaking();

    // ── Web Speech API path (Chrome / Edge) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecAPI = useWebSpeechRef.current ? (win.SpeechRecognition || win.webkitSpeechRecognition) : null;
    if (SpeechRecAPI) {
      const rec = new SpeechRecAPI();
      rec.continuous      = true;
      rec.interimResults  = true;
      rec.maxAlternatives = 1;
      rec.lang = LANG_CODES[user?.currentLanguage || "English"] ?? "en-US";

      let finalText = "";
      let hasSent   = false;
      let silenceTimer: NodeJS.Timeout | null = null;

      const sendAndStop = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        if (hasSent) return;
        hasSent = true;
        speechSendRef.current = null;
        speechRecRef.current  = null;
        setIsListening(false);
        setInterimTranscript("");
        try { rec.stop(); } catch { /**/ }
        const text = (finalText.trim() || liveSpeechTextRef.current.trim());
        if (text) sendMessageText(text);
      };
      speechSendRef.current = sendAndStop;

      rec.onresult = (e: { resultIndex: number; results: SpeechRecognitionResultList }) => {
        let finalAccum = "";
        let interimAccum = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalAccum += e.results[i][0].transcript + " ";
          else interimAccum += e.results[i][0].transcript;
        }
        finalText = finalAccum.trim();
        finalTextRef.current = finalText;
        const currentFull = `${finalText} ${interimAccum}`.trim();
        liveSpeechTextRef.current = currentFull;
        setInterimTranscript(currentFull);

        if (silenceTimer) clearTimeout(silenceTimer);
        if (currentFull.length > 0) {
          silenceTimer = setTimeout(() => {
            sendAndStop();
          }, 1200);
        }
      };

      rec.onend = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        speechSendRef.current = null;
        speechRecRef.current  = null;
        setIsListening(false);
        setInterimTranscript("");
        if (!hasSent) {
          hasSent = true;
          const text = (finalText.trim() || liveSpeechTextRef.current.trim());
          if (text) sendMessageText(text);
        }
      };

      rec.onerror = (e: { error: string }) => {
        if (e.error === "no-speech" || e.error === "aborted") {
          return;
        }
        // Brave / Firefox / blocked speech service: transparently fall back to MediaRecorder
        if (e.error === "network" || e.error === "service-not-allowed" || e.error === "audio-capture" || e.error === "not-allowed") {
          useWebSpeechRef.current = false;
          speechSendRef.current = null;
          speechRecRef.current  = null;
          try { rec.stop(); } catch { /**/ }
          startMediaRecorder();
          return;
        }
        hasSent = true;
        speechSendRef.current = null;
        speechRecRef.current  = null;
        liveSpeechTextRef.current = "";
        setIsListening(false);
        setInterimTranscript("");
      };

      speechRecRef.current = rec;
      try {
        finalTextRef.current = "";
        liveSpeechTextRef.current = "";
        rec.start();
        setIsListening(true);
        navigator.mediaDevices?.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }).then((stream) => {
          startVAD(stream);
          rec.addEventListener("end", () => {
            stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
            stopVAD();
          }, { once: true });
        }).catch(() => {});
        return;
      } catch {
        useWebSpeechRef.current = false;
        speechRecRef.current = null;
      }
    }

    // Fallback: MediaRecorder + Gemini STT (Brave, Firefox, Safari)
    await startMediaRecorder();
  }, [micBlocked, isTranscribing, user?.currentLanguage, stopSpeaking, cancelActiveTurn, sendMessageText, startVAD, stopVAD, startMediaRecorder]);

  // ── Hands-Free event bridge ────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (!loadingRef.current && !isStreamingRef.current) {
        startListening();
      }
    };
    window.addEventListener("hf-start-mic", handler);
    return () => window.removeEventListener("hf-start-mic", handler);
  }, [startListening]);

  // ── Toggle mic button — always a direct user gesture (click/tap) ──────────
  // AudioContext is created/resumed HERE so the browser considers it unlocked
  // for the entire session. All subsequent audio (fillers, WS chunks) can then
  // start() without being blocked by the autoplay policy.
  const toggleMic = () => {
    // Unlock / create AudioContext on first user gesture (idempotent after first call)
    if (!ttsAudioCtxRef.current || ttsAudioCtxRef.current.state === "closed") {
      ttsAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (ttsAudioCtxRef.current.state === "suspended") {
      ttsAudioCtxRef.current.resume().catch(() => {});
    }

    if (aiSpeaking) {
      stopSpeaking();
      if (handsFree) startListening();
      return;
    }
    if (isListening) stopListening();
    else startListening();
  };

  // ── Topic helpers ─────────────────────────────────────────────────────────
  const fetchAITopic = useCallback(async () => {
    setFetchingTopic(true);
    try {
      const res = await api.post("/ai-talk/topic", {});
      setSuggestedTopic(res.data);
    } catch {
      setSuggestedTopic({ topic: "Daily Life & Routines", description: "A great topic to practice everyday vocabulary." });
    } finally { setFetchingTopic(false); }
  }, []);

  const handleModelSelect = (g: Gender) => {
    setGender(g);
    setPersonaName(g === "female" ? "Aria" : "Alex");
    setStage("select-topic");
  };

  const handleTopicModeSelect = async (mode: "user"|"ai"|"situation") => {
    setTopicMode(mode);
    if (mode === "ai") await fetchAITopic();
  };

  const startChat = async (topic: string, aiChoose = false, situation = "") => {
    const chosenTopic = topic || (aiChoose && suggestedTopic?.topic ? suggestedTopic.topic : "");
    setFinalTopic(chosenTopic);
    setFinalSituation(situation);
    setLoading(true);
    // Unlock AudioContext NOW (user gesture context) before any await
    if (!ttsAudioCtxRef.current || ttsAudioCtxRef.current.state === "closed") {
      ttsAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (ttsAudioCtxRef.current.state === "suspended") {
      ttsAudioCtxRef.current.resume().catch(() => {});
    }
    try {
      const res = await api.post("/ai-talk/chat", {
        messages:     [{ role: "user", content: "Hello! Let's start our conversation." }],
        topic:        chosenTopic || null,
        situation:    situation || null,
        chosenGender: gender,
        requestTopic: aiChoose && !chosenTopic,
      });
      const greeting: Message = { role: "assistant", content: res.data.reply, feedback: res.data.feedback };
      setMessages([greeting]);
      setLatestMsgIdx(0);
      setPersonaName(res.data.personaName || (gender === "female" ? "Aria" : "Alex"));
      setStage("chat");
      // Sync fresh streak to sidebar immediately
      if (res.data.streak !== undefined) updateUser({ streak: res.data.streak, xp: res.data.xp });
      if (autoSpeak) {
        speakText(res.data.reply);
        // hf-start-mic fires automatically after TTS pipeline drains (handsFree=true)
      } else {
        // No TTS — fire mic immediately so user can speak right away
        setTimeout(() => window.dispatchEvent(new CustomEvent("hf-start-mic")), 120);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to start conversation");
    } finally { setLoading(false); }
  };

  const resetConversation = () => {
    cancelActiveTurn();
    stopSpeaking();
    stopListening();
    stopVAD();
    try { mediaRecorderRef.current?.stop(); } catch { /**/ }
    mediaRecorderRef.current = null;
    setStage("select-model");
    setMessages([]); setInput(""); setFinalTopic(""); setFinalSituation("");
    setTopicMode(null); setSuggestedTopic(null);
    setUserTopic(""); setUserSituation("");
    setIsTranscribing(false); setMicBlocked(false);
    setInterimTranscript("");
    setLatestMsgIdx(-1);
    setIsStreaming(false); setStreamingMsgIdx(-1);
    setActiveSavedId(null);
    setShowSaveModal(false);
    setSaveTitle("");
    setSaveSuccess(false);
    setVoiceOnlyMode(false);
  };

  // ── Saved Chats: fetch list ───────────────────────────────────────────────
  const fetchSavedChats = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const res = await api.get("/saved-chats");
      setSavedChatsList(res.data);
    } catch { /* silent */ }
    finally { setLoadingSaved(false); }
  }, []);

  const openSavedChatsPanel = () => {
    setShowSavedChats(true);
    fetchSavedChats();
  };

  // ── Saved Chats: save new ─────────────────────────────────────────────────
  const saveNewChat = async () => {
    if (!saveTitle.trim() || savingChat) return;
    setSavingChat(true);
    try {
      const res = await api.post("/saved-chats", {
        title:      saveTitle.trim(),
        topic:      finalTopic,
        situation:  finalSituation,
        gender,
        personaName,
        messages:   messages.map(m => ({ role: m.role, content: m.content, feedback: m.feedback ?? null })),
      });
      setActiveSavedId(res.data._id);
      setSaveSuccess(true);
      setTimeout(() => { setShowSaveModal(false); setSaveSuccess(false); }, 1400);
    } catch { /* silent */ }
    finally { setSavingChat(false); }
  };

  // ── Saved Chats: update progress ──────────────────────────────────────────
  const updateSavedChat = async () => {
    if (!activeSavedId || savingChat) return;
    setSavingChat(true);
    try {
      await api.put(`/saved-chats/${activeSavedId}`, {
        messages: messages.map(m => ({ role: m.role, content: m.content, feedback: m.feedback ?? null })),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1600);
    } catch { /* silent */ }
    finally { setSavingChat(false); }
  };

  // ── Saved Chats: resume ───────────────────────────────────────────────────
  const resumeSavedChat = async (id: string) => {
    try {
      const res = await api.get(`/saved-chats/${id}`);
      const chat = res.data;
      setGender(chat.gender);
      setPersonaName(chat.personaName);
      setFinalTopic(chat.topic);
      setFinalSituation(chat.situation);
      setMessages(chat.messages);
      setLatestMsgIdx(-1); // don't typewrite old messages
      setActiveSavedId(id);
      setShowSavedChats(false);
      setStage("chat");
      // Auto-start mic — no greeting TTS to trigger it naturally
      setTimeout(() => window.dispatchEvent(new CustomEvent("hf-start-mic")), 120);
    } catch {
      alert("Failed to load chat. Please try again.");
    }
  };

  // ── Saved Chats: delete ───────────────────────────────────────────────────
  const deleteSavedChat = async (id: string) => {
    try {
      await api.delete(`/saved-chats/${id}`);
      setSavedChatsList(prev => prev.filter(c => c._id !== id));
      if (activeSavedId === id) setActiveSavedId(null);
    } catch { /* silent */ }
  };

  // ── Derived UI helpers ────────────────────────────────────────────────────
  const isFemale = gender === "female";

  const micBtnBg = useMemo(() => {
    if (isListening)   return "bg-red-500   shadow-red-300/60   scale-110 shadow-2xl";
    if (aiSpeaking)    return "bg-amber-500 shadow-amber-300/60 shadow-xl";
    if (handsFree)     return isFemale ? "bg-pink-500 shadow-pink-300/60 shadow-xl"
                                       : "bg-[#06555A] shadow-[#06555A]/40 shadow-xl";
    return isFemale
      ? "bg-pink-500  hover:bg-pink-600  shadow-pink-300/40  shadow-xl hover:scale-105"
      : "bg-[#06555A] hover:bg-[#054a4e] shadow-[#06555A]/30 shadow-xl hover:scale-105";
  }, [isListening, aiSpeaking, handsFree, isFemale]);

  const statusLabel =
    isListening    ? "🔴 Listening… pause to auto-send"  :
    isTranscribing ? "⏳ Understanding your voice…"      :
    aiSpeaking     ? "🔊 Speaking… tap to interrupt"     :
    loading        ? "🤔 Thinking…"                      :
    isStreaming    ? "✍️ Receiving reply…"               :
    handsFree      ? "🟢 Ready — just start speaking"    :
                     "Tap mic to speak";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#06555A]/10 via-white to-[#6FB3B8]/10 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">

          {/* ══ SAVED CHATS MODAL ══════════════════════════════════════════ */}
          {showSavedChats && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#06555A]" />
                    <h2 className="text-lg font-bold text-gray-800">Saved Conversations</h2>
                  </div>
                  <button onClick={() => setShowSavedChats(false)}
                    className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingSaved ? (
                    <div className="flex flex-col items-center py-12 gap-3">
                      <RefreshCw className="w-6 h-6 text-[#06555A] animate-spin" />
                      <p className="text-sm text-gray-500">Loading saved chats…</p>
                    </div>
                  ) : savedChatsList.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-3 text-center">
                      <BookOpen className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-500 font-medium">No saved conversations yet</p>
                      <p className="text-xs text-gray-400">Start a chat and tap <strong>Save Chat</strong> to save your progress.</p>
                    </div>
                  ) : (
                    savedChatsList.map(chat => (
                      <div key={chat._id}
                        className="flex items-start gap-3 bg-gray-50 hover:bg-[#06555A]/5 border border-gray-200 hover:border-[#06555A]/30 rounded-2xl p-4 transition group">
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate text-sm">{chat.title}</p>
                          {(chat.topic || chat.situation) && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {chat.situation ? <><MapPin className="w-3 h-3 inline mr-0.5" />{chat.situation}</> : <>📌 {chat.topic}</>}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(chat.updatedAt).toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" })}
                            &nbsp;·&nbsp;{chat.personaName} ({chat.gender})
                          </p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => resumeSavedChat(chat._id)}
                            className="flex items-center gap-1 text-xs font-semibold text-white bg-[#06555A] hover:bg-[#054a4e] px-3 py-1.5 rounded-xl transition">
                            Continue
                          </button>
                          <button
                            onClick={() => deleteSavedChat(chat._id)}
                            className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ SAVE CHAT MODAL ════════════════════════════════════════════════ */}
          {showSaveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
                {saveSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                    <p className="font-bold text-gray-800">Chat saved!</p>
                    <p className="text-sm text-gray-500">You can continue it any time from Saved Chats.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <BookmarkPlus className="w-5 h-5 text-[#06555A]" />
                      <h2 className="text-lg font-bold text-gray-800">Save this conversation</h2>
                    </div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Give it a name</label>
                    <input
                      autoFocus
                      type="text"
                      value={saveTitle}
                      onChange={e => setSaveTitle(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveNewChat()}
                      placeholder={finalSituation ? `Scene: ${finalSituation}` : finalTopic ? `Topic: ${finalTopic}` : "My conversation"}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:border-[#06555A] text-sm mb-4"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowSaveModal(false)}
                        className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 text-sm transition">
                        Cancel
                      </button>
                      <button
                        onClick={saveNewChat}
                        disabled={!saveTitle.trim() || savingChat}
                        className="flex-1 py-2.5 rounded-xl bg-[#06555A] text-white font-semibold hover:bg-[#054a4e] text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {savingChat ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#06555A] flex items-center gap-2">
                <MessageCircle className="w-8 h-8" /> Talk to AI
              </h1>
              <p className="text-gray-500 mt-1">Practice conversations with your AI language partner</p>
            </div>
            {stage === "chat" && (
              <button onClick={resetConversation}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#06555A]/30 text-[#06555A] rounded-xl hover:bg-[#06555A]/5 transition font-medium text-sm">
                <RotateCcw className="w-4 h-4" /> New Chat
              </button>
            )}
          </div>

          {/* ══ STAGE 1: MODEL SELECTION ════════════════════════════════════ */}
          {stage === "select-model" && (
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-gray-800">Choose Your AI Partner</h2>
                <button
                  onClick={openSavedChatsPanel}
                  className="flex items-center gap-2 px-3 py-2 bg-[#06555A]/10 hover:bg-[#06555A]/20 text-[#06555A] rounded-xl transition text-sm font-semibold">
                  <BookOpen className="w-4 h-4" /> Saved Chats
                </button>
              </div>
              <p className="text-center text-gray-500 mb-8">Select the AI persona you want to practice with</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Alex */}
                <button onClick={() => handleModelSelect("male")}
                  className="group relative bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-transparent hover:border-blue-400 rounded-3xl p-6 flex flex-col items-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="w-48 h-48 mb-4"><Lottie animationData={maleAnimation} loop className="w-full h-full" /></div>
                  <h3 className="text-xl font-bold text-blue-700 mb-1">Alex</h3>
                  <p className="text-blue-600 text-sm text-center">Confident &amp; engaging. Perfect for structured practice.</p>
                  <div className="mt-4 flex items-center gap-2 text-blue-500 font-semibold text-sm group-hover:gap-3 transition-all">
                    Choose Alex <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
                {/* Aria */}
                <button onClick={() => handleModelSelect("female")}
                  className="group relative bg-gradient-to-br from-pink-50 to-rose-100 border-2 border-transparent hover:border-pink-400 rounded-3xl p-6 flex flex-col items-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="w-48 h-48 mb-4"><Lottie animationData={femaleAnimation} loop className="w-full h-full" /></div>
                  <h3 className="text-xl font-bold text-pink-700 mb-1">Aria</h3>
                  <p className="text-pink-600 text-sm text-center">Warm &amp; encouraging. Great for relaxed conversations.</p>
                  <div className="mt-4 flex items-center gap-2 text-pink-500 font-semibold text-sm group-hover:gap-3 transition-all">
                    Choose Aria <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ══ STAGE 2: TOPIC SELECTION ════════════════════════════════════ */}
          {stage === "select-topic" && (
            <div className="bg-white rounded-3xl shadow-xl p-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center mb-6">
                <div className="w-24 h-24">
                  <Lottie animationData={isFemale ? femaleAnimation : maleAnimation} loop className="w-full h-full" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
                Hi {user?.name?.split(" ")[0]}! I&apos;m {personaName} 👋
              </h2>
              <p className="text-center text-gray-500 mb-8">How would you like to choose today&apos;s topic?</p>

              {!topicMode && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={() => handleTopicModeSelect("user")}
                    className="bg-gradient-to-br from-[#06555A]/10 to-[#6FB3B8]/20 border-2 border-[#06555A]/20 hover:border-[#06555A] rounded-2xl p-6 flex flex-col items-center gap-3 transition-all hover:shadow-lg">
                    <User className="w-10 h-10 text-[#06555A]" />
                    <h3 className="font-bold text-[#06555A] text-lg">I&apos;ll Choose</h3>
                    <p className="text-gray-500 text-sm text-center">Pick your own topic to discuss</p>
                  </button>
                  <button onClick={() => handleTopicModeSelect("ai")}
                    className="bg-gradient-to-br from-purple-50 to-violet-100 border-2 border-purple-200 hover:border-purple-400 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all hover:shadow-lg">
                    <Sparkles className="w-10 h-10 text-purple-500" />
                    <h3 className="font-bold text-purple-700 text-lg">Let AI Choose</h3>
                    <p className="text-gray-500 text-sm text-center">Get a fun surprise topic</p>
                  </button>
                  <button onClick={() => handleTopicModeSelect("situation")}
                    className="bg-gradient-to-br from-orange-50 to-amber-100 border-2 border-orange-200 hover:border-orange-400 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all hover:shadow-lg">
                    <MapPin className="w-10 h-10 text-orange-500" />
                    <h3 className="font-bold text-orange-700 text-lg">Real-Life Scene</h3>
                    <p className="text-gray-500 text-sm text-center">Practise a real situation you&apos;ll face</p>
                  </button>
                </div>
              )}

              {/* User picks topic */}
              {topicMode === "user" && (
                <div className="mt-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">What would you like to talk about?</label>
                  <input type="text" value={userTopic} onChange={e => setUserTopic(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && userTopic.trim() && startChat(userTopic)}
                    placeholder="e.g. Travel, Food, Movies, Technology…"
                    className="w-full border-2 border-[#06555A]/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-[#06555A] mb-4" />
                  <div className="flex gap-3">
                    <button onClick={() => setTopicMode(null)}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">Back</button>
                    <button onClick={() => startChat(userTopic)} disabled={!userTopic.trim() || loading}
                      className="flex-1 py-3 rounded-xl bg-[#06555A] text-white font-semibold hover:bg-[#054a4e] transition disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Starting…</> : <><Mic className="w-4 h-4" /> Start Talking</>}
                    </button>
                  </div>
                </div>
              )}

              {/* AI picks topic */}
              {topicMode === "ai" && (
                <div className="mt-2">
                  {fetchingTopic ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                      <p className="text-gray-500">Finding a great topic for you…</p>
                    </div>
                  ) : suggestedTopic ? (
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 mb-4">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-bold text-purple-800 text-lg">{suggestedTopic.topic}</h3>
                          <p className="text-purple-600 text-sm mt-1">{suggestedTopic.description}</p>
                        </div>
                      </div>
                      <button onClick={fetchAITopic}
                        className="mt-3 text-sm text-purple-500 hover:text-purple-700 flex items-center gap-1 transition">
                        <RefreshCw className="w-3 h-3" /> Try another topic
                      </button>
                    </div>
                  ) : null}
                  <div className="flex gap-3">
                    <button onClick={() => setTopicMode(null)}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">Back</button>
                    <button onClick={() => startChat(suggestedTopic?.topic || "", true)}
                      disabled={fetchingTopic || loading}
                      className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Starting…</> : <><Sparkles className="w-4 h-4" /> Start with this Topic</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Situation roleplay */}
              {topicMode === "situation" && (
                <div className="mt-2">
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-3 mb-3">
                      <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-orange-800">Describe your real-life situation</p>
                        <p className="text-xs text-orange-600 mt-0.5">
                          e.g. &quot;I&apos;m going to the market&quot;, &quot;I&apos;m ordering food at a restaurant&quot;,
                          &quot;I need to ask for directions&quot;, &quot;I&apos;m at a job interview&quot;
                        </p>
                      </div>
                    </div>
                    <input type="text" value={userSituation} onChange={e => setUserSituation(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && userSituation.trim() && startChat("", false, userSituation)}
                      placeholder="Describe where you are or what you need to do…"
                      className="w-full border-2 border-orange-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-orange-500 bg-white text-sm" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setTopicMode(null)}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">Back</button>
                    <button onClick={() => startChat("", false, userSituation)} disabled={!userSituation.trim() || loading}
                      className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Starting…</> : <><MapPin className="w-4 h-4" /> Start Roleplay</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STAGE 3: VOICE CHAT ═════════════════════════════════════════ */}
          {stage === "chat" && (
            <div className="flex flex-col gap-4">

              {/* ── Top control bar ── */}
              <div className="flex items-center justify-between bg-white rounded-2xl shadow px-4 py-2.5 gap-2 flex-wrap">
                {/* AI Voice */}
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:inline">AI Voice</span>
                  <button onClick={() => { setAutoSpeak(p => !p); if (aiSpeaking) stopSpeaking(); }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${autoSpeak ? "bg-[#06555A]" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoSpeak ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                {/* Topic badge */}
                {finalSituation ? (
                  <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full truncate max-w-[160px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {finalSituation}
                  </span>
                ) : finalTopic ? (
                  <span className="text-xs font-semibold text-[#06555A] bg-[#06555A]/10 px-3 py-1 rounded-full truncate max-w-[150px]">
                    📌 {finalTopic}
                  </span>
                ) : null}

                {/* Hands-Free */}
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:inline">Hands-Free</span>
                  <button onClick={() => setHandsFree(p => !p)}
                    title="Auto-listen after AI speaks"
                    className={`relative w-10 h-5 rounded-full transition-colors ${handsFree ? "bg-emerald-500" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${handsFree ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  {handsFree && (
                    <span className="hidden sm:flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Zap className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                {/* Save / Update button */}
                {activeSavedId ? (
                  <button
                    onClick={updateSavedChat}
                    disabled={savingChat}
                    title="Update saved progress"
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                      saveSuccess
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : "bg-[#06555A]/10 text-[#06555A] hover:bg-[#06555A]/20"
                    } disabled:opacity-50`}>
                    {savingChat ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{saveSuccess ? "Saved!" : "Update"}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setSaveTitle(finalSituation ? `Scene: ${finalSituation}` : finalTopic ? `Topic: ${finalTopic}` : ""); setShowSaveModal(true); }}
                    disabled={messages.length === 0}
                    title="Save this conversation"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#06555A] bg-[#06555A]/10 hover:bg-[#06555A]/20 px-3 py-1.5 rounded-xl transition disabled:opacity-40">
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save Chat</span>
                  </button>
                )}

                {/* Keyboard */}
                <button onClick={() => setShowTextInput(p => !p)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition">
                  <Keyboard className="w-4 h-4" />
                  <span className="hidden sm:inline">{showTextInput ? "Hide keyboard" : "Keyboard"}</span>
                </button>

                {/* Voice-only mode */}
                <button
                  onClick={() => setVoiceOnlyMode(p => !p)}
                  title={voiceOnlyMode ? "Show chat" : "Hide chat (voice only)"}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition px-2 py-1.5 rounded-xl ${
                    voiceOnlyMode
                      ? "bg-[#06555A] text-white"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}>
                  {voiceOnlyMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span className="hidden sm:inline">{voiceOnlyMode ? "Show chat" : "Hide chat"}</span>
                </button>
              </div>

              {/* ── Main layout ── */}
              <div className="flex flex-row gap-2 md:gap-4" style={{ height: "calc(100vh - 310px)" }}>

                {/* ── Left: Avatar + Mic Panel ── */}
                <div className={voiceOnlyMode ? "flex-1" : "w-20 md:w-56 flex-shrink-0"}>
                  <div className={`bg-white rounded-2xl md:rounded-3xl shadow-lg p-2 md:p-4 flex flex-col items-center sticky top-4 ${
                    voiceOnlyMode ? "h-full justify-center gap-6" : ""
                  }`}>

                    {/* Avatar */}
                    <div className={`relative flex-shrink-0 ${
                      voiceOnlyMode ? "w-56 h-56 md:w-72 md:h-72" : "w-14 h-14 md:w-44 md:h-44"
                    }`}>
                      <Lottie
                        animationData={isFemale ? femaleAnimation : maleAnimation}
                        loop={aiSpeaking || loading}
                        className="w-full h-full"
                      />
                      {aiSpeaking && (
                        <>
                          <span className="absolute inset-0 rounded-full border-4 border-[#06555A]/20 animate-ping" />
                          <span className="absolute inset-2 rounded-full border-2 border-[#06555A]/10 animate-ping" style={{ animationDelay: "0.3s" }} />
                        </>
                      )}
                    </div>

                    {/* Name */}
                    <h3 className={`font-bold text-gray-800 mt-2 text-lg ${voiceOnlyMode ? "block" : "hidden md:block"}`}>{personaName}</h3>

                    {/* Status badge */}
                    <span className={`text-xs rounded-full mt-1 font-semibold transition-all flex items-center justify-center px-1.5 py-0.5 md:px-3 md:py-0.5
                      ${aiSpeaking ? "bg-green-100 text-green-700" : loading ? "bg-yellow-100 text-yellow-700" : isTranscribing ? "bg-blue-100 text-blue-700" : isListening ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}${
                        voiceOnlyMode ? " !px-4 !py-1.5 text-sm" : ""
                      }`}>
                      <span className={voiceOnlyMode ? "hidden" : "md:hidden"}>
                        {aiSpeaking ? "🔊" : loading ? "⏳" : isTranscribing ? "🎙" : isListening ? "🔴" : "✓"}
                      </span>
                      <span className={voiceOnlyMode ? "inline" : "hidden md:inline"}>
                        {aiSpeaking ? "Speaking…" : loading ? "Thinking…" : isTranscribing ? "Transcribing…" : isListening ? "Recording…" : "Ready"}
                      </span>
                    </span>

                    {/* Replay / Stop button */}
                    {aiSpeaking ? (
                      <button onClick={stopSpeaking}
                        className="mt-2 md:mt-3 flex items-center justify-center gap-1 md:gap-1.5 text-xs text-red-500 hover:text-red-700 font-semibold w-10 h-10 md:w-auto md:h-auto rounded-xl bg-red-50 border border-red-200 md:px-3 md:py-1.5 transition"
                        title="Stop speaking">
                        <VolumeX className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        <span className="hidden md:inline">Stop</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => { const last = [...messages].reverse().find(m => m.role === "assistant"); if (last) speakText(last.content); }}
                        disabled={!messages.some(m => m.role === "assistant") || loading || isListening}
                        className="mt-2 md:mt-3 flex items-center justify-center gap-1 md:gap-1.5 text-xs text-[#06555A] hover:text-[#054a4e] font-semibold w-10 h-10 md:w-auto md:h-auto rounded-xl bg-[#06555A]/10 border border-[#06555A]/20 md:px-3 md:py-1.5 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Replay last message">
                        <Volume2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        <span className="hidden md:inline">Replay</span>
                      </button>
                    )}

                    {/* ── Mic button ── */}
                    <div className="mt-4 flex flex-col items-center gap-2 w-full">
                      <div className="relative flex items-center justify-center">
                        {isListening && (
                          <>
                            <span className="absolute w-16 h-16 md:w-24 md:h-24 rounded-full bg-red-400/20 animate-ping" />
                            <span className="absolute w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-400/30 animate-ping" style={{ animationDelay: "0.2s" }} />
                          </>
                        )}
                        {/* Hands-free idle pulse */}
                        {handsFree && !isListening && !aiSpeaking && !loading && (
                          <span className="absolute w-16 h-16 md:w-24 md:h-24 rounded-full border-2 border-emerald-400/60 animate-pulse" />
                        )}
                        <button
                          onClick={toggleMic}
                          disabled={(loading && !aiSpeaking) || micBlocked || isTranscribing || isStreaming}
                          className={`relative w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${micBtnBg}`}
                          title={isListening ? "Tap to force-send" : aiSpeaking ? "Tap to interrupt" : "Mic is always on — tap to interrupt"}
                        >
                          <div className="w-14 h-14 md:w-20 md:h-20">
                            <Lottie animationData={micAnimation} loop className="w-full h-full" />
                          </div>
                        </button>
                      </div>

                      {/* Live waveform */}
                      <WaveformBars active={isListening} energy={micEnergy} />

                      <p className={`text-xs text-gray-400 font-medium text-center leading-tight px-1 ${voiceOnlyMode ? "block" : "hidden md:block"}`}>
                        {statusLabel}
                      </p>
                      {micBlocked && (
                        <p className="hidden md:block text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg text-center">
                          Mic blocked — use keyboard
                        </p>
                      )}
                    </div>

                    {/* Hands-free badge on mobile */}
                    {handsFree && (
                      <span className="md:hidden mt-2 flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Zap className="w-3 h-3" /> HF
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Right: Chat Messages Panel ── */}
                {!voiceOnlyMode && (
                <div className="flex-1 bg-white rounded-3xl shadow-lg flex flex-col overflow-hidden min-h-0">
                  <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 min-h-0">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white ${
                          msg.role === "user" ? "bg-[#06555A]" : isFemale ? "bg-pink-400" : "bg-blue-400"}`}>
                          {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[78%] space-y-1.5 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-[#06555A] text-white rounded-tr-sm"
                              : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                            {/* Typewriter for the latest AI message — but NOT
                                 while it is being streamed in real-time,
                                 because the stream IS the animation. */}
                            {msg.role === "assistant" && idx === latestMsgIdx && idx !== streamingMsgIdx
                              ? <TypewriterText text={msg.content} />
                              : renderChatContent(msg.content)}
                          </div>
                          {msg.feedback && <FeedbackCard feedback={msg.feedback} />}
                        </div>
                      </div>
                    ))}

                    {/* Thinking indicator */}
                    {loading && (
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isFemale ? "bg-pink-400" : "bg-blue-400"}`}>
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 h-11">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    )}

                    {/* Recording indicator — shows live interim transcript */}
                    {isListening && (
                      <div className="flex gap-3 flex-row-reverse">
                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white flex-shrink-0">
                          <Mic className="w-4 h-4" />
                        </div>
                        <div className="max-w-[78%] bg-red-50 border-2 border-red-200 px-4 py-3 rounded-2xl rounded-tr-sm text-sm flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                          {interimTranscript
                            ? <span className="text-gray-800">{interimTranscript}<span className="animate-pulse">|</span></span>
                            : <span className="text-red-700 italic">Listening… stop talking to send</span>
                          }
                        </div>
                      </div>
                    )}

                    {/* Transcribing indicator */}
                    {isTranscribing && (
                      <div className="flex gap-3 flex-row-reverse">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                          <Mic className="w-4 h-4" />
                        </div>
                        <div className="max-w-[78%] bg-blue-50 border-2 border-blue-200 px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-blue-700 italic flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                          Understanding your voice…
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Text input (optional) */}
                  {showTextInput && (
                    <div className="border-t border-gray-100 p-3 md:p-4">
                      <div className="flex gap-2">
                        <input
                          ref={inputRef}
                          type="text"
                          value={input}
                          onChange={e => {
                            const val = e.target.value;
                            setInput(val);
                            // Keep finalTextRef in sync so the speculative handler picks it up
                            finalTextRef.current = val;
                            // Cancel any pending debounce and signal "user is typing" to cancel stale speculative fetches
                            if (typingDebounceRef.current) {
                              clearTimeout(typingDebounceRef.current);
                              typingDebounceRef.current = null;
                            }
                            window.dispatchEvent(new CustomEvent("vad-speech-resume"));
                            // After 1.1 s of no new keystrokes: pre-warm TTS WS + fire speculative Gemini fetch
                            if (val.trim().length > 3) {
                              typingDebounceRef.current = setTimeout(() => {
                                typingDebounceRef.current = null;
                                window.dispatchEvent(new CustomEvent("vad-silence-early"));
                              }, 1100);
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              // Cancel debounce — we're sending now
                              if (typingDebounceRef.current) { clearTimeout(typingDebounceRef.current); typingDebounceRef.current = null; }
                              sendMessageText(input.trim());
                            }
                          }}
                          placeholder={`Type to ${personaName}…`}
                          disabled={loading || isListening || isStreaming}
                          className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#06555A] text-sm disabled:opacity-50"
                        />
                        <button
                          onClick={() => {
                            if (typingDebounceRef.current) { clearTimeout(typingDebounceRef.current); typingDebounceRef.current = null; }
                            sendMessageText(input.trim());
                          }}
                          disabled={!input.trim() || loading || isStreaming}
                          className={`p-2.5 rounded-xl text-white transition-all ${isFemale ? "bg-pink-500 hover:bg-pink-600" : "bg-[#06555A] hover:bg-[#054a4e]"} disabled:opacity-40`}>
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>

              {/* Mic blocked banner */}
              {micBlocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <MicOff className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    Microphone access is blocked. Enable it in your browser settings, or type your responses below.
                  </p>
                  <button onClick={() => setShowTextInput(true)}
                    className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 flex-shrink-0">
                    <Keyboard className="w-4 h-4" /> Open keyboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
