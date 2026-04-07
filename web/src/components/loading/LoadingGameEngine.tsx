import { useState, useCallback } from 'react';
import { Settings, X, Volume2, VolumeX, Trophy, Gamepad2 } from 'lucide-react';
import EmojiCatcher from './games/EmojiCatcher';
import PopTheBubbles from './games/PopTheBubbles';
import TapDodge from './games/TapDodge';
import ReactionTap from './games/ReactionTap';

export type GameType = 'emoji-catcher' | 'pop-bubbles' | 'tap-dodge' | 'reaction-tap';

interface GameSettings {
  soundEnabled: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface HighScores {
  [key: string]: number;
}

export default function LoadingGameEngine({ autoStart = true, operationLabel, progress }: { autoStart?: boolean, operationLabel?: string, progress?: number }) {
  const games: GameType[] = ['emoji-catcher', 'pop-bubbles', 'tap-dodge', 'reaction-tap'];
  const [currentGame, setCurrentGame] = useState<GameType>(() => {
    return games[Math.floor(Math.random() * games.length)];
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem('loading-game-settings');
    return saved ? JSON.parse(saved) : { soundEnabled: true, difficulty: 'easy' };
  });
  const [highScores, setHighScores] = useState<HighScores>(() => {
    const saved = localStorage.getItem('loading-game-scores');
    return saved ? JSON.parse(saved) : {};
  });
  const [showIntro, setShowIntro] = useState(true);

  const saveSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    localStorage.setItem('loading-game-settings', JSON.stringify(newSettings));
  };

  const switchGame = useCallback(() => {
    const currentIndex = games.indexOf(currentGame);
    const nextIndex = (currentIndex + 1) % games.length;
    setCurrentGame(games[nextIndex]);
    setShowIntro(true);
  }, [currentGame, games]);

  const updateHighScore = useCallback((game: GameType, score: number) => {
    setHighScores(prev => {
      const currentHigh = prev[game] || 0;
      if (score > currentHigh) {
        const next = { ...prev, [game]: score };
        localStorage.setItem('loading-game-scores', JSON.stringify(next));
        return next;
      }
      return prev;
    });
  }, []);

  const renderGame = () => {
    const commonProps = { 
        settings, 
        autoStart: autoStart && !showIntro, // Don't start until intro finishes
        onGameOver: (score: number) => updateHighScore(currentGame, score),
        onSwitchGame: switchGame 
    };

    switch (currentGame) {
      case 'emoji-catcher':
        return <EmojiCatcher {...commonProps} />;
      case 'pop-bubbles':
        return <PopTheBubbles {...commonProps} />;
      case 'tap-dodge':
        return <TapDodge {...commonProps} />;
      case 'reaction-tap':
        return <ReactionTap {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[400px] flex flex-col bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Progress Bar (Issue 3) */}
      {(progress !== undefined) && (
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-800 z-30">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {/* Header Info */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-none">
        <div className="flex flex-col items-start">
            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/50 shadow-lg">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-black leading-none">High Score</span>
                <span className="text-sm font-black text-white leading-none">
                {currentGame ? (highScores[currentGame] || 0) : 0}
                </span>
            </div>
            </div>
            {operationLabel && (
                <div className="mt-2 text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 animate-pulse">
                    {operationLabel}
                </div>
            )}
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={switchGame}
                className="pointer-events-auto p-2 bg-slate-900/80 backdrop-blur-md text-slate-400 hover:text-white rounded-xl border border-slate-700/50 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 px-3"
                title="Switch Game"
            >
                <Gamepad2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase hidden sm:block">Switch</span>
            </button>

            <button 
                onClick={() => setShowSettings(true)}
                className="pointer-events-auto p-2 bg-slate-900/80 backdrop-blur-md text-slate-400 hover:text-white rounded-xl border border-slate-700/50 transition-all hover:scale-110 active:scale-95"
            >
                <Settings className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Game Content */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        {renderGame()}

        {/* Issue 5.3: Intro Splash Overlay */}
        {showIntro && (
            <div 
                className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center animate-out fade-out fill-mode-forwards duration-500 delay-1500"
                onAnimationEnd={() => setShowIntro(false)}
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl animate-pulse" />
                    <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter relative z-10 animate-in zoom-in-50 duration-500">
                        {currentGame.replace('-', ' ').toUpperCase()}
                    </h2>
                </div>
                <div className="mt-8 flex items-center gap-4">
                    <div className="h-[2px] w-12 bg-gradient-to-r from-transparent to-blue-500" />
                    <span className="text-xs font-black text-blue-500 uppercase tracking-[0.3em] animate-pulse">
                        Neural Link Established
                    </span>
                    <div className="h-[2px] w-12 bg-gradient-to-l from-transparent to-blue-500" />
                </div>
                
                {/* Visual Countdown Progress */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-900">
                    <div className="h-full bg-blue-600 animate-[progress_1.5s_linear_forwards]" />
                </div>
            </div>
        )}
      </div>

      {/* Settings Modal Overlay */}
      {showSettings && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-white italic tracking-tighter">GAME SETTINGS</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <div className="flex items-center gap-3">
                  {settings.soundEnabled ? <Volume2 className="w-5 h-5 text-blue-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
                  <span className="font-bold text-slate-200">Audio Feedback</span>
                </div>
                <button 
                  onClick={() => saveSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.soundEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.soundEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => saveSettings({ ...settings, difficulty: d })}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition-all border ${settings.difficulty === d ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black text-sm tracking-widest hover:bg-slate-200 transition-colors"
            >
              RESUME GAME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
