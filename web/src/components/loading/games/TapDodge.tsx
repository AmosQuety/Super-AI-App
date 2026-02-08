import { useState, useEffect, useRef } from 'react';

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function TapDodge({ settings, onGameOver }: { settings: any, onGameOver: (score: number) => void }) {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const playerX = useRef(50);
  const nextId = useRef(0);

  const DIFFICULTY_MAP = {
    easy: { speed: 3, freq: 1500, playerSpeed: 6 },
    medium: { speed: 5, freq: 1000, playerSpeed: 8 },
    hard: { speed: 8, freq: 600, playerSpeed: 10 },
  };

  const diff = DIFFICULTY_MAP[settings.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.medium;

  const startGame = () => {
    setScore(0);
    setGameState('playing');
    setObstacles([]);
    playerX.current = 50;
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const spawnInterval = setInterval(() => {
      const newObstacle: Obstacle = {
        id: nextId.current++,
        x: Math.random() * 80 + 10,
        y: -20,
        width: 15 + Math.random() * 20,
        height: 10,
      };
      setObstacles(prev => [...prev, newObstacle]);
    }, diff.freq);

    const scoreInterval = setInterval(() => {
      setScore(s => s + 1);
    }, 100);

    const updateInterval = setInterval(() => {
      setObstacles(prev => {
        const next = prev.map(o => ({ ...o, y: o.y + diff.speed }));
        
        // Check collision
        const hit = next.find(o => {
          const xDist = Math.abs(o.x - playerX.current);
          return o.y > 80 && o.y < 95 && xDist < (o.width / 2 + 5);
        });

        if (hit) {
          setGameState('gameover');
          onGameOver(score);
          return prev;
        }

        return next.filter(o => o.y < 120);
      });
    }, 16);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(scoreInterval);
      clearInterval(updateInterval);
    };
  }, [gameState, diff, score, onGameOver]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const x = 'clientX' in e ? e.clientX : e.touches[0].clientX;
      const rect = document.getElementById('dodge-container')?.getBoundingClientRect();
      if (rect) {
        const relativeX = ((x - rect.left) / rect.width) * 100;
        playerX.current = Math.max(5, Math.min(95, relativeX));
      }
    };

    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') playerX.current = Math.max(5, playerX.current - 10);
        if (e.key === 'ArrowRight') playerX.current = Math.min(95, playerX.current + 10);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleMove);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div id="dodge-container" className="w-full h-full flex flex-col items-center justify-center relative touch-none bg-slate-950 overflow-hidden">
      {/* Player */}
      <div 
        className="absolute bottom-[10%] w-6 h-6 bg-cyan-400 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.6)] border-2 border-white transition-all duration-75"
        style={{ left: `${playerX.current}%`, transform: 'translateX(-50%)' }}
      >
          <div className="absolute -top-1 -left-1 -right-1 -bottom-1 border border-cyan-400 rounded-lg animate-ping opacity-20" />
      </div>

      {obstacles.map(o => (
        <div
          key={o.id}
          className="absolute bg-red-500/50 border border-red-500 rounded-sm shadow-[0_0_10px_rgba(239,68,68,0.3)]"
          style={{
            left: `${o.x}%`,
            top: `${o.y}%`,
            width: `${o.width}%`,
            height: '20px',
            transform: 'translateX(-50%)',
          }}
        />
      ))}

      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <h4 className="text-white font-black text-2xl mb-2 italic tracking-tighter">TAP DODGE</h4>
          <p className="text-slate-400 text-xs mb-6 font-bold uppercase tracking-widest text-center px-8">Dodge incoming barriers!</p>
          <button onClick={startGame} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-full shadow-xl shadow-cyan-500/20">
            INITIALIZE
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-4xl font-black text-white/5 select-none pointer-events-none">
          {score}
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md">
          <h4 className="text-white font-black text-3xl mb-1 italic tracking-tighter">SYSTEM COMPROMISED</h4>
          <p className="text-red-200 text-lg font-black mb-6">TIME SURVIVED: {score}</p>
          <button onClick={startGame} className="px-8 py-3 bg-white text-red-950 font-black rounded-full">
            RESTORE SYSTEM
          </button>
        </div>
      )}
    </div>
  );
}
