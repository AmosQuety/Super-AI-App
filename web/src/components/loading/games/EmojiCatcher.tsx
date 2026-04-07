import { useState, useEffect, useRef, useCallback } from 'react';
import { playCatch, playGameOver } from '../../../utils/soundUtils';

interface Point {
  id: number;
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

export default function EmojiCatcher({ settings, autoStart, onGameOver, onSwitchGame }: { settings: any, autoStart?: boolean, onGameOver: (score: number) => void, onSwitchGame: () => void }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Point[]>([]);
  const particlesRef = useRef<{ x: number, y: number, life: number, text: string }[]>([]);
  const catcherX = useRef(50); // percentage 0-100
  const lastTimeRef = useRef(performance.now());
  const animationRef = useRef<number>(0);
  // Use refs for values needed inside the RAF loop to avoid stale closures
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle');
  const diffRef = useRef(DIFFICULTY_MAP.easy);
  const gameOverFiredRef = useRef(false);

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.easy;

  // Keep refs in sync
  useEffect(() => { diffRef.current = diff; }, [settings.difficulty]);

  const startGame = () => {
    scoreRef.current = 0;
    livesRef.current = 3;
    gameStateRef.current = 'playing';
    gameOverFiredRef.current = false;
    setScore(0);
    setLives(3);
    setGameState('playing');
    itemsRef.current = [];
    particlesRef.current = [];
    catcherX.current = 50;
    lastTimeRef.current = performance.now();
  };

  // Phase 2: Auto-start logic
  useEffect(() => {
    if (autoStart && gameState === 'idle') {
      startGame();
    }
  }, [autoStart]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Speed scaling (Issue 8)
    const escalatedSpeed = (diffRef.current.speedScale * (1 + scoreRef.current / 500));

    // Draw Catcher
    const x = (catcherX.current / 100) * W;
    const catcherWidth = Math.max(48, W * 0.15);

    ctx.shadowBlur = 15;
    ctx.shadowColor = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    // Use fallback for roundRect to support older browsers (Issue 2 fix)
    if (ctx.roundRect) {
      ctx.roundRect(x - catcherWidth / 2, H - 38, catcherWidth, 18, 9);
    } else {
      ctx.rect(x - catcherWidth / 2, H - 38, catcherWidth, 18);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw shimmer on catcher
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x - catcherWidth / 2 + 4, H - 36, catcherWidth * 0.4, 6, 3);
    } else {
      ctx.rect(x - catcherWidth / 2 + 4, H - 36, catcherWidth * 0.4, 6);
    }
    ctx.fill();

    // Draw emojis
    const fontSize = Math.max(18, W * 0.065);
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    itemsRef.current.forEach(item => {
      ctx.fillText(item.emoji, (item.x / 100) * W, (item.y / 100) * H);
      item.y += escalatedSpeed;
    });

    // Issue 7: Draw Particles
    particlesRef.current.forEach(p => {
        ctx.font = `bold ${Math.floor(20 * p.life + 10)}px sans-serif`;
        ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
        ctx.fillText(p.text, (p.x / 100) * W, (p.y / 100) * H);
    });
  }, []);

  const update = useCallback((time: number) => {
    if (gameStateRef.current !== 'playing') return;

    lastTimeRef.current = time;

    const currentDiff = diffRef.current;

    // Spawn item
    if (Math.random() < currentDiff.spawnRate) {
      itemsRef.current.push({
        id: Date.now(),
        x: 5 + Math.random() * 90,
        y: -10,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        speed: (1.5 + Math.random() * 2) * currentDiff.speedScale,
      });
    }

    // 4. Collision Check
    const caughtOne = itemsRef.current.find(b => 
      b.y > 80 && b.y < 95 && Math.abs(b.x - catcherX.current) < 12
    );

    if (caughtOne) {
        scoreRef.current += 10;
        setScore(scoreRef.current);
        itemsRef.current = itemsRef.current.filter(i => i.id !== caughtOne.id);
        
        // UX 5.4: Sound Feedback
        if (settings.soundEnabled) playCatch();
        
        // Issue 7: Add Catch Feedback
        particlesRef.current.push({
            x: caughtOne.x,
            y: caughtOne.y - 10,
            life: 1.0,
            text: '+10'
        });
    }

    const missedOne = itemsRef.current.find(b => b.y >= 100);
    itemsRef.current = itemsRef.current.filter(b => b.y < 100);

    if (missedOne) {
        livesRef.current -= 1;
        setLives(livesRef.current);
        
        // Issue 7: Red screen flash on miss
        particlesRef.current.push({
            x: catcherX.current,
            y: 70,
            life: 0.5,
            text: '💔'
        });

        if (livesRef.current <= 0 && !gameOverFiredRef.current) {
            gameOverFiredRef.current = true;
            gameStateRef.current = 'gameover';
            setGameState('gameover');
            onGameOver(scoreRef.current);
            
            // UX 5.4: Sound feedback
            if (settings.soundEnabled) playGameOver();
            return;
        }
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
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          canvas.width = entry.contentRect.width;
          canvas.height = entry.contentRect.height;
          // Trigger a draw to clear the black screen immediately
          draw();
        }
      }
    });

    // Set initial size
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    }

    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Handle Controls: Issue 5 - only active during playing state
  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleMove = (x: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const relativeX = ((x - rect.left) / rect.width) * 100;
      catcherX.current = Math.max(0, Math.min(100, relativeX));
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => { 
        if (gameStateRef.current === 'playing') e.preventDefault();
        if (e.touches[0]) handleMove(e.touches[0].clientX); 
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') catcherX.current = Math.max(0, catcherX.current - 5);
      if (e.key === 'ArrowRight') catcherX.current = Math.min(100, catcherX.current + 5);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [gameState]);

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
        <div className="absolute top-20 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
          <div className="text-4xl font-black text-white/20 tabular-nums">
            {score}
          </div>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <span key={i} className={`text-2xl transition-opacity duration-300 ${i < lives ? 'opacity-100' : 'opacity-20'}`}>
                ❤️
              </span>
            ))}
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md animate-in zoom-in duration-300 px-6 text-center">
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter">OUT OF LIVES!</h4>
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
