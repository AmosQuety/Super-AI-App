import { useState, useEffect, useRef, useCallback } from 'react';

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

const DIFFICULTY_MAP = {
  easy: { speed: 2.5, freq: 1200, shipSpeed: 5 },
  medium: { speed: 4.5, freq: 800, shipSpeed: 8 },
  hard: { speed: 7, freq: 500, shipSpeed: 12 },
};

const COLORS = ['#ef4444', '#f87171', '#dc2626', '#b91c1c'];

export default function TapDodge({ settings, onGameOver }: { settings: any, onGameOver: (score: number) => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [playerX, setPlayerX] = useState(50); // State for player to ensure visual updates

  const nextId = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle');
  const obstaclesRef = useRef<Obstacle[]>([]);
  const playerXRef = useRef(50);
  const lastTimeRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const animationRef = useRef(0);
  const gameOverFiredRef = useRef(false);

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.medium;
  const diffRef = useRef(diff);

  useEffect(() => {
    diffRef.current = diff;
  }, [diff]);

  const startGame = () => {
    scoreRef.current = 0;
    gameStateRef.current = 'playing';
    gameOverFiredRef.current = false;
    playerXRef.current = 50;
    obstaclesRef.current = [];
    spawnTimerRef.current = 0;
    lastTimeRef.current = performance.now();

    setScore(0);
    setPlayerX(50);
    setObstacles([]);
    setGameState('playing');
  };

  const update = useCallback((time: number) => {
    if (gameStateRef.current !== 'playing') return;

    const dt = Math.min(time - lastTimeRef.current, 50);
    lastTimeRef.current = time;

    const currentDiff = diffRef.current;

    // Increment score based on time
    scoreRef.current += dt * 0.01;
    setScore(Math.floor(scoreRef.current));

    // Handle Spawning
    spawnTimerRef.current += dt;
    if (spawnTimerRef.current > currentDiff.freq) {
      spawnTimerRef.current = 0;
      const newObstacle: Obstacle = {
        id: nextId.current++,
        x: 5 + Math.random() * 90,
        y: -10,
        width: 15 + Math.random() * 25,
        height: 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
      obstaclesRef.current = [...obstaclesRef.current, newObstacle];
    }

    // Move Obstacles and Check Collision
    let collision = false;
    const nextObstacles = obstaclesRef.current.filter(o => {
      o.y += currentDiff.speed * (dt / 16);

      // Simple AABB Collision
      const shipWidth = 6;
      const shipHeight = 6;
      const shipY = 85; // Fixed vertical pos

      const oLeft = o.x - o.width / 2;
      const oRight = o.x + o.width / 2;
      const oTop = o.y;
      const oBottom = o.y + o.height;

      const sLeft = playerXRef.current - shipWidth / 2;
      const sRight = playerXRef.current + shipWidth / 2;
      const sTop = shipY;
      const sBottom = shipY + shipHeight;

      if (sRight > oLeft && sLeft < oRight && sBottom > oTop && sTop < oBottom) {
        collision = true;
      }

      return o.y < 110;
    });

    obstaclesRef.current = nextObstacles;
    setObstacles([...nextObstacles]);

    if (collision && !gameOverFiredRef.current) {
      gameOverFiredRef.current = true;
      gameStateRef.current = 'gameover';
      setGameState('gameover');
      onGameOver(Math.floor(scoreRef.current));
      return;
    }

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

  // Handle Controls
  useEffect(() => {
    const handleMove = (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const relativeX = ((clientX - rect.left) / rect.width) * 100;
      const clampedX = Math.max(5, Math.min(95, relativeX));
      playerXRef.current = clampedX;
      setPlayerX(clampedX);
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const step = diffRef.current.shipSpeed;
      if (e.key === 'ArrowLeft') {
        const next = Math.max(5, playerXRef.current - step);
        playerXRef.current = next;
        setPlayerX(next);
      }
      if (e.key === 'ArrowRight') {
        const next = Math.min(95, playerXRef.current + step);
        playerXRef.current = next;
        setPlayerX(next);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center relative touch-none bg-slate-950 overflow-hidden"
    >
      {/* Player Ship */}
      <div
        className="absolute bottom-[10%] w-8 h-8 flex items-center justify-center transition-transform duration-75"
        style={{
          left: `${playerX}%`,
          transform: 'translateX(-50%)',
          zIndex: 10
        }}
      >
        <div className="relative w-full h-full">
          {/* Main Ship Core */}
          <div className="absolute inset-0 bg-cyan-400 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.8)] border-2 border-white flex items-center justify-center">
            <div className="w-1/2 h-1/2 bg-white/40 rounded-full animate-pulse" />
          </div>
          {/* Engine Thrusters/Trail Effect */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-cyan-500/50 rounded-full blur-[2px] animate-bounce" />
          {/* Shield Aura (Pulse) */}
          <div className="absolute -inset-2 border border-cyan-400/30 rounded-xl animate-ping opacity-20" />
        </div>
      </div>

      {/* Obstacles */}
      {obstacles.map(o => (
        <div
          key={o.id}
          className="absolute rounded-sm shadow-lg border-b-2 border-black/20"
          style={{
            left: `${o.x}%`,
            top: `${o.y}%`,
            width: `${o.width}%`,
            height: '12px',
            backgroundColor: o.color,
            transform: 'translateX(-50%)',
            boxShadow: `0 0 15px ${o.color}44`,
          }}
        >
          {/* Tech Pattern on Obstacle */}
          <div className="w-full h-full opacity-10 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:4px_4px]" />
        </div>
      ))}

      {/* Game UI Overlays */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm z-20">
          <h4 className="text-white font-black text-2xl mb-2 italic tracking-tighter">TAP DODGE</h4>
          <p className="text-slate-400 text-xs mb-6 font-bold uppercase tracking-widest text-center px-8 leading-relaxed">
            Navigate the security corridor.<br />Dodge incoming firewall blocks!
          </p>
          <button
            onClick={startGame}
            className="px-10 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-full transition-all transform hover:scale-105 shadow-xl shadow-cyan-500/20 tracking-widest text-sm"
          >
            ESTABLISH LINK
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-5xl font-black text-white/10 select-none pointer-events-none tabular-nums z-0">
          {score}
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/85 backdrop-blur-md animate-in zoom-in duration-300 z-20">
          <div className="text-red-500 mb-4 animate-bounce">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter uppercase">LINK SEVERED</h4>
          <p className="text-red-200 text-lg font-black mb-8">DISTANCE: {score}m</p>
          <button
            onClick={startGame}
            className="px-10 py-4 bg-white text-red-950 font-black rounded-full transition-all transform hover:scale-105 hover:bg-red-50 shadow-2xl"
          >
            RECONNECT SYSTEM
          </button>
        </div>
      )}
    </div>
  );
}
