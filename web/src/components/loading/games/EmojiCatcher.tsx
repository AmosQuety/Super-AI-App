import { useState, useEffect, useRef, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  emoji: string;
  speed: number;
}

const EMOJIS = ['🤖', '⭐', '💎', '🔥', '⚡', '🌈', '🧩', '🚀'];

export default function EmojiCatcher({ settings, onGameOver }: { settings: any, onGameOver: (score: number) => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<Point[]>([]);
  const catcherX = useRef(50); // percentage 0-100
  const lastTimeRef = useRef(performance.now());
  const animationRef = useRef<number>(0);

  const startGame = () => {
    setScore(0);
    setGameState('playing');
    itemsRef.current = [];
    catcherX.current = 50;
    lastTimeRef.current = performance.now();
  };

  const DIFFICULTY_MAP = {
    easy: { spawnRate: 0.02, speedScale: 1 },
    medium: { spawnRate: 0.04, speedScale: 1.5 },
    hard: { spawnRate: 0.08, speedScale: 2.2 },
  };

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.medium;

  const update = useCallback((time: number) => {
    if (gameState !== 'playing') return;

    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Spawn item
    if (Math.random() < diff.spawnRate) {
      itemsRef.current.push({
        x: Math.random() * 100,
        y: -10,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        speed: (2 + Math.random() * 3) * diff.speedScale,
      });
    }

    // Update items
    itemsRef.current = itemsRef.current.filter(item => {
      item.y += item.speed * (dt / 16);
      
      // Check collision
      const dist = Math.abs(item.x - catcherX.current);
      if (item.y > 85 && item.y < 95 && dist < 12) {
        setScore(s => s + 10);
        if (settings.soundEnabled) {
          // Subtle audio feedback could be added here
        }
        return false;
      }

      // Missed item
      if (item.y > 110) {
        setGameState('gameover');
        onGameOver(score);
        return false;
      }
      return true;
    });

    draw();
    animationRef.current = requestAnimationFrame(update);
  }, [gameState, score, settings.difficulty, settings.soundEnabled, onGameOver, diff]);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Catcher
    const x = (catcherX.current / 100) * canvas.width;
    const catcherWidth = 60;
    
    // Glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    
    // Draw "Basket"
    ctx.beginPath();
    ctx.roundRect(x - catcherWidth/2, canvas.height - 40, catcherWidth, 20, 10);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Items
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    itemsRef.current.forEach(item => {
      ctx.fillText(item.emoji, (item.x / 100) * canvas.width, (item.y / 100) * canvas.height);
    });
  };

  useEffect(() => {
    if (gameState === 'playing') {
      animationRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, update]);

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
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') catcherX.current = Math.max(0, catcherX.current - 5);
      if (e.key === 'ArrowRight') catcherX.current = Math.min(100, catcherX.current + 5);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative touch-none">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={500} 
        className="w-full h-full cursor-none"
      />
      
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
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
