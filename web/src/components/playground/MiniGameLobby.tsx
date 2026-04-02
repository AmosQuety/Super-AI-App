import React, { useState, useEffect } from 'react';
import SnakeGame from './SnakeGame';
import PongGame from './PongGame';
import { Gamepad2 } from 'lucide-react';

const GAMES = [
  { id: 'snake', title: 'Retro Snake Tracker', component: SnakeGame },
  { id: 'pong', title: 'Paddle Survival', component: PongGame },
];

export default function MiniGameLobby() {
  const [activeGameIndex, setActiveGameIndex] = useState<number | null>(null);

  useEffect(() => {
    // Pick one random game at the start of synthesis
    const randomIndex = Math.floor(Math.random() * GAMES.length);
    setActiveGameIndex(randomIndex);
  }, []);

  if (activeGameIndex === null) return null;

  const ActiveGame = GAMES[activeGameIndex].component;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900 absolute top-0 w-full z-10 opacity-70 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Now Playing: <span className="text-white">{GAMES[activeGameIndex].title}</span>
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ActiveGame />
      </div>
    </div>
  );
}
