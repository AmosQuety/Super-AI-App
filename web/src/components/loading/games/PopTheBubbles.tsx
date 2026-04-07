import { useState, useEffect, useRef, useCallback } from 'react';
import { playPop, playGameOver } from '../../../utils/soundUtils';

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

export default function PopTheBubbles({ settings, autoStart, onGameOver, onSwitchGame }: { settings: any, autoStart?: boolean, onGameOver: (score: number) => void, onSwitchGame: () => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const nextId = useRef(0);
  // Refs to avoid stale closures in intervals
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle');
  const gameOverFiredRef = useRef(false);

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.easy;
  // Keep a ref so AI logic can read latest diff without restarting
  const diffRef = useRef(diff);
  const bubblesRef = useRef<Bubble[]>([]);
  const lastTimeRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const animationRef = useRef(0);

  useEffect(() => { diffRef.current = diff; }, [settings.difficulty]);

  const startGame = () => {
    scoreRef.current = 0;
    gameStateRef.current = 'playing';
    gameOverFiredRef.current = false;
    setScore(0);
    setGameState('playing');
    setBubbles([]);
    bubblesRef.current = [];
    nextId.current = 0;
    lastTimeRef.current = performance.now();
    spawnTimerRef.current = 0;
  };

  // Phase 2: Auto-start logic
  useEffect(() => {
    if (autoStart && gameState === 'idle') {
      startGame();
    }
  }, [autoStart]);

  const popBubble = (id: number) => {
    scoreRef.current += 10;
    setScore(scoreRef.current);
    bubblesRef.current = bubblesRef.current.filter(b => b.id !== id);
    setBubbles(bubblesRef.current);
    
    // UX 5.4: Sound feedback
    if (settings.soundEnabled) playPop();
  };

  const update = useCallback((time: number) => {
    if (gameStateRef.current !== 'playing') return;

    const dt = Math.min(time - lastTimeRef.current, 50);
    lastTimeRef.current = time;
    const currentDiff = diffRef.current;

    // 1. Handle Spawning
    spawnTimerRef.current += dt;
    // Issue 10: Limit max bubbles (e.g. 10) to prevent CPU waste
    if (spawnTimerRef.current > currentDiff.spawnRate && bubblesRef.current.length < 10) {
        spawnTimerRef.current = 0;
        const newBubble: Bubble = {
            id: nextId.current++,
            x: 10 + Math.random() * 80,
            y: 10 + Math.random() * 80,
            size: 44 + Math.random() * 40,
            hue: Math.random() * 360,
            life: 100,
        };
        bubblesRef.current = [...bubblesRef.current, newBubble];
    }

    // 2. Handle Decay
    let died = false;
    bubblesRef.current = bubblesRef.current.map(b => {
        const nextLife = b.life - currentDiff.lifeDecay * (dt / 50);
        if (nextLife <= 0) died = true;
        return { ...b, life: nextLife };
    });

    if (died && !gameOverFiredRef.current) {
        gameOverFiredRef.current = true;
        gameStateRef.current = 'gameover';
        setGameState('gameover');
        onGameOver(scoreRef.current);
        
        // UX 5.4: Game Over sound
        if (settings.soundEnabled) playGameOver();
        return;
    }

    // Issue 11: Throttle setBubbles (we still call it every frame for smooth life/opacity, 
    // but the report suggests "only call setState when a meaningful threshold is crossed" 
    // for PopTheBubbles specifically because it's DOM-based. 
    // However, for smooth opacity/scale transitions, we do need updates. 
    // I'll stick to direct setState for now but ensured it's RAF-synced.)
    setBubbles([...bubblesRef.current]);

    animationRef.current = requestAnimationFrame(update);
  }, [onGameOver]);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState === 'playing') {
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, update]);

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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md animate-in zoom-in duration-300 px-6 text-center">
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter">TOO SLOW!</h4>
          <p className="text-red-200 text-lg font-black mb-6 uppercase tracking-widest">FINAL SCORE: {score}</p>
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <button onClick={startGame} className="w-full py-4 bg-white text-red-950 font-black rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-xl">
              RETRY SESSION
            </button>
            <button onClick={onSwitchGame} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all border border-white/20 text-sm">
                TRY ANOTHER GAME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
