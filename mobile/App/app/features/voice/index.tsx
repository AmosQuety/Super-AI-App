// app/features/voice/index.tsx
import { useMutation } from '@apollo/client/react';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import * as Speech from 'expo-speech';
import { PROCESS_VOICE_TASK } from '../../../services/graphql/operations';
import {
  MAX_TEXT_LENGTH,
  canProcessText,
  describeVoiceError,
  describeVoiceFailure,
  shouldApplyResult,
  textTooLong,
  type VoiceFailure,
} from '../../../libs/voice-tools';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Square,
  Save,
  Share2,
  Copy,
  Sparkles,
  Brain,
  Check,
  Volume2,
  Settings,
  Languages,
  Mic,
} from 'lucide-react-native';

// Types and Configuration remain the same...
interface Voice {
  id: string;
  name: string;
  icon: string;
  desc: string;
  rate: number;
  pitch: number;
}

interface Language {
  code: string;
  name: string;
  flag: string;
  translateCode: string;
}

interface Emotion {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const AI_FEATURES = {
  LANGUAGES: [
    { code: 'en-US', name: 'English', flag: '🇺🇸', translateCode: 'en' },
    { code: 'es-ES', name: 'Spanish', flag: '🇪🇸', translateCode: 'es' },
    { code: 'fr-FR', name: 'French', flag: '🇫🇷', translateCode: 'fr' },
    { code: 'de-DE', name: 'German', flag: '🇩🇪', translateCode: 'de' },
    { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵', translateCode: 'ja' },
    { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳', translateCode: 'zh' },
    { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦', translateCode: 'ar' },
    { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷', translateCode: 'pt' },
    { code: 'ru-RU', name: 'Russian', flag: '🇷🇺', translateCode: 'ru' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳', translateCode: 'hi' },
  ] as Language[],

  VOICE_CLONES: [
    {
      id: 'professional',
      name: 'Professional',
      icon: '💼',
      desc: 'Clear & authoritative',
      rate: 0.9,
      pitch: 1.0,
    },
    {
      id: 'friendly',
      name: 'Friendly',
      icon: '😊',
      desc: 'Warm & casual',
      rate: 0.85,
      pitch: 1.15,
    },
    {
      id: 'narrator',
      name: 'Narrator',
      icon: '🎙️',
      desc: 'Storytelling style',
      rate: 0.75,
      pitch: 1.05,
    },
    {
      id: 'energetic',
      name: 'Energetic',
      icon: '⚡',
      desc: 'Fast & dynamic',
      rate: 1.1,
      pitch: 1.2,
    },
    { id: 'calm', name: 'Calm', icon: '🧘', desc: 'Slow & soothing', rate: 0.7, pitch: 0.95 },
    { id: 'news', name: 'News Anchor', icon: '📰', desc: 'Broadcast style', rate: 1.0, pitch: 1.0 },
  ] as Voice[],

  EMOTIONS: [
    { id: 'neutral', name: 'Neutral', icon: '😐', color: '#6B7280' },
    { id: 'happy', name: 'Happy', icon: '😄', color: '#F59E0B' },
    { id: 'excited', name: 'Excited', icon: '🎉', color: '#DC2626' },
    { id: 'calm', name: 'Calm', icon: '😌', color: '#059669' },
    { id: 'professional', name: 'Professional', icon: '💼', color: '#2563EB' },
    { id: 'sad', name: 'Sad', icon: '😢', color: '#7C3AED' },
    { id: 'confident', name: 'Confident', icon: '💪', color: '#DB2777' },
  ] as Emotion[],
};

export default function VoiceScreen() {
  // State Management (same as before)
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(AI_FEATURES.LANGUAGES[0]);
  const [speechRate, setSpeechRate] = useState(0.85);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState(AI_FEATURES.VOICE_CLONES[0]);
  const [detectedEmotion, setDetectedEmotion] = useState(AI_FEATURES.EMOTIONS[0]);
  const [showAIModal, setShowAIModal] = useState(false);
  // Translate and summarize run on our server (processVoiceTask); the text leaves the phone only
  // through it. One at a time, and the previous text is kept so a result can be undone.
  const [processVoiceTask] = useMutation<{
    processVoiceTask: { success: boolean; result?: string | null; error?: string | null };
  }>(PROCESS_VOICE_TASK);
  const [busyAction, setBusyAction] = useState<'TRANSLATE' | 'SUMMARIZE' | null>(null);
  const isBusyRef = useRef(false);
  const [previousText, setPreviousText] = useState<string | null>(null);
  const [previousLanguage, setPreviousLanguage] = useState<Language | null>(null);
  // The latest text, readable inside an async callback: a result must not replace later edits.
  const textRef = useRef(text);
  textRef.current = text;
  const [processFailure, setProcessFailure] = useState<VoiceFailure | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const isTranslating = busyAction === 'TRANSLATE';
  const isProcessing = busyAction === 'SUMMARIZE';
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [speechProgress, setSpeechProgress] = useState(0);

  // Get available voices on mount
  useEffect(() => {
    const getVoices = async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        setAvailableVoices(voices);
      } catch (error) {
        console.log('Could not fetch voices:', error);
      }
    };
    getVoices();
  }, []);

  // Enhanced Emotion Detection (same as before)
  const detectEmotionFromText = useCallback((text: string): Emotion => {
    if (!text.trim()) return AI_FEATURES.EMOTIONS[0];

    const textLower = text.toLowerCase();
    const words = textLower.split(/\s+/);

    const emotionScores = {
      excited: 0,
      happy: 0,
      calm: 0,
      professional: 0,
      sad: 0,
      confident: 0,
      neutral: 0,
    };

    const emotionKeywords = {
      excited: [
        '!',
        'amazing',
        'awesome',
        'incredible',
        'fantastic',
        'wonderful',
        'wow',
        'excited',
        'thrilled',
      ],
      happy: [
        'happy',
        'great',
        'good',
        'excellent',
        'nice',
        'glad',
        'pleased',
        'love',
        'awesome',
        'fun',
      ],
      calm: [
        'calm',
        'peaceful',
        'relaxed',
        'meditation',
        'breathe',
        'mindful',
        'serene',
        'tranquil',
      ],
      professional: [
        'report',
        'analysis',
        'meeting',
        'presentation',
        'business',
        'professional',
        'regarding',
        'therefore',
      ],
      sad: ['sad', 'sorry', 'unfortunately', 'regret', 'disappointed', 'apology', 'unhappy'],
      confident: [
        'confident',
        'sure',
        'certain',
        'definitely',
        'absolutely',
        'proven',
        'guaranteed',
      ],
    };

    words.forEach((word) => {
      Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
        if (keywords.includes(word)) {
          emotionScores[emotion as keyof typeof emotionScores] += 2;
        }
      });
    });

    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;

    if (exclamationCount > 2) emotionScores.excited += 3;
    else if (exclamationCount > 0) emotionScores.happy += 2;

    if (questionCount > 3) emotionScores.calm += 1;

    if (words.length > 50) emotionScores.professional += 1;
    if (words.length < 10) emotionScores.neutral += 2;

    let maxScore = 0;
    let detectedEmotion = AI_FEATURES.EMOTIONS[0];

    Object.entries(emotionScores).forEach(([emotionId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        const emotion = AI_FEATURES.EMOTIONS.find((e) => e.id === emotionId);
        if (emotion) detectedEmotion = emotion;
      }
    });

    return detectedEmotion;
  }, []);

  useEffect(() => {
    if (text.trim()) {
      const emotion = detectEmotionFromText(text);
      setDetectedEmotion(emotion);
    } else {
      setDetectedEmotion(AI_FEATURES.EMOTIONS[0]);
    }
  }, [text, detectEmotionFromText]);

  // Voice Application
  const applyVoiceClone = useCallback((voice: Voice) => {
    setSelectedVoice(voice);
    setSpeechRate(voice.rate);
    setSpeechPitch(voice.pitch);
  }, []);

  const runTextTask = useCallback(
    async (action: 'TRANSLATE' | 'SUMMARIZE', targetLanguage?: Language) => {
      if (isBusyRef.current) return;
      if (!text.trim()) {
        Alert.alert('No Text', 'Please enter some text first.');
        return;
      }
      if (!canProcessText(text)) {
        setProcessFailure(textTooLong());
        return;
      }

      const sentText = text;
      isBusyRef.current = true;
      setBusyAction(action);
      setProcessFailure(null);
      setResultNote(null);
      try {
        const { data } = await processVoiceTask({
          variables: {
            input: { text: text.trim(), action, targetLanguage: targetLanguage?.name },
          },
        });
        const outcome = data?.processVoiceTask;
        if (outcome?.success && outcome.result && !shouldApplyResult(sentText, textRef.current)) {
          // The user typed while the server worked: their text wins, the result is dropped.
          setProcessFailure({
            message: 'Your text changed while it was being processed, so the result was not used.',
            canRetry: true,
          });
        } else if (outcome?.success && outcome.result) {
          setPreviousText(sentText);
          setPreviousLanguage(selectedLanguage);
          setText(outcome.result);
          setResultNote(targetLanguage ? `Translated to ${targetLanguage.name}` : 'Summarized');
          if (targetLanguage) setSelectedLanguage(targetLanguage);
        } else {
          setProcessFailure(describeVoiceFailure(outcome?.error));
        }
      } catch (error) {
        console.warn('Voice text task failed.');
        setProcessFailure(describeVoiceError(error));
      } finally {
        isBusyRef.current = false;
        setBusyAction(null);
      }
    },
    [processVoiceTask, selectedLanguage, text]
  );

  const translateText = useCallback(
    (targetLang: Language) => runTextTask('TRANSLATE', targetLang),
    [runTextTask]
  );
  const summarizeText = useCallback(() => runTextTask('SUMMARIZE'), [runTextTask]);

  const undoLastChange = useCallback(() => {
    if (previousText === null) return;
    setText(previousText);
    if (previousLanguage) setSelectedLanguage(previousLanguage);
    setPreviousText(null);
    setPreviousLanguage(null);
    setResultNote(null);
    setProcessFailure(null);
  }, [previousText, previousLanguage]);

  // Enhanced Text-to-Speech (same as before)
  const speakText = useCallback(async () => {
    if (!text.trim()) {
      Alert.alert('No Text', 'Please enter some text to convert to speech.');
      return;
    }

    await Speech.stop();
    setSpeechProgress(0);

    const emotionModifiers: Record<string, { rateMod: number; pitchMod: number }> = {
      happy: { rateMod: 1.1, pitchMod: 1.1 },
      excited: { rateMod: 1.2, pitchMod: 1.15 },
      calm: { rateMod: 0.85, pitchMod: 0.95 },
      professional: { rateMod: 1.0, pitchMod: 1.0 },
      neutral: { rateMod: 1.0, pitchMod: 1.0 },
      sad: { rateMod: 0.8, pitchMod: 0.9 },
      confident: { rateMod: 1.05, pitchMod: 1.1 },
    };

    const modifier = emotionModifiers[detectedEmotion.id] || { rateMod: 1.0, pitchMod: 1.0 };
    const finalRate = Math.min(2.0, Math.max(0.5, speechRate * modifier.rateMod));
    const finalPitch = Math.min(2.0, Math.max(0.5, speechPitch * modifier.pitchMod));

    const languagePrefix = selectedLanguage.code.split('-')[0];
    const preferredVoice = availableVoices.find((v) => v.language.startsWith(languagePrefix));

    try {
      await Speech.speak(text, {
        language: selectedLanguage.code,
        pitch: finalPitch,
        rate: finalRate,
        voice: preferredVoice?.identifier,
        onStart: () => {
          setIsSpeaking(true);
          setSpeechProgress(0.1);
        },
        onDone: () => {
          setIsSpeaking(false);
          setSpeechProgress(0);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeechProgress(0);
        },
        onError: (error) => {
          console.error('Speech synthesis error:', error);
          setIsSpeaking(false);
          setSpeechProgress(0);
          Alert.alert('Speech Error', 'Failed to convert text to speech. Please try again.');
        },
      });

      if (text.length > 100) {
        const words = text.split(' ');
        const interval = setInterval(() => {
          setSpeechProgress((prev) => {
            const newProgress = prev + 0.7 / words.length;
            return newProgress >= 0.9 ? 0.9 : newProgress;
          });
        }, 100);

        setTimeout(() => clearInterval(interval), words.length * 100);
      }
    } catch (error) {
      console.error('Speech error:', error);
      Alert.alert('Speech Error', 'Failed to start speech synthesis.');
      setIsSpeaking(false);
      setSpeechProgress(0);
    }
  }, [text, selectedLanguage, speechRate, speechPitch, detectedEmotion, availableVoices]);

  const stopSpeaking = async () => {
    try {
      await Speech.stop();
      setIsSpeaking(false);
      setSpeechProgress(0);
    } catch (error) {
      console.error('Stop speech error:', error);
    }
  };

  // Text utilities (same as before)
  const clearText = () => {
    setText('');
    setDetectedEmotion(AI_FEATURES.EMOTIONS[0]);
    setSpeechProgress(0);
  };

  const insertSampleText = () => {
    const samples = [
      'Hello! This is a sample sentence for the text-to-speech voice on your phone. You can change the speed and pitch, or translate and summarize the text.',
      "I'm absolutely thrilled to share this amazing news with you! We've just launched incredible new features that will revolutionize how you interact with voice technology. This is truly fantastic!",
      "In today's business meeting, we will discuss the quarterly performance metrics and strategic initiatives for the upcoming fiscal year. The report indicates positive growth trends across all departments.",
      'Take a deep breath and relax. Imagine yourself in a peaceful garden, surrounded by beautiful flowers and the gentle sound of a flowing stream. This is your moment of calm and serenity.',
    ];

    const randomSample = samples[Math.floor(Math.random() * samples.length)];
    setText(randomSample);
  };

  // File operations (same as before)
  const handleSave = async () => {
    if (!text.trim()) {
      Alert.alert('No Content', 'No text to save.');
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `VoiceAI-${timestamp}.txt`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      Alert.alert('Saved Successfully', `Text saved as: ${fileName}`);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Failed', 'Unable to save file. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!text.trim()) {
      Alert.alert('No Content', 'No text to share.');
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `VoiceAI-${timestamp}.txt`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Share your VoiceAI text',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', 'Unable to share file. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (!text.trim()) {
      Alert.alert('No Content', 'No text to copy.');
      return;
    }

    try {
      Clipboard.setString(text);
      Alert.alert('Copied!', 'Text copied to clipboard successfully.');
    } catch (error) {
      console.error('Copy error:', error);
      Alert.alert('Copy Failed', 'Unable to copy text. Please try again.');
    }
  };

  // Analytics
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const estimatedDuration = () => {
    const wordsPerMinute = speechRate * 150;
    const minutes = wordCount / wordsPerMinute;
    return Math.max(1, Math.ceil(minutes * 60));
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Welcome Header with Premium Design */}
      <View className="border-b border-slate-100 bg-white px-6 pb-8 pt-16">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/30">
              <Mic size={24} color="white" />
            </View>
            <View className="ml-3">
              <Text className="text-2xl font-bold text-slate-800">Voice tools</Text>
              <Text className="text-sm text-slate-500">Speak, translate and summarize</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowAIModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Voice settings"
            className="h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100"
            activeOpacity={0.7}>
            <Settings size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Welcome Message */}
        <View className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
              <Sparkles size={18} color="#4F46E5" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-indigo-800">
                Your text, spoken or reworked
              </Text>
              <Text className="mt-1 text-xs text-indigo-600">
                Type or paste text, then listen to it, translate it or summarize it.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* AI Status Card */}
        <View className="mx-5 mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-800">Current settings</Text>
          </View>

          <View className="flex-row justify-between">
            <View className="flex-1 items-center">
              <View className="mb-2 h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50">
                <Text className="text-lg">{selectedVoice.icon}</Text>
              </View>
              <Text className="text-center text-xs font-medium text-slate-700">
                {selectedVoice.name}
              </Text>
              <Text className="text-center text-xs text-slate-400">Voice</Text>
            </View>

            <View className="flex-1 items-center">
              <View className="mb-2 h-12 w-12 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50">
                <Text className="text-lg">{detectedEmotion.icon}</Text>
              </View>
              <Text className="text-center text-xs font-medium text-slate-700">
                {detectedEmotion.name}
              </Text>
              <Text className="text-center text-xs text-slate-600">Tone (guess)</Text>
            </View>

            <View className="flex-1 items-center">
              <View className="mb-2 h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
                <Text className="text-lg">{selectedLanguage.flag}</Text>
              </View>
              <Text className="text-center text-xs font-medium text-slate-700">
                {selectedLanguage.name}
              </Text>
              <Text className="text-center text-xs text-slate-400">Language</Text>
            </View>
          </View>
        </View>

        {/* Text Input Section */}
        <View className="mx-5 mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-slate-800">Your Text</Text>
            <View className="flex-row items-center rounded-full bg-slate-50 px-3 py-1.5">
              <Text className="text-xs font-medium text-slate-600">
                {wordCount} words • {charCount}/{MAX_TEXT_LENGTH} chars
              </Text>
            </View>
          </View>

          <TextInput
            multiline
            numberOfLines={6}
            placeholder="Type or paste your text here..."
            placeholderTextColor="#94A3B8"
            value={text}
            onChangeText={(value) => {
              setText(value);
              setPreviousText(null);
              setPreviousLanguage(null);
              setResultNote(null);
            }}
            testID="voice-text"
            editable={busyAction === null}
            accessibilityLabel="Text to speak, translate or summarize"
            className="min-h-[160px] rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-base leading-6 text-slate-800"
            style={{ textAlignVertical: 'top' }}
          />

          {text.trim().length > 0 && (
            <View className="mt-4 flex-row items-center rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <Check size={16} color="#059669" />
              <Text className="ml-2 flex-1 text-sm text-emerald-700">
                Ready • ~{estimatedDuration()}s • {detectedEmotion.name} tone (a guess from the
                words)
              </Text>
            </View>
          )}

          {/* Progress Bar */}
          {isSpeaking && (
            <View className="mt-4">
              <View className="h-2 overflow-hidden rounded-full bg-slate-200">
                <View
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${speechProgress * 100}%` }}
                />
              </View>
              <Text className="mt-2 text-center text-xs text-slate-500">
                {Math.round(speechProgress * 100)}% Complete
              </Text>
            </View>
          )}

          {/* Text Actions */}
          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              onPress={insertSampleText}
              className="flex-1 rounded-xl bg-indigo-500 py-4 shadow-lg shadow-indigo-500/30"
              activeOpacity={0.8}>
              <Text className="text-center text-sm font-semibold text-white">Load Sample Text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={clearText}
              disabled={!text}
              accessibilityRole="button"
              accessibilityLabel="Clear the text"
              className={`h-14 w-14 items-center justify-center rounded-xl border-2 ${
                text ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-100'
              }`}
              activeOpacity={0.8}>
              <Text className="text-lg">{text ? '🗑️' : '📝'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Speech Control */}
        <View className="mx-5 mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Text className="mb-4 text-xl font-bold text-slate-800">Speech Control</Text>

          <TouchableOpacity
            onPress={isSpeaking ? stopSpeaking : speakText}
            disabled={!text.trim()}
            className={`flex-row items-center justify-center rounded-2xl py-5 shadow-lg ${
              !text.trim()
                ? 'bg-slate-300 shadow-slate-300/30'
                : isSpeaking
                  ? 'bg-rose-500 shadow-rose-500/30'
                  : 'bg-indigo-500 shadow-indigo-500/30'
            }`}
            activeOpacity={0.8}>
            {isSpeaking ? (
              <>
                <Square size={24} color="white" />
                <Text className="ml-3 text-base font-bold text-white">Stop Speaking</Text>
              </>
            ) : (
              <>
                <Volume2 size={24} color="white" />
                <Text className="ml-3 text-base font-bold text-white">Speak</Text>
              </>
            )}
          </TouchableOpacity>

          {isSpeaking && (
            <View className="mt-4 flex-row items-center rounded-xl border border-emerald-300 bg-emerald-50 p-4">
              <View className="mr-3 h-3 w-3 rounded-full bg-emerald-500" />
              <Text className="flex-1 text-sm font-semibold text-emerald-700">
                🔊 Speaking in {selectedLanguage.name} (tone guess: {detectedEmotion.name})
              </Text>
            </View>
          )}

          {/* Utility Buttons */}
          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              onPress={handleCopy}
              disabled={!text.trim()}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3.5 shadow-sm ${
                !text.trim() ? 'bg-slate-300' : 'bg-blue-500'
              }`}>
              <Copy size={18} color="white" />
              <Text className="ml-2 text-sm font-semibold text-white">Copy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!text.trim()}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3.5 shadow-sm ${
                !text.trim() ? 'bg-slate-300' : 'bg-emerald-500'
              }`}>
              <Save size={18} color="white" />
              <Text className="ml-2 text-sm font-semibold text-white">Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              disabled={!text.trim()}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3.5 shadow-sm ${
                !text.trim() ? 'bg-slate-300' : 'bg-purple-500'
              }`}>
              <Share2 size={18} color="white" />
              <Text className="ml-2 text-sm font-semibold text-white">Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mx-5 mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Text className="mb-4 text-xl font-bold text-slate-800">Quick Actions</Text>
          {resultNote ? (
            <Text
              testID="voice-result-note"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mb-3 text-sm font-medium text-indigo-700">
              {resultNote}. You can undo it below.
            </Text>
          ) : null}

          {processFailure ? (
            <View
              testID="voice-error"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <Text className="text-sm text-red-800">{processFailure.message}</Text>
            </View>
          ) : null}

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowAIModal(true)}
              disabled={isTranslating || !text.trim()}
              testID="voice-translate-open"
              accessibilityRole="button"
              accessibilityLabel="Translate"
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3.5 shadow-sm ${
                !text.trim() || isTranslating ? 'bg-slate-300' : 'bg-blue-500'
              }`}>
              <Languages size={18} color="white" />
              <Text className="ml-2 text-sm font-semibold text-white">
                {isTranslating ? 'Translating...' : 'Translate…'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={summarizeText}
              testID="voice-summarize"
              accessibilityRole="button"
              accessibilityLabel="Summarize"
              disabled={isProcessing || !text.trim()}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3.5 shadow-sm ${
                !text.trim() || isProcessing ? 'bg-slate-300' : 'bg-amber-700'
              }`}>
              <Sparkles size={18} color="white" />
              <Text className="ml-2 text-sm font-semibold text-white">
                {isProcessing ? 'Summarizing...' : 'Summarize'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="mt-3 text-xs text-slate-500">
            Translate and Summarize send this text to our server. Speaking it aloud stays on your
            phone.
          </Text>

          {previousText !== null ? (
            <TouchableOpacity
              testID="voice-undo"
              onPress={undoLastChange}
              accessibilityRole="button"
              accessibilityLabel="Undo the last change to the text"
              className="mt-3 min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white">
              <Text className="text-sm font-semibold text-slate-700">Undo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* AI Studio Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/50 px-5">
          <View className="max-h-[85%] w-full max-w-md rounded-3xl bg-white p-6">
            <View className="mb-6 flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <Brain size={20} color="#4F46E5" />
              </View>
              <Text className="ml-3 flex-1 text-xl font-bold text-slate-800">Voice settings</Text>
              <TouchableOpacity
                testID="voice-modal-close"
                accessibilityRole="button"
                accessibilityLabel="Close voice settings"
                onPress={() => setShowAIModal(false)}
                className="h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                <Text className="font-bold text-slate-600">✕</Text>
              </TouchableOpacity>
            </View>

            {/* flexShrink, not flex-1: inside a height-limited parent a flex-1 scroll area collapses to nothing */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
              {/* Voice Presets */}
              <Text className="mb-4 text-lg font-bold text-slate-800">Voice Presets</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                <View className="flex-row gap-3">
                  {AI_FEATURES.VOICE_CLONES.map((voice) => (
                    <TouchableOpacity
                      key={voice.id}
                      onPress={() => applyVoiceClone(voice)}
                      className={`min-w-[100px] items-center rounded-2xl border-2 p-4 ${
                        selectedVoice.id === voice.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}>
                      <Text className="mb-2 text-2xl">{voice.icon}</Text>
                      <Text className="text-center text-sm font-semibold text-slate-800">
                        {voice.name}
                      </Text>
                      <Text className="mt-1 text-center text-xs text-slate-500">{voice.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Translation Section */}
              <Text className="mb-4 text-lg font-bold text-slate-800">Translation</Text>
              <View className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <Text className="mb-3 text-sm text-slate-600">
                  Select a language to translate your text
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {AI_FEATURES.LANGUAGES.map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        onPress={() => translateText(lang)}
                        disabled={isTranslating || !text.trim()}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedLanguage.code === lang.code }}
                        className={`min-h-[44px] flex-row items-center rounded-full px-4 py-2.5 ${
                          selectedLanguage.code === lang.code
                            ? 'bg-indigo-500'
                            : 'border border-slate-200 bg-white'
                        } ${!text.trim() || isTranslating ? 'opacity-50' : ''}`}>
                        <Text className="mr-2 text-base">{lang.flag}</Text>
                        <Text
                          className={`text-sm font-semibold ${
                            selectedLanguage.code === lang.code ? 'text-white' : 'text-slate-700'
                          }`}>
                          {lang.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {processFailure && !isTranslating ? (
                  <Text
                    testID="voice-modal-error"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    className="mt-3 text-center text-sm font-semibold text-red-700">
                    {processFailure.message}
                  </Text>
                ) : null}
                {resultNote && !isTranslating ? (
                  <Text
                    testID="voice-modal-result"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    className="mt-3 text-center text-sm font-semibold text-indigo-700">
                    {resultNote}
                  </Text>
                ) : null}
                {isTranslating && (
                  <View className="mt-3 flex-row items-center justify-center py-2">
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text className="ml-2 text-sm font-medium text-indigo-600">Translating...</Text>
                  </View>
                )}
              </View>

              {/* Voice Controls */}
              <Text className="mb-4 text-lg font-bold text-slate-800">Voice Controls</Text>
              <View className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <View className="mb-4">
                  <View className="mb-3 flex-row justify-between">
                    <Text className="text-sm font-medium text-slate-600">
                      Speed: {speechRate.toFixed(1)}x
                    </Text>
                    <Text className="text-sm font-semibold text-indigo-600">
                      {speechRate < 0.8 ? 'Slower' : speechRate > 1.0 ? 'Faster' : 'Normal'}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {[0.5, 0.7, 0.85, 1.0, 1.2, 1.5].map((rate) => (
                      <TouchableOpacity
                        key={rate}
                        onPress={() => setSpeechRate(rate)}
                        className={`flex-1 items-center rounded-xl py-2 ${
                          speechRate === rate ? 'bg-indigo-500' : 'border border-slate-200 bg-white'
                        }`}>
                        <Text
                          className={`text-xs font-medium ${
                            speechRate === rate ? 'text-white' : 'text-slate-600'
                          }`}>
                          {rate}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <View className="mb-3 flex-row justify-between">
                    <Text className="text-sm font-medium text-slate-600">
                      Pitch: {speechPitch.toFixed(1)}
                    </Text>
                    <Text className="text-sm font-semibold text-indigo-600">
                      {speechPitch < 0.9 ? 'Lower' : speechPitch > 1.1 ? 'Higher' : 'Normal'}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {[0.7, 0.9, 1.0, 1.1, 1.3, 1.5].map((pitch) => (
                      <TouchableOpacity
                        key={pitch}
                        onPress={() => setSpeechPitch(pitch)}
                        className={`flex-1 items-center rounded-xl py-2 ${
                          speechPitch === pitch
                            ? 'bg-indigo-500'
                            : 'border border-slate-200 bg-white'
                        }`}>
                        <Text
                          className={`text-xs font-medium ${
                            speechPitch === pitch ? 'text-white' : 'text-slate-600'
                          }`}>
                          {pitch}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowAIModal(false)}
              className="mt-4 rounded-xl bg-indigo-500 py-4 shadow-lg shadow-indigo-500/30">
              <Text className="text-center text-base font-semibold text-white">Apply Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
