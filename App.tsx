import React, { useState, useCallback, useRef } from 'react';
import Game from './components/Game';
import { CoinIcon, GasIcon, BrakeIcon } from './components/Icons';
import { CAR_COLORS } from './constants';

type GameState = 'menu' | 'playing';

export default function App() {
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameId, setGameId] = useState(1);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [carColor, setCarColor] = useState(CAR_COLORS[0]);

  const moveDirection = useRef(0);
  const accelerate = useRef(false);
  const brake = useRef(false);

  const handleScoreUpdate = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const handleGameOver = useCallback(() => {
    setIsGameOver(true);
  }, []);

  const handleRestart = () => {
    setScore(0);
    setIsGameOver(false);
    setGameState('menu');
  };

  const handleStartGame = () => {
    setGameId(prevId => prevId + 1);
    setIsGameOver(false);
    setScore(0);
    setGameState('playing');
  }

  const handleTouchStart = (direction: number) => {
    moveDirection.current = direction;
  };

  const handleTouchEnd = () => {
    moveDirection.current = 0;
  };

  const handleControlPress = (control: 'accelerate' | 'brake', isPressed: boolean) => {
    if (control === 'accelerate') {
      accelerate.current = isPressed;
    } else {
      brake.current = isPressed;
    }
  };

  return (
    <div className="relative w-full h-full bg-sky-400">
      {gameState === 'playing' && (
        <Game
          key={gameId}
          onScoreUpdate={handleScoreUpdate}
          onGameOver={handleGameOver}
          moveDirectionRef={moveDirection}
          accelerateRef={accelerate}
          brakeRef={brake}
          carColor={carColor}
        />
      )}

      {/* UI Overlay */}
      {gameState === 'playing' && (
         <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="flex justify-between items-start p-4 md:p-6 text-yellow-300 font-bold text-2xl md:text-3xl [text-shadow:_2px_2px_6px_rgb(0_0_0_/_60%)]">
            <div>Score: {score}</div>
            <div className="flex items-center gap-2">
                <CoinIcon />
                <span>{score / 10}</span>
            </div>
            </div>
        </div>
      )}
     
      {/* Menu Screen */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 bg-sky-400 flex flex-col justify-center items-center p-4">
             <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 [text-shadow:_3px_3px_8px_rgb(0_0_0_/_40%)]">3D Car Racing</h1>
             <h2 className="text-2xl md:text-3xl font-bold text-yellow-300 mb-8 [text-shadow:_2px_2px_6px_rgb(0_0_0_/_50%)]">Choose Your Car Color</h2>
             <div className="flex flex-wrap justify-center gap-4 mb-10">
                {CAR_COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => setCarColor(color)}
                        className={`w-12 h-12 md:w-16 md:h-16 rounded-full transition-transform duration-200 transform hover:scale-110 ${carColor === color ? 'ring-4 ring-offset-2 ring-offset-sky-400 ring-white' : ''}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select car color ${color}`}
                    />
                ))}
             </div>
             <button
                onClick={handleStartGame}
                className="px-10 py-5 bg-yellow-400 text-black text-3xl font-bold rounded-lg shadow-lg hover:bg-yellow-300 transition-colors transform hover:scale-105"
            >
                START RACE
            </button>
        </div>
      )}


      {isGameOver && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-center items-center">
          <div className="text-yellow-300 text-6xl md:text-8xl font-extrabold [text-shadow:_0_0_8px_rgba(255,255,255,0.5),_0_0_20px_rgba(253,211,77,0.7)]">
            GAME OVER
          </div>
          <button
            onClick={handleRestart}
            className="mt-8 px-8 py-4 bg-yellow-400 text-black text-2xl font-bold rounded-lg shadow-lg hover:bg-yellow-300 transition-colors transform hover:scale-105"
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      {/* Mobile Controls */}
      {gameState === 'playing' && !isGameOver && (
         <div className="absolute bottom-0 left-0 w-full flex justify-between items-end p-4 md:hidden pointer-events-none">
            {/* Steering on the left */}
            <div className="flex gap-2 pointer-events-auto">
              <button
                onTouchStart={() => handleTouchStart(-1)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(-1)}
                onMouseUp={handleTouchEnd}
                className="w-24 h-24 bg-black bg-opacity-50 rounded-full text-white text-4xl font-bold active:bg-opacity-70 transition-transform active:scale-95 select-none"
              >
                &larr;
              </button>
              <button
                onTouchStart={() => handleTouchStart(1)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(1)}
                onMouseUp={handleTouchEnd}
                className="w-24 h-24 bg-black bg-opacity-50 rounded-full text-white text-4xl font-bold active:bg-opacity-70 transition-transform active:scale-95 select-none"
              >
                &rarr;
              </button>
            </div>
            {/* Pedals on the right */}
            <div className="flex gap-2 pointer-events-auto">
               <button
                onTouchStart={() => handleControlPress('brake', true)}
                onTouchEnd={() => handleControlPress('brake', false)}
                onMouseDown={() => handleControlPress('brake', true)}
                onMouseUp={() => handleControlPress('brake', false)}
                className="w-20 h-28 bg-red-600 bg-opacity-70 rounded-lg active:bg-opacity-90 transition-transform active:scale-95 flex justify-center items-center select-none"
              >
                <BrakeIcon />
              </button>
              <button
                onTouchStart={() => handleControlPress('accelerate', true)}
                onTouchEnd={() => handleControlPress('accelerate', false)}
                onMouseDown={() => handleControlPress('accelerate', true)}
                onMouseUp={() => handleControlPress('accelerate', false)}
                className="w-20 h-32 bg-green-500 bg-opacity-70 rounded-lg active:bg-opacity-90 transition-transform active:scale-95 flex justify-center items-center select-none"
              >
                <GasIcon />
              </button>
            </div>
         </div>
      )}
    </div>
  );
}