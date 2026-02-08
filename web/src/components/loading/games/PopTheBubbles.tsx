import { useState, useEffect, useRef, useCallback } from 'react';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  hue: number;
  life: number;
}

export default function PopTheBubbles({ settings, onGameOver }: { settings: any, onGameOver: (score: number) => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const nextId = useRef(0);

  const DIFFICULTY_MAP = {
    easy: { spawnRate: 1500, lifeDecay: 0.5 },
    medium: { spawnRate: 1000, lifeDecay: 1 },
    hard: { spawnRate: 600, lifeDecay: 1.8 },
  };

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.medium;

  const startGame = () => {
    setScore(0);
    setGameState('playing');
    setBubbles([]);
  };

  const spawnBubble = useCallback(() => {
    const newBubble: Bubble = {
      id: nextId.current++,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 40 + Math.random() * 40,
      hue: Math.random() * 360,
      life: 100,
    };
    setBubbles(prev => [...prev, newBubble]);
  }, []);

  const popBubble = (id: number) => {
    setScore(s => s + 10);
    setBubbles(prev => prev.filter(b => b.id !== id));
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      spawnBubble();
    }, diff.spawnRate);

    const decayInterval = setInterval(() => {
      setBubbles(prev => {
        const next = prev.map(b => ({ ...b, life: b.life - diff.lifeDecay }));
        const died = next.find(b => b.life <= 0);
        if (died) {
          setGameState('gameover');
          onGameOver(score);
          return prev;
        }
        return next;
       });
    }, 16);

    return () => {
      clearInterval(interval);
      clearInterval(decayInterval);
    };
  }, [gameState, spawnBubble, diff, score, onGameOver]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative touch-none bg-slate-950 overflow-hidden">
      {bubbles.map(bubble => (
        <button
          key={bubble.id}
          onMouseDown={() => popBubble(bubble.id)}
          onTouchStart={(e) => { e.preventDefault(); popBubble(bubble.id); }}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform active:scale-90"
          style={{
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            borderColor: `hsla(${bubble.hue}, 80%, 70%, 0.8)`,
            backgroundColor: `hsla(${bubble.hue}, 80%, 70%, 0.2)`,
            boxShadow: `0 0 20px hsla(${bubble.hue}, 80%, 70%, 0.3)`,
            opacity: bubble.life / 100,
            scale: 0.5 + (bubble.life / 200),
          }}
        >
          <div className="absolute top-1/4 left-1/4 w-1/4 h-1/4 bg-white/40 rounded-full blur-[2px]" />
        </button>
      ))}

      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <h4 className="text-white font-black text-2xl mb-2 italic tracking-tighter">POP THE BUBBLES</h4>
          <p className="text-slate-400 text-xs mb-6 font-bold uppercase tracking-widest text-center px-8">Tap bubbles before they vanish!</p>
          <button onClick={startGame} className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-full shadow-xl shadow-purple-500/20">
            INITIALIZE
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-4xl font-black text-white/10 select-none pointer-events-none">
          {score}
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md">
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter">TOO SLOW!</h4>
          <p className="text-red-200 text-lg font-black mb-6">SCORE: {score}</p>
          <button onClick={startGame} className="px-8 py-3 bg-white text-red-950 font-black rounded-full">
            RETRY SESSION
          </button>
        </div>
      )}
    </div>
  );
}
