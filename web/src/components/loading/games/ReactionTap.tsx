import { useState, useEffect, useRef, useCallback } from 'react';
import { playGameOver, playCatch } from '../../../utils/soundUtils';

interface Target {
  x: number;
  y: number;
  size: number;
  id: number;
  expiry: number;
}

const DIFFICULTY_MAP = {
  easy: { initialTime: 1200, decay: 0.98, minTime: 500 },
  medium: { initialTime: 800, decay: 0.97, minTime: 400 },
  hard: { initialTime: 600, decay: 0.96, minTime: 300 },
};

export default function ReactionTap({ settings, autoStart, onGameOver, onSwitchGame }: { settings: any, autoStart?: boolean, onGameOver: (score: number) => void, onSwitchGame: () => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [target, setTarget] = useState<Target | null>(null);

  const scoreRef = useRef(0);
  const lastTimeRef = useRef(0);
  const nextId = useRef(0);
  const timeLimitRef = useRef(DIFFICULTY_MAP.medium.initialTime);
  const animationRef = useRef(0);
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle');

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.medium;

  const spawnTarget = useCallback(() => {
    const newTarget: Target = {
      id: nextId.current++,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      size: 60 + Math.random() * 40,
      expiry: performance.now() + timeLimitRef.current,
    };
    setTarget(newTarget);
    lastTimeRef.current = performance.now();
  }, []);

  const startGame = () => {
    scoreRef.current = 0;
    setScore(0);
    timeLimitRef.current = diff.initialTime;
    setGameState('playing');
    gameStateRef.current = 'playing';
    spawnTarget();
  };

  useEffect(() => {
    if (autoStart && gameState === 'idle') {
      startGame();
    }
  }, [autoStart]);

  const handleTap = (id: number) => {
    if (gameStateRef.current !== 'playing' || !target || target.id !== id) return;

    // Calculate reaction time
    const reactionTime = performance.now() - lastTimeRef.current;
    const points = Math.max(10, Math.floor((timeLimitRef.current - reactionTime) / 10));

    scoreRef.current += points;
    setScore(scoreRef.current);

    if (settings.soundEnabled) playCatch();

    // Decay the time limit to make it harder
    timeLimitRef.current = Math.max(diff.minTime, timeLimitRef.current * diff.decay);

    spawnTarget();
  };

  const update = useCallback((time: number) => {
    if (gameStateRef.current !== 'playing') return;

    if (target && time > target.expiry) {
      setGameState('gameover');
      gameStateRef.current = 'gameover';
      onGameOver(scoreRef.current);
      if (settings.soundEnabled) playGameOver();
      return;
    }

    animationRef.current = requestAnimationFrame(update);
  }, [target, onGameOver, settings.soundEnabled]);

  useEffect(() => {
    if (gameState === 'playing') {
      animationRef.current = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameState, update]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-950 overflow-hidden select-none touch-none">
      {gameState === 'idle' && (
        <div className="flex flex-col items-center">
          <h4 className="text-white font-black text-2xl mb-4 italic tracking-tighter">REACTION TAP</h4>
          <button onClick={startGame} className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            INITIALIZE
          </button>
        </div>
      )}

      {gameState === 'playing' && target && (
        <>
          <div className="absolute top-20 left-1/2 -translate-x-1/2 text-5xl font-black text-white/10 tabular-nums">
            {score}
          </div>

          {/* Progress countdown ring */}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{
                width: `${Math.max(0, ((target.expiry - performance.now()) / timeLimitRef.current) * 100)}%`,
                transition: 'width 16ms linear'
              }}
            />
          </div>

          <button
            onMouseDown={() => handleTap(target.id)}
            onTouchStart={() => handleTap(target.id)}
            className="absolute flex items-center justify-center rounded-full bg-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.6)] border-4 border-white/20 active:scale-90 transition-transform cursor-pointer"
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
              width: `${target.size}px`,
              height: `${target.size}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-4 h-4 bg-white rounded-full animate-ping" />
          </button>
        </>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in zoom-in duration-300 px-6 text-center z-30">
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter">TOO SLOW!</h4>
          <p className="text-slate-400 text-lg font-black mb-6 uppercase tracking-widest">FINAL SCORE: {score}</p>
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <button onClick={startGame} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-xl">
              RETRY SESSION
            </button>
            <button onClick={onSwitchGame} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 text-sm">
              TRY ANOTHER GAME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
