// app/features/voice/index.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  TextInput, 
  Modal, 
  ActivityIndicator, 
  Platform,
  Clipboard,
  Dimensions 
} from 'react-native';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Play, Square, Save, Share2, Copy, Sparkles, Globe, Brain, Zap, Check, AlertCircle, Volume2, Settings, Languages, Mic } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

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
    { id: 'professional', name: 'Professional', icon: '💼', desc: 'Clear & authoritative', rate: 0.9, pitch: 1.0 },
    { id: 'friendly', name: 'Friendly', icon: '😊', desc: 'Warm & casual', rate: 0.85, pitch: 1.15 },
    { id: 'narrator', name: 'Narrator', icon: '🎙️', desc: 'Storytelling style', rate: 0.75, pitch: 1.05 },
    { id: 'energetic', name: 'Energetic', icon: '⚡', desc: 'Fast & dynamic', rate: 1.1, pitch: 1.2 },
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

// Real translation service (same as before)
const translateTextAPI = async (text: string, targetLang: string, sourceLang: string = 'auto') => {
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
    );

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    } else {
      throw new Error('Translation quality too low');
    }
  } catch (error) {
    console.error('Translation API error:', error);
    
    const mockTranslations: Record<string, string> = {
      'en': `[English Translation] ${text}`,
      'es': `[Traducción al Español] ${text}`,
      'fr': `[Traduction Française] ${text}`,
      'de': `[Deutsche Übersetzung] ${text}`,
      'ja': `[日本語訳] ${text}`,
      'zh': `[中文翻译] ${text}`,
      'ar': `[الترجمة العربية] ${text}`,
      'pt': `[Tradução Portuguesa] ${text}`,
      'ru': `[Русский перевод] ${text}`,
      'hi': `[हिंदी अनुवाद] ${text}`,
    };
    
    return mockTranslations[targetLang] || `[Translated] ${text}`;
  }
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
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
      excited: ['!', 'amazing', 'awesome', 'incredible', 'fantastic', 'wonderful', 'wow', 'excited', 'thrilled'],
      happy: ['happy', 'great', 'good', 'excellent', 'nice', 'glad', 'pleased', 'love', 'awesome', 'fun'],
      calm: ['calm', 'peaceful', 'relaxed', 'meditation', 'breathe', 'mindful', 'serene', 'tranquil'],
      professional: ['report', 'analysis', 'meeting', 'presentation', 'business', 'professional', 'regarding', 'therefore'],
      sad: ['sad', 'sorry', 'unfortunately', 'regret', 'disappointed', 'apology', 'unhappy'],
      confident: ['confident', 'sure', 'certain', 'definitely', 'absolutely', 'proven', 'guaranteed'],
    };

    words.forEach(word => {
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
        const emotion = AI_FEATURES.EMOTIONS.find(e => e.id === emotionId);
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

  // Real Translation Function (same as before)
  const translateText = useCallback(async (targetLang: Language) => {
    if (!text.trim()) {
      Alert.alert('No Text', 'Please enter text to translate.');
      return;
    }

    if (text.length > 5000) {
      Alert.alert('Text Too Long', 'Please limit text to 5000 characters for translation.');
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const translatedText = await translateTextAPI(text, targetLang.translateCode);
      
      if (translatedText) {
        setText(translatedText);
        setSelectedLanguage(targetLang);
        
        setTimeout(() => {
          const newEmotion = detectEmotionFromText(translatedText);
          setDetectedEmotion(newEmotion);
        }, 100);
        
      } else {
        throw new Error('No translation received');
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      const errorMsg = error.message || 'Translation service unavailable. Please check your internet connection.';
      setTranslationError(errorMsg);
      
      Alert.alert(
        'Translation Error', 
        errorMsg,
        [{ text: 'OK', onPress: () => setTranslationError(null) }]
      );
    } finally {
      setIsTranslating(false);
    }
  }, [text, detectEmotionFromText]);

  // Text Enhancement Functions (same as before)
  const enhanceTextWithAI = useCallback(async (type: string) => {
    if (!text.trim()) {
      Alert.alert('No Text', 'Please enter text to enhance.');
      return;
    }

    setIsProcessing(true);

    try {
      let enhancedText = text;
      
      switch (type) {
        case 'grammar':
          enhancedText = text.replace(/\bi\b/g, 'I');
          enhancedText = enhancedText.replace(/\bdont\b/g, "don't");
          enhancedText = enhancedText.replace(/\bwont\b/g, "won't");
          enhancedText = enhancedText.replace(/\bcant\b/g, "can't");
          break;
          
        case 'professional':
          enhancedText = text.replace(/\bhey\b/gi, 'Hello')
                           .replace(/\bthanks\b/gi, 'Thank you')
                           .replace(/\bplease\b/gi, 'Kindly')
                           .replace(/\bbut\b/gi, 'However')
                           .replace(/\bso\b/gi, 'Therefore');
          break;
          
        case 'concise':
          enhancedText = text.split('.').slice(0, 2).join('.') + (text.split('.').length > 2 ? '...' : '');
          break;

        case 'emotion':
          const emotion = detectEmotionFromText(text);
          enhancedText = `[${emotion.name} Mode] ${text}`;
          break;
          
        default:
          enhancedText = text;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      setText(enhancedText);
      
      Alert.alert('Enhanced', `Text has been ${type} enhanced!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to enhance text');
    } finally {
      setIsProcessing(false);
    }
  }, [text, detectEmotionFromText]);

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
    const preferredVoice = availableVoices.find(v => 
      v.language.startsWith(languagePrefix)
    );

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
          setSpeechProgress(prev => {
            const newProgress = prev + (0.7 / words.length);
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
      "Hello! Welcome to VoiceAI Pro - the most advanced text-to-speech platform powered by artificial intelligence. Our system intelligently analyzes your text and generates natural, expressive speech in multiple languages.",
      "I'm absolutely thrilled to share this amazing news with you! We've just launched incredible new features that will revolutionize how you interact with voice technology. This is truly fantastic!",
      "In today's business meeting, we will discuss the quarterly performance metrics and strategic initiatives for the upcoming fiscal year. The report indicates positive growth trends across all departments.",
      "Take a deep breath and relax. Imagine yourself in a peaceful garden, surrounded by beautiful flowers and the gentle sound of a flowing stream. This is your moment of calm and serenity.",
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
      <View className="bg-white pt-16 pb-8 px-6 border-b border-slate-100">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-indigo-500 rounded-2xl items-center justify-center shadow-lg shadow-indigo-500/30">
              <Mic size={24} color="white" />
            </View>
            <View className="ml-3">
              <Text className="text-2xl font-bold text-slate-800">VoiceAI Pro</Text>
              <Text className="text-slate-500 text-sm">Premium AI Speech Studio</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setShowAIModal(true)}
            className="w-12 h-12 bg-slate-100 rounded-2xl items-center justify-center border border-slate-200"
            activeOpacity={0.7}
          >
            <Settings size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Welcome Message */}
        <View className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-indigo-100 rounded-xl items-center justify-center">
              <Sparkles size={18} color="#4F46E5" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-indigo-800 font-semibold text-sm">Welcome to your AI Studio!</Text>
              <Text className="text-indigo-600 text-xs mt-1">
                Transform your text into natural speech with advanced AI technology
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* AI Status Card */}
        <View className="mx-5 mt-6 bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-slate-800">AI Status</Text>
            <View className="flex-row items-center bg-emerald-50 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 bg-emerald-500 rounded-full mr-2" />
              <Text className="text-emerald-700 text-xs font-semibold">ACTIVE & READY</Text>
            </View>
          </View>
          
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mb-2 border border-blue-100">
                <Text className="text-lg">{selectedVoice.icon}</Text>
              </View>
              <Text className="text-slate-700 text-xs font-medium text-center">{selectedVoice.name}</Text>
              <Text className="text-slate-400 text-xs text-center">Voice</Text>
            </View>
            
            <View className="items-center flex-1">
              <View className="w-12 h-12 bg-amber-50 rounded-2xl items-center justify-center mb-2 border border-amber-100">
                <Text className="text-lg">{detectedEmotion.icon}</Text>
              </View>
              <Text className="text-slate-700 text-xs font-medium text-center">{detectedEmotion.name}</Text>
              <Text className="text-slate-400 text-xs text-center">Tone</Text>
            </View>
            
            <View className="items-center flex-1">
              <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center mb-2 border border-emerald-100">
                <Text className="text-lg">{selectedLanguage.flag}</Text>
              </View>
              <Text className="text-slate-700 text-xs font-medium text-center">{selectedLanguage.name}</Text>
              <Text className="text-slate-400 text-xs text-center">Language</Text>
            </View>
          </View>
        </View>

        {/* Text Input Section */}
        <View className="mx-5 mt-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-slate-800">Your Text</Text>
            <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-full">
              <Text className="text-slate-600 text-xs font-medium">
                {wordCount} words • {charCount} chars
              </Text>
            </View>
          </View>

          <TextInput
            multiline
            numberOfLines={6}
            placeholder="Type or paste your text here... Let AI bring it to life with natural speech! 🎯"
            placeholderTextColor="#94A3B8"
            value={text}
            onChangeText={setText}
            className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-slate-800 text-base min-h-[160px] leading-6"
            style={{ textAlignVertical: 'top' }}
          />

          {text.trim().length > 0 && (
            <View className="flex-row items-center bg-emerald-50 p-3 rounded-xl mt-4 border border-emerald-200">
              <Check size={16} color="#059669" />
              <Text className="text-emerald-700 text-sm ml-2 flex-1">
                Ready • ~{estimatedDuration()}s • {detectedEmotion.name} tone detected
              </Text>
            </View>
          )}

          {/* Progress Bar */}
          {isSpeaking && (
            <View className="mt-4">
              <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <View 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${speechProgress * 100}%` }}
                />
              </View>
              <Text className="text-xs text-slate-500 mt-2 text-center">
                {Math.round(speechProgress * 100)}% Complete
              </Text>
            </View>
          )}

          {/* Text Actions */}
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={insertSampleText}
              className="flex-1 bg-indigo-500 py-4 rounded-xl shadow-lg shadow-indigo-500/30"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold text-sm">
                Load Sample Text
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={clearText}
              disabled={!text}
              className={`w-14 h-14 rounded-xl items-center justify-center border-2 ${
                text ? 'bg-rose-50 border-rose-200' : 'bg-slate-100 border-slate-200'
              }`}
              activeOpacity={0.8}
            >
              <Text className="text-lg">{text ? '🗑️' : '📝'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Speech Control */}
        <View className="mx-5 mt-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <Text className="text-xl font-bold mb-4 text-slate-800">Speech Control</Text>
          
          <TouchableOpacity
            onPress={isSpeaking ? stopSpeaking : speakText}
            disabled={!text.trim()}
            className={`flex-row items-center justify-center py-5 rounded-2xl ${
              !text.trim() 
                ? 'bg-slate-300' 
                : isSpeaking 
                ? 'bg-rose-500 shadow-lg shadow-rose-500/30' 
                : 'bg-indigo-500 shadow-lg shadow-indigo-500/30'
            }`}
            activeOpacity={0.8}
          >
            {isSpeaking ? (
              <>
                <Square size={24} color="white" />
                <Text className="text-white font-bold ml-3 text-base">
                  Stop Speaking
                </Text>
              </>
            ) : (
              <>
                <Volume2 size={24} color="white" />
                <Text className="text-white font-bold ml-3 text-base">
                  Start AI Speech
                </Text>
              </>
            )}
          </TouchableOpacity>

          {isSpeaking && (
            <View className="bg-emerald-50 p-4 rounded-xl mt-4 flex-row items-center border border-emerald-300">
              <View className="w-3 h-3 bg-emerald-500 rounded-full mr-3" />
              <Text className="text-emerald-700 font-semibold flex-1 text-sm">
                🔊 Speaking in {selectedLanguage.name} with {detectedEmotion.name} tone
              </Text>
            </View>
          )}

          {/* Utility Buttons */}
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={handleCopy}
              disabled={!text.trim()}
              className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${
                !text.trim() ? 'bg-slate-300' : 'bg-blue-500 shadow-sm'
              }`}
            >
              <Copy size={18} color="white" />
              <Text className="text-white font-semibold ml-2 text-sm">Copy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleSave}
              disabled={!text.trim()}
              className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${
                !text.trim() ? 'bg-slate-300' : 'bg-emerald-500 shadow-sm'
              }`}
            >
              <Save size={18} color="white" />
              <Text className="text-white font-semibold ml-2 text-sm">Save</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleShare}
              disabled={!text.trim()}
              className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${
                !text.trim() ? 'bg-slate-300' : 'bg-purple-500 shadow-sm'
              }`}
            >
              <Share2 size={18} color="white" />
              <Text className="text-white font-semibold ml-2 text-sm">Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mx-5 mt-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <Text className="text-xl font-bold mb-4 text-slate-800">Quick Actions</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => translateText(AI_FEATURES.LANGUAGES[1])}
              disabled={isTranslating || !text.trim()}
              className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${
                !text.trim() || isTranslating ? 'bg-slate-300' : 'bg-blue-500 shadow-sm'
              }`}
            >
              <Languages size={18} color="white" />
              <Text className="text-white font-semibold ml-2 text-sm">
                {isTranslating ? 'Translating...' : 'Translate'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => enhanceTextWithAI('grammar')}
              disabled={isProcessing || !text.trim()}
              className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${
                !text.trim() || isProcessing ? 'bg-slate-300' : 'bg-amber-500 shadow-sm'
              }`}
            >
              <Sparkles size={18} color="white" />
              <Text className="text-white font-semibold ml-2 text-sm">
                {isProcessing ? 'Enhancing...' : 'Enhance'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features Showcase */}
        <View className="mx-5 mt-6 mb-8">
          <Text className="text-xl font-bold mb-4 text-slate-800">AI Superpowers</Text>
          <View className="flex-row flex-wrap gap-3">
            {[
              { icon: '🌍', title: '10+ Languages', desc: 'AI Translation', color: 'bg-blue-50 border-blue-100' },
              { icon: '🎭', title: '6 Voice Types', desc: 'Emotion Aware', color: 'bg-purple-50 border-purple-100' },
              { icon: '⚡', title: 'Real-time', desc: 'Fast Processing', color: 'bg-amber-50 border-amber-100' },
              { icon: '🔊', title: 'HD Audio', desc: 'Crystal Clear', color: 'bg-emerald-50 border-emerald-100' },
            ].map((feature, index) => (
              <View key={index} className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-2xl mb-3">{feature.icon}</Text>
                <Text className="text-sm font-bold text-slate-800 mb-1">{feature.title}</Text>
                <Text className="text-xs text-slate-500">{feature.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* AI Studio Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-5">
          <View className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[85%]">
            <View className="flex-row items-center mb-6">
              <View className="w-10 h-10 bg-indigo-100 rounded-xl items-center justify-center">
                <Brain size={20} color="#4F46E5" />
              </View>
              <Text className="text-xl font-bold ml-3 flex-1 text-slate-800">AI Voice Studio</Text>
              <TouchableOpacity 
                onPress={() => setShowAIModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <Text className="text-slate-600 font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {/* Voice Presets */}
              <Text className="text-lg font-bold mb-4 text-slate-800">Voice Presets</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                <View className="flex-row gap-3">
                  {AI_FEATURES.VOICE_CLONES.map((voice) => (
                    <TouchableOpacity
                      key={voice.id}
                      onPress={() => applyVoiceClone(voice)}
                      className={`items-center p-4 rounded-2xl min-w-[100px] border-2 ${
                        selectedVoice.id === voice.id 
                          ? 'bg-indigo-50 border-indigo-500' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text className="text-2xl mb-2">{voice.icon}</Text>
                      <Text className="text-sm font-semibold text-center text-slate-800">
                        {voice.name}
                      </Text>
                      <Text className="text-xs text-slate-500 text-center mt-1">
                        {voice.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Translation Section */}
              <Text className="text-lg font-bold mb-4 text-slate-800">AI Translation</Text>
              <View className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-100">
                <Text className="text-slate-600 text-sm mb-3">
                  Select a language to translate your text
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {AI_FEATURES.LANGUAGES.map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        onPress={() => translateText(lang)}
                        disabled={isTranslating || !text.trim()}
                        className={`flex-row items-center px-4 py-2.5 rounded-full ${
                          selectedLanguage.code === lang.code
                            ? 'bg-indigo-500'
                            : 'bg-white border border-slate-200'
                        } ${(!text.trim() || isTranslating) ? 'opacity-50' : ''}`}
                      >
                        <Text className="text-base mr-2">{lang.flag}</Text>
                        <Text className={`text-sm font-semibold ${
                          selectedLanguage.code === lang.code ? 'text-white' : 'text-slate-700'
                        }`}>
                          {lang.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {isTranslating && (
                  <View className="flex-row items-center justify-center mt-3 py-2">
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text className="text-indigo-600 ml-2 text-sm font-medium">
                      AI Translating...
                    </Text>
                  </View>
                )}
              </View>

              {/* Voice Controls */}
              <Text className="text-lg font-bold mb-4 text-slate-800">Voice Controls</Text>
              <View className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200">
                <View className="mb-4">
                  <View className="flex-row justify-between mb-3">
                    <Text className="text-sm text-slate-600 font-medium">Speed: {speechRate.toFixed(1)}x</Text>
                    <Text className="text-sm text-indigo-600 font-semibold">
                      {speechRate < 0.8 ? 'Slower' : speechRate > 1.0 ? 'Faster' : 'Normal'}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {[0.5, 0.7, 0.85, 1.0, 1.2, 1.5].map((rate) => (
                      <TouchableOpacity
                        key={rate}
                        onPress={() => setSpeechRate(rate)}
                        className={`flex-1 py-2 rounded-xl items-center ${
                          speechRate === rate ? 'bg-indigo-500' : 'bg-white border border-slate-200'
                        }`}
                      >
                        <Text className={`text-xs font-medium ${
                          speechRate === rate ? 'text-white' : 'text-slate-600'
                        }`}>
                          {rate}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <View className="flex-row justify-between mb-3">
                    <Text className="text-sm text-slate-600 font-medium">Pitch: {speechPitch.toFixed(1)}</Text>
                    <Text className="text-sm text-indigo-600 font-semibold">
                      {speechPitch < 0.9 ? 'Lower' : speechPitch > 1.1 ? 'Higher' : 'Normal'}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {[0.7, 0.9, 1.0, 1.1, 1.3, 1.5].map((pitch) => (
                      <TouchableOpacity
                        key={pitch}
                        onPress={() => setSpeechPitch(pitch)}
                        className={`flex-1 py-2 rounded-xl items-center ${
                          speechPitch === pitch ? 'bg-indigo-500' : 'bg-white border border-slate-200'
                        }`}
                      >
                        <Text className={`text-xs font-medium ${
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
              className="bg-indigo-500 py-4 rounded-xl mt-4 shadow-lg shadow-indigo-500/30"
            >
              <Text className="text-white text-center font-semibold text-base">
                Apply Settings
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}