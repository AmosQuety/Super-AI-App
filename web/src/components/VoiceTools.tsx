// src/components/VoiceTools.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { 
  Mic, 
  Square, 
  Play, 
  Volume2, 
  Download, 
  RotateCcw, 
  AlertTriangle,
  Copy,
  Check,
  FileText,
  Pause
} from "lucide-react";

const hasSpeechRecognition =
  typeof window !== "undefined" &&
  // @ts-ignore
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const hasSpeechSynthesis =
  typeof window !== "undefined" && "speechSynthesis" in window;

interface VoiceToolsProps {
  userId?: string;
}

export default function VoiceTools({ userId }: VoiceToolsProps) {
  // STT (Speech to Text) State
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [copied, setCopied] = useState(false);

  // TTS (Text to Speech) State
  const [ttsText, setTtsText] = useState("Hello! I am an AI voice. Enter any text here and I will speak it for you.");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Load voices for TTS
  useEffect(() => {
    if (!hasSpeechSynthesis) return;

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const v = synth.getVoices();
      setVoices(v);
      if (!voiceURI && v.length > 0) {
        // Try to find a good default voice (preferably English)
        const defaultVoice = 
          v.find(voice => voice.lang.startsWith('en-') && voice.default) ||
          v.find(voice => voice.lang.startsWith('en-')) ||
          v.find(voice => voice.default) ||
          v[0];
        setVoiceURI(defaultVoice.voiceURI);
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
    
    return () => {
      synth.onvoiceschanged = null;
    };
  }, [voiceURI]);

  const ensureRecognition = useCallback(() => {
    if (!hasSpeechRecognition) return null;
    if (recognitionRef.current) return recognitionRef.current;

    // @ts-ignore
    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
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
          final += (final.endsWith(" ") || final === "" ? "" : " ") + transcript.trim();
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
      
      // Show user-friendly error message
      if (e.error === 'no-speech') {
        console.warn('No speech detected. Please try again.');
      } else if (e.error === 'audio-capture') {
        console.error('No microphone found. Please check your device.');
      } else if (e.error === 'not-allowed') {
        console.error('Microphone permission denied. Please allow microphone access.');
      }
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimText(""); // Clear interim text when recording ends
    };

    recognitionRef.current = rec;
    return rec;
  }, [language, finalText]);

  const startListening = useCallback(() => {
    if (!hasSpeechRecognition) return;
    const rec = ensureRecognition();
    if (!rec) return;
    
    try {
      rec.lang = language;
      rec.start();
      setIsListening(true);
    } catch (error) {
      console.error("Failed to start recognition:", error);
    }
  }, [language, ensureRecognition]);

  const stopListening = useCallback(() => {
    if (!hasSpeechRecognition || !recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (error) {
      console.error("Failed to stop recognition:", error);
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setInterimText("");
    setFinalText("");
    setCopied(false);
  }, []);

  // FIXED: Save transcript as text file
  const handleSaveTranscript = useCallback(() => {
    if (!finalText.trim()) return;
    
    try {
      // Create a blob with the transcript text
      const blob = new Blob([finalText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `transcript-${new Date().toISOString().slice(0, 10)}-${Date.now()}.txt`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log("Transcript saved successfully for user:", userId);
    } catch (error) {
      console.error("Failed to save transcript:", error);
    }
  }, [finalText, userId]);

  // Copy transcript to clipboard
  const handleCopyTranscript = useCallback(async () => {
    if (!finalText.trim()) return;
    
    try {
      await navigator.clipboard.writeText(finalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  }, [finalText]);

  const speak = useCallback(() => {
    if (!hasSpeechSynthesis || !ttsText.trim()) return;
    
    const utterance = new SpeechSynthesisUtterance(ttsText);
    const selected = voices.find((v) => v.voiceURI === voiceURI);
    if (selected) utterance.voice = selected;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    
    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setIsSpeaking(false);
      setIsPaused(false);
    };
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [ttsText, voices, voiceURI]);

  const pauseSpeaking = useCallback(() => {
    if (!hasSpeechSynthesis) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (!hasSpeechSynthesis) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (!hasSpeechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors on cleanup
        }
      }
      if (hasSpeechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const supportedNotice = useMemo(() => {
    if (!hasSpeechRecognition && !hasSpeechSynthesis) {
      return "This browser doesn't support the Web Speech API, which is required for both Speech Recognition and Speech Synthesis.";
    }
    if (!hasSpeechRecognition) {
      return "Speech Recognition (Speech-to-Text) is not supported in this browser.";
    }
    if (!hasSpeechSynthesis) {
      return "Speech Synthesis (Text-to-Speech) is not supported in this browser.";
    }
    return "";
  }, []);

  const wordCount = useMemo(() => {
    return finalText.trim() ? finalText.trim().split(/\s+/).length : 0;
  }, [finalText]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
          AI Voice Tools
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Convert speech to text and text to speech with our advanced AI voice toolkit.
        </p>
      </div>

      {supportedNotice && (
        <div className="p-6 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 mb-8 border border-yellow-200 dark:border-yellow-800/50">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-yellow-500" />
            <div>
              <p className="font-semibold mb-1">Browser Compatibility Notice</p>
              <p className="text-sm">{supportedNotice} For the best experience, please use a modern desktop browser like Chrome or Edge.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Speech to Text Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Speech to Text
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Convert your voice into text in real-time
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="stt-language" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Language
              </label>
              <select 
                id="stt-language" 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)} 
                className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all duration-300" 
                disabled={isListening}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="fr-FR">Français (France)</option>
                <option value="es-ES">Español (España)</option>
                <option value="de-DE">Deutsch (Deutschland)</option>
                <option value="sw-KE">Kiswahili (Kenya)</option>
                <option value="ar-SA">العربية (Arabic)</option>
                <option value="zh-CN">中文 (Chinese)</option>
                <option value="ja-JP">日本語 (Japanese)</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={isListening ? stopListening : startListening} 
                disabled={!hasSpeechRecognition} 
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 ${
                  isListening 
                    ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white" 
                    : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                }`}
              >
                {isListening ? (
                  <>
                    <Square className="w-5 h-5" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </>
                )}
              </button>

              <button 
                onClick={clearTranscript} 
                disabled={!finalText && !interimText} 
                className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md" 
                title="Clear transcript"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
            
            <div className="min-h-[18rem] p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white relative overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Transcript
                  {isListening && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>
                      REC
                    </span>
                  )}
                </label>
                {wordCount > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {finalText}
                <span className="text-slate-400 dark:text-slate-500 italic">{interimText}</span>
              </p>
              {!finalText && !interimText && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 italic text-center">
                  Your transcript will appear here...
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleCopyTranscript} 
                disabled={!finalText.trim()} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy
                  </>
                )}
              </button>

              <button 
                onClick={handleSaveTranscript} 
                disabled={!finalText.trim()} 
                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg transform hover:scale-105"
              >
                <Download className="w-5 h-5" />
                Save as TXT
              </button>
            </div>
          </div>
        </div>

        {/* Text to Speech Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Volume2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Text to Speech
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Convert text into natural-sounding speech
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="tts-text" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Text to Speak
              </label>
              <textarea 
                id="tts-text" 
                value={ttsText} 
                onChange={(e) => setTtsText(e.target.value.slice(0, 1000))} 
                placeholder="Enter text to convert to speech..." 
                className="w-full h-40 p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none transition-all duration-300" 
              />
              <div className="mt-2 flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {ttsText.trim().split(/\s+/).filter(w => w).length} words
                </span>
                <span className={`font-mono ${ttsText.length > 900 ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'}`}>
                  {ttsText.length} / 1000
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="tts-voice" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Voice ({voices.length} available)
              </label>
              <select 
                id="tts-voice" 
                value={voiceURI} 
                onChange={(e) => setVoiceURI(e.target.value)} 
                className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all duration-300" 
                disabled={!hasSpeechSynthesis || voices.length === 0}
              >
                {voices.length === 0 && <option>Loading voices…</option>}
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={speak} 
                disabled={!hasSpeechSynthesis || !ttsText.trim() || isSpeaking} 
                className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg transform hover:scale-105"
              >
                <Play className="w-5 h-5" />
                Speak
              </button>

              {isSpeaking && !isPaused && (
                <button 
                  onClick={pauseSpeaking} 
                  className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-md" 
                  title="Pause speaking"
                >
                  <Pause className="w-5 h-5" />
                </button>
              )}

              {isSpeaking && isPaused && (
                <button 
                  onClick={resumeSpeaking} 
                  className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-md" 
                  title="Resume speaking"
                >
                  <Play className="w-5 h-5" />
                </button>
              )}

              <button 
                onClick={stopSpeaking} 
                disabled={!isSpeaking} 
                className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md" 
                title="Stop speaking"
              >
                <Square className="w-5 h-5" />
              </button>
            </div>

            {isSpeaking && (
              <div className="flex items-center justify-center space-x-3 p-4 bg-purple-100 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-800/50">
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  {isPaused ? 'Paused' : 'Speaking...'}
                </span>
                {!isPaused && (
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-5 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
                    <div className="w-1.5 h-5 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1.5 h-5 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-1.5 h-5 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}