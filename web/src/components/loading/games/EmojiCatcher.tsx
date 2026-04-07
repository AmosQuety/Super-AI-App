import { useState, useEffect, useRef, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  emoji: string;
  speed: number;
}

const EMOJIS = ['🤖', '⭐', '💎', '🔥', '⚡', '🌈', '🧩', '🚀'];

const DIFFICULTY_MAP = {
  easy: { spawnRate: 0.015, speedScale: 0.8 },
  medium: { spawnRate: 0.03, speedScale: 1.1 },
  hard: { spawnRate: 0.06, speedScale: 1.6 },
};

export default function EmojiCatcher({ settings, onGameOver }: { settings: any, onGameOver: (score: number) => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Point[]>([]);
  const catcherX = useRef(50); // percentage 0-100
  const lastTimeRef = useRef(performance.now());
  const animationRef = useRef<number>(0);
  // Use refs for values needed inside the RAF loop to avoid stale closures
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle');
  const diffRef = useRef(DIFFICULTY_MAP.easy);
  const gameOverFiredRef = useRef(false);

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.easy;

  // Keep refs in sync
  useEffect(() => { diffRef.current = diff; }, [settings.difficulty]);

  const startGame = () => {
    scoreRef.current = 0;
    gameStateRef.current = 'playing';
    gameOverFiredRef.current = false;
    setScore(0);
    setGameState('playing');
    itemsRef.current = [];
    catcherX.current = 50;
    lastTimeRef.current = performance.now();
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Draw Catcher
    const x = (catcherX.current / 100) * W;
    const catcherWidth = Math.max(48, W * 0.15);

    ctx.shadowBlur = 15;
    ctx.shadowColor = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(x - catcherWidth / 2, H - 38, catcherWidth, 18, 9);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw shimmer on catcher
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(x - catcherWidth / 2 + 4, H - 36, catcherWidth * 0.4, 6, 3);
    ctx.fill();

    // Draw emojis
    const fontSize = Math.max(18, W * 0.065);
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    itemsRef.current.forEach(item => {
      ctx.fillText(item.emoji, (item.x / 100) * W, (item.y / 100) * H);
    });
  }, []);

  const update = useCallback((time: number) => {
    if (gameStateRef.current !== 'playing') return;

    const dt = Math.min(time - lastTimeRef.current, 50); // cap dt to prevent huge jumps
    lastTimeRef.current = time;

    const currentDiff = diffRef.current;

    // Spawn item
    if (Math.random() < currentDiff.spawnRate) {
      itemsRef.current.push({
        x: 5 + Math.random() * 90,
        y: -10,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        speed: (1.5 + Math.random() * 2) * currentDiff.speedScale,
      });
    }

    let missedOne = false;

    // Update items
    itemsRef.current = itemsRef.current.filter(item => {
      item.y += item.speed * (dt / 16);

      // Check collision with catcher
      const dist = Math.abs(item.x - catcherX.current);
      if (item.y > 85 && item.y < 97 && dist < 12) {
        scoreRef.current += 10;
        setScore(scoreRef.current);
        return false;
      }

      // Missed item — only trigger once
      if (item.y > 110) {
        missedOne = true;
        return false;
      }
      return true;
    });

    if (missedOne && !gameOverFiredRef.current) {
      gameOverFiredRef.current = true;
      gameStateRef.current = 'gameover';
      setGameState('gameover');
      onGameOver(scoreRef.current);
      return;
    }

    draw();
    animationRef.current = requestAnimationFrame(update);
  }, [draw, onGameOver]);

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

  // Resize canvas to match container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
        draw();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Handle Controls
  useEffect(() => {
    const handleMove = (x: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const relativeX = ((x - rect.left) / rect.width) * 100;
      catcherX.current = Math.max(0, Math.min(100, relativeX));
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => { if (e.touches[0]) handleMove(e.touches[0].clientX); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') catcherX.current = Math.max(0, catcherX.current - 5);
      if (e.key === 'ArrowRight') catcherX.current = Math.min(100, catcherX.current + 5);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center relative touch-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-none"
      />

      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <h4 className="text-white font-black text-2xl mb-2 italic tracking-tighter">EMOJI CATCHER</h4>
          <p className="text-slate-400 text-xs mb-6 font-bold uppercase tracking-widest text-center px-8">Move the blue bar to catch falling items!</p>
          <button onClick={startGame} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-full transition-all transform hover:scale-105 shadow-xl shadow-blue-500/20">
            INITIALIZE
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-4xl font-black text-white/20 select-none pointer-events-none">
          {score}
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md animate-in zoom-in duration-300">
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter">MISSED ONE!</h4>
          <p className="text-red-200 text-lg font-black mb-6">SCORE: {score}</p>
          <button onClick={startGame} className="px-8 py-3 bg-white text-red-950 font-black rounded-full transition-all transform hover:scale-105">
            RETRY SESSION
          </button>
        </div>
      )}
    </div>
  );
}
