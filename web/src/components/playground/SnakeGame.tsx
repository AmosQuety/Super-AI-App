import  { useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(true);

  const gridSize = 20;
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const directionRef = useRef<Point>({ x: 0, y: 0 });
  const nextDirectionRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const savedHighScore = localStorage.getItem('snakeHighScore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore));
  }, []);

  const startGame = () => {
    snakeRef.current = [{ x: 10, y: 10 }];
    directionRef.current = { x: 1, y: 0 };
    nextDirectionRef.current = { x: 1, y: 0 };
    setScore(0);
    setIsGameOver(false);
    spawnFood();
  };

  const spawnFood = () => {
    foodRef.current = {
      x: Math.floor(Math.random() * (canvasRef.current!.width / gridSize)),
      y: Math.floor(Math.random() * (canvasRef.current!.height / gridSize)),
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (directionRef.current.y === 0) nextDirectionRef.current = { x: 0, y: -1 }; break;
        case 'ArrowDown': if (directionRef.current.y === 0) nextDirectionRef.current = { x: 0, y: 1 }; break;
        case 'ArrowLeft': if (directionRef.current.x === 0) nextDirectionRef.current = { x: -1, y: 0 }; break;
        case 'ArrowRight': if (directionRef.current.x === 0) nextDirectionRef.current = { x: 1, y: 0 }; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isGameOver) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let lastTime = 0;
    const speed = 100; // ms per move

    const loop = (time: number) => {
      if (isGameOver) return;
      
      if (time - lastTime > speed) {
        lastTime = time;
        moveSnake();
        draw();
      }
      requestAnimationFrame(loop);
    };

    const moveSnake = () => {
      directionRef.current = nextDirectionRef.current;
      const head = { ...snakeRef.current[0] };
      head.x += directionRef.current.x;
      head.y += directionRef.current.y;

      // Wrap around walls
      const cols = canvas.width / gridSize;
      const rows = canvas.height / gridSize;
      if (head.x < 0) head.x = cols - 1;
      if (head.x >= cols) head.x = 0;
      if (head.y < 0) head.y = rows - 1;
      if (head.y >= rows) head.y = 0;

      // Check collision with self
      if (snakeRef.current.some(segment => segment.x === head.x && segment.y === head.y)) {
        endGame();
        return;
      }

      snakeRef.current.unshift(head);

      // Check food
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore(s => {
          const newScore = s + 10;
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('snakeHighScore', newScore.toString());
          }
          return newScore;
        });
        spawnFood();
      } else {
        snakeRef.current.pop();
      }
    };

    const draw = () => {
      ctx.fillStyle = '#020617'; // slate-950
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grid (Subtle)
      ctx.strokeStyle = '#1e293b'; 
      ctx.lineWidth = 0.5;
      for (let i = 0; i < canvas.width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Draw Food
      ctx.fillStyle = '#4ade80'; // neon green
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#4ade80';
      ctx.fillRect(foodRef.current.x * gridSize + 2, foodRef.current.y * gridSize + 2, gridSize - 4, gridSize - 4);

      // Draw Snake
      ctx.fillStyle = '#8b5cf6'; // violet
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#8b5cf6';
      snakeRef.current.forEach((segment) => {
        const size = gridSize - 2;
        ctx.fillRect(segment.x * gridSize + 1, segment.y * gridSize + 1, size, size);
      });
      ctx.shadowBlur = 0;
    };

    const endGame = () => {
      setIsGameOver(true);
    };

    requestAnimationFrame(loop);
  }, [isGameOver, highScore]);

  return (
    <div className="relative w-full flex flex-col items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
      <div className="flex justify-between w-full mb-2 px-2">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Score</span>
          <span className="text-xl font-black text-white">{score}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">High Score</span>
          <span className="text-xl font-black text-teal-400">{highScore}</span>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="rounded-lg border border-slate-700 shadow-2xl shadow-purple-500/10"
        />
        
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-lg">
            <h4 className="text-white font-black text-2xl mb-4 italic tracking-tighter">NEURAL RECOVERY</h4>
            <button
              onClick={startGame}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full transition-all transform hover:scale-105 shadow-lg shadow-purple-500/20"
            >
              {score > 0 ? 'REBOOT SESSION' : 'INITIALIZE GAME'}
            </button>
            <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-[0.2em]">Generating consciousness in background...</p>
          </div>
        )}
      </div>
    </div>
  );
}
