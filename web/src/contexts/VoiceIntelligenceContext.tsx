// src/contexts/VoiceIntelligenceContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { CommandEngine, type VoiceCommand } from "../services/voice/CommandEngine";
import { VoiceBiometricsService, type AudioMetrics } from "../services/voice/VoiceBiometricsService";
import { SentimentService, type SentimentResult } from "../services/voice/SentimentService";
import { useToast } from "../components/ui/toastContext";
import { useTheme } from "./useTheme";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { logger } from "../utils/logger";

// Types
interface VoiceIntelligenceContextType {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSpeaking: boolean;
  sentiment: SentimentResult | null;
  audioMetrics: AudioMetrics;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  registerCommand: (command: VoiceCommand) => void;
}

const VoiceIntelligenceContext = createContext<VoiceIntelligenceContextType | undefined>(undefined);

export const useVoiceIntelligence = () => {
  const context = useContext(VoiceIntelligenceContext);
  if (!context) {
    throw new Error("useVoiceIntelligence must be used within a VoiceIntelligenceProvider");
  }
  return context;
};

// Provider
export const VoiceIntelligenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics>({ vol: 0, pitch: 0, clarity: 0 });

  // Services Refs
  const recognitionRef = useRef<any>(null); // Type as any for simplicity with window.SpeechRecognition
  const commandEngine = useRef(new CommandEngine());
  const biometrics = useRef(new VoiceBiometricsService());
  const sentimentService = useRef(new SentimentService());
  const animationFrameRef = useRef<number | null>(null);

  const { showSuccess, showInfo } = useToast();
  const { setTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Initialize Services
  useEffect(() => {
    // Init Sentiment Service (Model Load)
    sentimentService.current.init();

    return () => {
      sentimentService.current.terminate();
      biometrics.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Biometrics Loop
  const updateBiometrics = useCallback(() => {
    if (isListening) {
      const metrics = biometrics.current.getMetrics();
      setAudioMetrics(metrics);
      animationFrameRef.current = requestAnimationFrame(updateBiometrics);
    }
  }, [isListening]);

  useEffect(() => {
    if (isListening) {
      updateBiometrics();
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      // Reset metrics to 0 visually
      setAudioMetrics({ vol: 0, pitch: 0, clarity: 0 });
    }
  }, [isListening, updateBiometrics]);


  // Command Matching
  useEffect(() => {
    if (!transcript) return;

    // Check for commands
    const match = commandEngine.current.match(transcript);
    if (match) {
      logger.info("Command Triggered:", match);
      
      // Execute Command
      if (match.action === "NAVIGATE") {
        navigate(match.payload);
        showSuccess("Voice Navigation", `Navigating to ${match.payload}`);
      } else if (match.action === "ACTION") {
        if (match.payload === "LOGOUT") {
           signOut().then(() => {
             navigate('/login');
             showInfo("Action", "Logged out successfully.");
           });
        } else if (match.payload === "THEME_DARK") {
           setTheme("dark");
           showInfo("Theme", "Switched to Dark Mode");
        } else if (match.payload === "THEME_LIGHT") {
           setTheme("light");
           showInfo("Theme", "Switched to Light Mode");
        }
      }
      
      // Clear transcript after command execution to avoid re-triggering and redundant toasts
      setTranscript("");
    }

    // Analyze Sentiment on "sentences" (simple heuristic: length > 10 chars)
    if (transcript.length > 10) {
       sentimentService.current.analyze(transcript).then(result => {
         if (result) setSentiment(result);
       });
    }

  }, [transcript, navigate, showSuccess, showInfo]);


  // Speech Recognition Setup
  const startListening = useCallback(async () => {
    if (isListening) return;

    // 1. Start Biometrics (Get user media)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await biometrics.current.start(stream);
    } catch (e) {
      logger.error("Microphone permission denied or error:", e);
      return;
    }

    // 2. Start Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      if (final) setTranscript(prev => (prev + " " + final).trim());
      setInterimTranscript(interim);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    biometrics.current.stop();
    setIsListening(false);
  }, []);

  // Text to Speech
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const registerCommand = useCallback((command: VoiceCommand) => {
    commandEngine.current.registerCommand(command);
  }, []);

  return (
    <VoiceIntelligenceContext.Provider
      value={{
        isListening,
        transcript,
        interimTranscript,
        isSpeaking,
        sentiment,
        audioMetrics,
        startListening,
        stopListening,
        speak,
        stopSpeaking,
        registerCommand
      }}
    >
      {children}
    </VoiceIntelligenceContext.Provider>
  );
};
