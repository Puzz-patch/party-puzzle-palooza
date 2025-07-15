import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import Index from './pages/Index';
import Room from './pages/Room';
import GameBuild from './pages/GameBuild';
import GamePlay from './pages/GamePlay';
import { GameLobby } from './pages/GameLobby';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/room/:gid" element={<Room />} />
          <Route path="/game/:gid/lobby" element={<GameLobby />} />
          <Route path="/game/:gid/build" element={<GameBuild />} />
          <Route path="/game/:gid/play" element={<GamePlay />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  );
}

export default App;
