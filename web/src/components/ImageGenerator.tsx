// src/components/ImageGenerator.tsx
import React, { useState } from "react";
import { Sparkles, Download, RotateCcw, Image as ImageIcon } from "lucide-react";

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      // Simulate API call with timeout
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const generated = [
        `https://picsum.photos/seed/${prompt}-1/512/512`,
        `https://picsum.photos/seed/${prompt}-2/512/512`,
        `https://picsum.photos/seed/${prompt}-3/512/512`,
        `https://picsum.photos/seed/${prompt}-4/512/512`,
      ];
      setImages(generated);
    } catch (err) {
      console.error("Error generating images:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, index: number) => {
    // In a real app, this would trigger a proper download
    console.log("Downloading image", index, url);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prompt.replace(/\s+/g, '_')}_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerate = () => {
    if (prompt.trim()) {
      handleGenerate();
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-3">
          AI Image Generator
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
          Transform your ideas into stunning visuals with AI-powered image
          generation.
        </p>
      </div>

      {/* Prompt input */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 mb-10 sticky top-20 z-10 backdrop-blur-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A majestic lion wearing a crown, cinematic lighting, hyperrealistic"
              className="w-full p-4 pl-5 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all duration-300"
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
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
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Creating your masterpiece...
            </p>
          </div>
        </div>
      ) : images.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Your Creations
            </h2>
            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Regenerate
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {images.map((src, i) => (
              <div
                key={i}
                className="group relative bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden aspect-square shadow-lg border border-slate-200 dark:border-slate-700"
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
                    title="Download Image"
                    aria-label={`Download image ${i + 1}`}
                    className="p-3 bg-white/90 text-slate-900 rounded-full hover:bg-white transition-colors duration-200 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full font-mono">
                  #{i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg">
            <ImageIcon className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Nothing generated yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Enter a prompt above and click "Generate" to create stunning AI-generated images.
          </p>
        </div>
      )}
    </div>
  );
}