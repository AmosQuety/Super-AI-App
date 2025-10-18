import React, { useEffect, useMemo, useRef, useState } from "react";
// 1. Import useMutation hook and your GraphQL mutation
import { useMutation } from "@apollo/client/react";
import { SAVE_TRANSCRIPT } from "../graphql/voice";
import {
  Mic,
  Square,
  Play,
  SquareIcon,
  Download,
  RotateCcw,
} from "lucide-react";

const hasSpeechRecognition =
  typeof window !== "undefined" &&
  // @ts-ignore
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const hasSpeechSynthesis =
  typeof window !== "undefined" && "speechSynthesis" in window;

// 2. Add a `userId` prop to the component
export default function VoiceTools({ userId }: { userId: string }) {
  // ---------- STT (Speech → Text) ----------
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");

  // ---------- TTS (Text → Speech) ----------
  const [ttsText, setTtsText] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");

  // 3. Call the useMutation hook to prepare the mutation function
  // It returns the function, and objects for loading, error, and data states
  const [saveTranscript, { loading: isSaving, error: saveError }] =
    useMutation(SAVE_TRANSCRIPT);

  // ... (keep all the existing useEffects and functions like ensureRecognition, startListening, etc.)
  useEffect(() => {
    if (!hasSpeechSynthesis) return;

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const v = synth.getVoices();
      setVoices(v);
      if (!voiceURI && v.length > 0) setVoiceURI(v[0].voiceURI);
    };

    loadVoices();
    if (typeof window !== "undefined") {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureRecognition = () => {
    if (!hasSpeechRecognition) return null;
    if (recognitionRef.current) return recognitionRef.current;

    // @ts-ignore
    const SR =
      // @ts-ignore
      (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;

    rec.onresult = (event: any) => {
      let interim = "";
      let final = finalText;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += final && !final.endsWith(" ") ? " " : "";
          final += transcript.trim();
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      setFinalText(final);
    };

    rec.onerror = (e: any) => {
      console.error("SpeechRecognition error:", e);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    return rec;
  };

  const startListening = () => {
    if (!hasSpeechRecognition) return;
    const rec = ensureRecognition();
    if (!rec) return;
    rec.lang = language;
    setInterimText("");
    rec.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (!hasSpeechRecognition || !recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  };

  const clearTranscript = () => {
    setInterimText("");
    setFinalText("");
  };

  const speak = () => {
    if (!hasSpeechSynthesis || !ttsText.trim()) return;
    const utterance = new SpeechSynthesisUtterance(ttsText);
    const selected = voices.find((v) => v.voiceURI === voiceURI);
    if (selected) utterance.voice = selected;
    window.speechSynthesis.cancel(); // stop any ongoing speech
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (!hasSpeechSynthesis) return;
    window.speechSynthesis.cancel();
  };

  // 4. Create the handler function for the save button
  const handleSaveTranscript = () => {
    if (!finalText.trim() || !userId) return;

    saveTranscript({
      variables: {
        userId: userId,
        text: finalText,
      },
    })
      .then((res) => {
        // You can add success feedback here, e.g., a toast notification
        console.log("Transcript saved successfully!", res.data);
      })
      .catch((err) => {
        // Error is already captured by the `saveError` state from the hook
        console.error("Error saving transcript:", err);
      });
  };

  const supportedNotice = useMemo(() => {
    if (!hasSpeechRecognition && !hasSpeechSynthesis) {
      return "This browser doesn't support Speech Recognition or Speech Synthesis.";
    }
    if (!hasSpeechRecognition) {
      return "Speech Recognition (STT) not supported in this browser.";
    }
    if (!hasSpeechSynthesis) {
      return "Speech Synthesis (TTS) not supported in this browser.";
    }
    return "";
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Voice Tools
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Convert speech to text and text to speech with AI-powered voice
          technology
        </p>
      </div>

      {supportedNotice && (
        <div className="p-4 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 mb-6">
          {supportedNotice} Try Chrome on desktop for best results.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* ====== STT Section ====== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-500" />
            Speech to Text
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <select
                value={language}
                title="Select Language"
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isListening}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="fr-FR">Français</option>
                <option value="es-ES">Español</option>
                <option value="de-DE">Deutsch</option>
                <option value="sw-KE">Kiswahili (Kenya)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={!hasSpeechRecognition}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isListening ? (
                  <>
                    <Square className="w-4 h-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Start Recording
                  </>
                )}
              </button>

              <button
                onClick={clearTranscript}
                className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                disabled={!finalText && !interimText}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {saveError && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                Error saving transcript: {saveError.message}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interim Text
                </label>
                <div className="min-h-20 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                  {interimText || "—"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Final Text
                </label>
                <div className="min-h-20 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white whitespace-pre-wrap">
                  {finalText || "—"}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveTranscript}
              disabled={!finalText.trim() || isSaving}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Save Transcript
                </>
              )}
            </button>
          </div>
        </div>

        {/* ====== TTS Section ====== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-500" />
            Text to Speech
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Text to speak
              </label>
              <textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="Type text to convert to speech..."
                className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Voice
              </label>
              <select
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={!hasSpeechSynthesis || voices.length === 0}
              >
                {voices.length === 0 && <option>Loading voices…</option>}
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} {v.lang ? `(${v.lang})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={speak}
                disabled={!hasSpeechSynthesis || !ttsText.trim()}
                className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Speak
              </button>

              <button
                onClick={stopSpeaking}
                className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                <SquareIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
