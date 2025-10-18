// src/components/ImageGenerator.tsx
import React, { useState } from "react";
import { Sparkles, Download, RotateCcw } from "lucide-react";

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
        `https://picsum.photos/seed/${prompt}-1/300/300`,
        `https://picsum.photos/seed/${prompt}-2/300/300`,
        `https://picsum.photos/seed/${prompt}-3/300/300`,
        `https://picsum.photos/seed/${prompt}-4/300/300`,
      ];
      setImages(generated);
    } catch (err) {
      console.error("Error generating images:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, index: number) => {
    // In a real app, this would download the image
    console.log("Downloading image", index, url);
  };

  const handleRegenerate = () => {
    if (prompt.trim()) {
      handleGenerate();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          AI Image Generator
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Transform your ideas into stunning visuals with AI-powered image
          generation
        </p>
      </div>

      {/* Prompt input */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to see... (e.g., 'a sunset over mountains with cherry blossoms')"
              className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={loading}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      {/* Results */}
      {images.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Generated Images
            </h2>
            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Regenerate
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {images.map((src, i) => (
              <div
                key={i}
                className="group relative bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden aspect-square"
              >
                <img
                  src={src}
                  alt={`Generated ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleDownload(src, i)}
                    className="p-3 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-colors duration-200 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Creating your images...
            </p>
          </div>
        </div>
      )}

      {!loading && images.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Nothing generated yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Enter a prompt above to create stunning AI-generated images
          </p>
        </div>
      )}
    </div>
  );
}
