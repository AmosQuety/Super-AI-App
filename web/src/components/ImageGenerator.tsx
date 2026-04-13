// src/components/ImageGenerator.tsx
import  { useState, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Sparkles, Download, RotateCcw, Image as ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { GENERATE_AI_IMAGE_VARIANTS, GET_AI_IMAGE_STATUS } from "../graphql/images";
import { useToast } from "./ui/toastContext";
import ProcessingState from "./loading/ProcessingState";
import { useBrowserNotification } from "../hooks/useBrowserNotification";
import Skeleton from "./ui/Skeleton";
import { logger } from "../utils/logger";


// --- TYPE DEFINITIONS ---
interface AIImageStatusData {
  aiImageGenerationStatus: {
    available: boolean;
    message: string;
  };
}

interface GenerateImagesResult {
  success: boolean;
  images?: string[];
  generationTime?: string;
  error?: string;
}

interface GenerateImagesData {
  generateAIImageVariants: GenerateImagesResult;
}

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const { addToast } = useToast();
  const { requestPermission, notifyWhenReady } = useBrowserNotification();
 

  // Check AI service status on component mount
  const { data: statusData, loading: statusLoading, error: statusError } = useQuery<AIImageStatusData>(GET_AI_IMAGE_STATUS, {
    fetchPolicy: 'network-only',
    pollInterval: 30000, // Re-check every 30 seconds
  });

  // Debug logging
  useEffect(() => {
    logger.debug('📊 Status Query Result:', {
      loading: statusLoading,
      error: statusError,
      data: statusData,
    });
  }, [statusData, statusLoading, statusError]);

  const [generateImagesMutation] = useMutation<GenerateImagesData>(GENERATE_AI_IMAGE_VARIANTS, {
    onError: (err) => {
      logger.error("GraphQL error:", err);
      setError(err.message || "Failed to generate images");
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setError(null);
    setImages([]);
    const notificationsEnabled = await requestPermission();
    addToast({
      type: 'info',
      title: 'Running in background',
      message: notificationsEnabled
        ? 'You can leave, we will notify you when images are ready, and the task stays recoverable in Recent AI Tasks.'
        : 'You can leave safely. Even without notifications, you can recover results in Recent AI Tasks.',
    });

    try {
      const conn = (navigator as any).connection;
      const isSlowNetwork = conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData);
      const safePrompt = isSlowNetwork ? `${prompt.trim()} --ar 1:1 --v 5.0 --stop 80 --quality 0.5` : prompt.trim(); // Add midjourney/dalle style quality flags for low bandwidth routing
      
      if (isSlowNetwork) {
         addToast({ type: 'success', title: 'Data Saver', message: 'Generating highly compressed previews to save data.' });
      }

      const { data } = await generateImagesMutation({
        variables: { prompt: safePrompt },
      });

      if (data?.generateAIImageVariants.success && data.generateAIImageVariants.images) {
        setImages(data.generateAIImageVariants.images);
        
        addToast({
          type: 'success',
          title: 'Images Generated!',
          message: `Created ${data.generateAIImageVariants.images.length} images in ${data.generateAIImageVariants.generationTime}`,
        });
        
        notifyWhenReady("Images Generated", { body: `Your AI images are ready.` });

        logger.info(`✅ Generated ${data.generateAIImageVariants.images.length} images in ${data.generateAIImageVariants.generationTime}`);
      } else {
        const errorMsg = data?.generateAIImageVariants.error || "Unknown error";
        setError(errorMsg);

        addToast({
          type: 'error',
          title: 'Generation Failed',
          message: errorMsg,
        });
        
        notifyWhenReady("Generation Failed", { body: errorMsg });
      
        logger.error("Generation failed:", errorMsg);
        
        // Fallback to Lorem Picsum for demo purposes
        if (import.meta.env.MODE === 'development') {
          const fallback = Array(4).fill(null).map((_, i) => 
            `https://picsum.photos/seed/${prompt.replace(/\s+/g, '-')}-${i}/512/512`
          );
          setImages(fallback);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error. Please check your connection.";
      logger.error("Error generating images:", error);
      setError(errorMessage);
      
      addToast({
        type: 'error',
        title: 'Generation Error',
        message: errorMessage,
      });
      
      notifyWhenReady("Generation Error", { body: errorMessage });

      // Fallback on error for development
      if (import.meta.env.MODE === 'development') {
        const fallback = Array(4).fill(null).map((_, i) => 
          `https://picsum.photos/seed/${prompt.replace(/\s+/g, '-')}-${i}/512/512`
        );
        setImages(fallback);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (imageData: string, index: number) => {
    try {
      setDownloading(index);
      
      if (imageData.startsWith('data:image')) {
        // Base64 image
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `${prompt.replace(/\s+/g, '_')}_${index + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // URL image
        const response = await fetch(imageData);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${prompt.replace(/\s+/g, '_')}_${index + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      addToast({
        type: 'success',
        title: 'Download Complete',
        message: `Image ${index + 1} downloaded successfully`,
      });
      
      logger.log(`Downloaded image ${index + 1}`);
    } catch (error) {
      logger.error("Download failed:", error);
      setError("Failed to download image");
    } finally {
      setDownloading(null);
    }
  };

  const handleRegenerate = () => {
    if (prompt.trim()) {
      handleGenerate();
    }
  };

  // More defensive checking
  const isServiceAvailable = statusData?.aiImageGenerationStatus?.available ?? false;
  const serviceMessage = statusData?.aiImageGenerationStatus?.message ?? 'Checking service...';

  // Show loading state while checking
  if (statusLoading) {
    logger.debug('⏳ Still loading status...');
  }

  // Show error if query failed
  if (statusError) {
    logger.error('❌ Status query error:', statusError);
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-3">
          AI Image Generator
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
          Transform your ideas into stunning visuals with AI-powered image generation.
        </p>
        
        {/* Service Status */}
        {statusLoading ? (
          <div className="mt-4 flex justify-center">
            <Skeleton width={180} height={36} className="rounded-lg" />
          </div>
        ) : statusError ? (
          <div className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Error checking service: {statusError.message}</span>
          </div>
        ) : (
          <div className={`mt-4 inline-flex items-center px-4 py-2 rounded-lg ${isServiceAvailable ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'}`}>
            {isServiceAvailable ? (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            ) : (
              <AlertCircle className="w-4 h-4 mr-2" />
            )}
            <span className="text-sm font-medium">
              {isServiceAvailable ? '✓ AI Service Available' : `⚠ ${serviceMessage}`}
            </span>
          </div>
        )}
      </div>

      {/* Prompt input */}
      <div className="bg-theme-secondary rounded-2xl p-6 shadow-theme-xl border border-theme-light mb-10 sticky top-20 z-10 backdrop-blur-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A majestic lion wearing a crown, cinematic lighting, hyperrealistic"
              className="w-full p-4 pl-5 border-2 border-theme-light rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-theme-input text-theme-primary transition-all duration-300"
              disabled={loading || !isServiceAvailable}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              maxLength={500}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">
              {prompt.length}/500
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || !isServiceAvailable}
            className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/30 transform hover:scale-105"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate
              </>
            )}
          </button>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="w-full max-w-4xl mx-auto py-12 animate-in fade-in duration-500">
            <div className="text-center mb-6">
                <h4 className="text-xl font-bold text-theme-primary">Neural Pathway Folding...</h4>
                <p className="text-xs text-theme-tertiary italic mt-1 mb-4">The AI is processing your request</p>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                ))}
            </div>

            <ProcessingState operationLabel="Generating AI Imagery" />
            
            <p className="text-theme-tertiary text-sm mt-6 text-center">
                This may take 10-30 seconds depending on server load
            </p>
        </div>
      ) : images.length > 0 ? (
        <div className="bg-theme-secondary rounded-3xl p-6 md:p-8 shadow-theme-xl border border-theme-light">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Your Creations
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={loading || !isServiceAvailable}
                className="px-4 py-2 bg-theme-tertiary text-theme-secondary rounded-lg hover:bg-theme-secondary transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 font-medium border border-theme-light"
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {images.map((src, i) => (
              <div
                key={i}
                className="group relative bg-theme-tertiary rounded-xl overflow-hidden aspect-square shadow-theme-md border border-theme-light"
              >
                <img
                  src={src}
                  alt={`Generated image of ${prompt} - ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-sm">
                  <button
                    onClick={() => handleDownload(src, i)}
                    disabled={downloading === i}
                    title="Download Image"
                    aria-label={`Download image ${i + 1}`}
                    className="p-3 bg-white/90 text-slate-950 rounded-full hover:bg-white transition-colors duration-200 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-theme-lg disabled:opacity-50"
                  >
                    {downloading === i ? (
                      <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full font-mono">
                  #{i + 1}
                </div>
              </div>
            ))}
          </div>
          
          {/* Generation info */}
          <div className="mt-6 pt-6 border-t border-theme-light">
            <p className="text-theme-tertiary text-sm text-center">
              Images generated using Stable Diffusion XL • Save your favorites by downloading them
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 bg-theme-tertiary rounded-full flex items-center justify-center border-4 border-theme-light shadow-theme-lg">
            <ImageIcon className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="text-2xl font-bold text-theme-primary mb-2">
            Nothing generated yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
            {isServiceAvailable 
              ? "Enter a prompt above and click 'Generate' to create stunning AI-generated images."
              : "AI image generation service is currently unavailable. Please try again later."
            }
          </p>
          {!isServiceAvailable && (
            <div className="inline-flex items-center px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Service: {serviceMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}