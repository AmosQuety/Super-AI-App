import { memo } from 'react';

interface VoiceVisualizerProps {
  vol: number; // Volume 0.0 to 1.0+
  isListening: boolean;
}

const VoiceVisualizer = memo(({ vol, isListening }: VoiceVisualizerProps) => {
  if (!isListening) return null;

  // Enhance the volume input to make the orb react significantly.
  // We use clamping to ensure it doesn't break the UI.
  const scale = 1 + Math.min(vol * 2.5, 2); 
  const glow = 10 + Math.min(vol * 50, 60);

  return (
    <div className="absolute top-1/2 right-8 -translate-y-1/2 flex items-center justify-center pointer-events-none">
      <div className="relative flex items-center justify-center w-12 h-12">
        {/* Outer Glow / Aura */}
        <div 
          className="absolute inset-0 rounded-full bg-blue-500/30 transition-all duration-75 ease-out"
          style={{
            transform: `scale(${scale * 1.5})`,
            boxShadow: `0 0 ${glow}px ${glow / 2}px rgba(59, 130, 246, 0.4)`,
          }}
        />
        
        {/* Inner Morphing Orb */}
        <div 
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-600 via-cyan-400 to-teal-300 transition-all duration-75 ease-out animate-pulse"
          style={{
            transform: `scale(${scale})`,
            // Slight border radius shift for a more organic, liquid feel
            borderRadius: `${50 + (Math.random() * 10 - 5)}%`,
          }}
        />

        {/* Center Bright Core */}
        <div className="w-1/2 h-1/2 bg-white rounded-full opacity-80 blur-[2px]" />
      </div>
    </div>
  );
});

VoiceVisualizer.displayName = 'VoiceVisualizer';

export default VoiceVisualizer;
