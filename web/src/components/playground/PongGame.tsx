import { useEffect, useRef, useState } from 'react';

export default function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let ballX = 150, ballY = 75, dx = 3, dy = 3;
    let paddleY = 60;
    const paddleH = 40, paddleW = 8;

    const draw = () => {
      // Clear
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Ball
      ctx.beginPath();
      ctx.arc(ballX, ballY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.closePath();

      // Draw Paddle
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(10, paddleY, paddleW, paddleH);

      // Bounds
      if (ballX + dx > canvas.width - 6) dx = -dx;
      if (ballY + dy < 6 || ballY + dy > canvas.height - 6) dy = -dy;

      // Paddle hit
      if (ballX - 6 < 10 + paddleW) {
        if (ballY > paddleY && ballY < paddleY + paddleH) {
          dx = -dx;
          setScore(s => s + 1);
        } else if (ballX < 0) {
          // Reset
          ballX = 150; ballY = 75;
          setScore(0);
        }
      }

      ballX += dx;
      ballY += dy;
      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      if (relativeY > 0 && relativeY < canvas.height) {
        paddleY = relativeY - paddleH / 2;
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900 border border-slate-800 p-4">
      <h3 className="text-white font-bold mb-2">Paddle Survival - Score: {score}</h3>
      <canvas ref={canvasRef} width={300} height={150} className="bg-slate-800 rounded shadow-lg border border-slate-700 w-full object-contain" />
      <p className="text-xs text-slate-400 mt-2">Move your mouse to control the paddle</p>
    </div>
  );
}
