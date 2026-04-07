import { memo } from 'react';

interface VoiceVisualizerProps {
  vol: number;
  isListening: boolean;
}

const VoiceVisualizer = memo(({ vol, isListening }: VoiceVisualizerProps) => {
  if (!isListening) return null;

  return (
    <div className="flex items-end gap-1 h-8 animate-in fade-in duration-300">
      {[...Array(5)].map((_, i) => (
        <div 
          key={i} 
          className="w-1 bg-blue-500 rounded-full transition-all duration-75"
          style={{ 
            height: `${Math.max(20, Math.random() * (vol * 100))}%`,
            opacity: 0.7 + (i * 0.05)
          }} 
        />
      ))}
    </div>
  );
});

VoiceVisualizer.displayName = 'VoiceVisualizer';

export default VoiceVisualizer;
