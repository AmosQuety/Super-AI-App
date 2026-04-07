import { useState, useEffect, useRef, useCallback } from 'react';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  hue: number;
  life: number;
}

const DIFFICULTY_MAP = {
  easy: { spawnRate: 1500, lifeDecay: 0.4 },
  medium: { spawnRate: 1000, lifeDecay: 0.9 },
  hard: { spawnRate: 600, lifeDecay: 1.6 },
};

export default function PopTheBubbles({ settings, onGameOver }: { settings: any, onGameOver: (score: number) => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const nextId = useRef(0);
  // Refs to avoid stale closures in intervals
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle');
  const gameOverFiredRef = useRef(false);

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.easy;
  // Keep a ref so intervals can read latest diff without restarting
  const diffRef = useRef(diff);
  useEffect(() => { diffRef.current = diff; }, [settings.difficulty]);

  const startGame = () => {
    scoreRef.current = 0;
    gameStateRef.current = 'playing';
    gameOverFiredRef.current = false;
    setScore(0);
    setGameState('playing');
    setBubbles([]);
  };

  const spawnBubble = useCallback(() => {
    const newBubble: Bubble = {
      id: nextId.current++,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 44 + Math.random() * 40,
      hue: Math.random() * 360,
      life: 100,
    };
    setBubbles(prev => [...prev, newBubble]);
  }, []);

  const popBubble = (id: number) => {
    scoreRef.current += 10;
    setScore(scoreRef.current);
    setBubbles(prev => prev.filter(b => b.id !== id));
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    // Spawn interval — only depends on spawnRate, not score
    const spawnInterval = setInterval(() => {
      spawnBubble();
    }, diffRef.current.spawnRate);

    // Decay interval — uses ref for score to avoid stale closure
    const decayInterval = setInterval(() => {
      if (gameStateRef.current !== 'playing') return;

      setBubbles(prev => {
        const next = prev.map(b => ({ ...b, life: b.life - diffRef.current.lifeDecay }));
        const died = next.find(b => b.life <= 0);

        if (died && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          gameStateRef.current = 'gameover';
          // Use setTimeout so state update isn't mid-render
          setTimeout(() => {
            setGameState('gameover');
            onGameOver(scoreRef.current);
          }, 0);
          return prev; // keep bubbles visible for a moment
        }
        return next;
      });
    }, 50); // 50ms tick — smooth enough without thrashing

    return () => {
      clearInterval(spawnInterval);
      clearInterval(decayInterval);
    };
    // Only restart when game state changes — NOT on score changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, spawnBubble, onGameOver]);

  // Keep gameStateRef in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative touch-none bg-slate-950 overflow-hidden">
      {bubbles.map(bubble => (
        <button
          key={bubble.id}
          onMouseDown={() => popBubble(bubble.id)}
          onTouchStart={(e) => { e.preventDefault(); popBubble(bubble.id); }}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform active:scale-75 hover:scale-110"
          style={{
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            borderColor: `hsla(${bubble.hue}, 80%, 70%, 0.8)`,
            backgroundColor: `hsla(${bubble.hue}, 80%, 70%, 0.15)`,
            boxShadow: `0 0 ${bubble.size * 0.4}px hsla(${bubble.hue}, 80%, 70%, ${bubble.life / 300})`,
            opacity: Math.max(0.15, bubble.life / 100),
            transform: `translate(-50%, -50%) scale(${0.4 + (bubble.life / 165)})`,
          }}
        >
          {/* Bubble shine */}
          <div className="absolute top-[18%] left-[18%] w-[30%] h-[20%] bg-white/50 rounded-full blur-[1px]" />
          {/* Life indicator ring */}
          <div
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: `hsla(${bubble.hue}, 80%, 70%, 0.4)`,
              transform: `scale(${1.15})`,
              opacity: bubble.life < 40 ? (bubble.life / 40) : 0,
              animation: bubble.life < 40 ? 'ping 0.6s cubic-bezier(0,0,0.2,1) infinite' : 'none',
            }}
          />
        </button>
      ))}

      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <h4 className="text-white font-black text-2xl mb-2 italic tracking-tighter">POP THE BUBBLES</h4>
          <p className="text-slate-400 text-xs mb-6 font-bold uppercase tracking-widest text-center px-8">Tap bubbles before they vanish!</p>
          <button onClick={startGame} className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-full transition-all hover:scale-105 shadow-xl shadow-purple-500/20">
            INITIALIZE
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-4xl font-black text-white/30 select-none pointer-events-none tabular-nums">
          {score}
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md animate-in zoom-in duration-300">
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter">TOO SLOW!</h4>
          <p className="text-red-200 text-lg font-black mb-6">SCORE: {score}</p>
          <button onClick={startGame} className="px-8 py-3 bg-white text-red-950 font-black rounded-full transition-all hover:scale-105">
            RETRY SESSION
          </button>
        </div>
      )}
    </div>
  );
}
