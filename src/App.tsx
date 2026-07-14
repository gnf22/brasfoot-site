// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TeamsPage from './pages/TeamsPage';
import NationalTeamsPage from './pages/NationalTeamsPage';

import './styles.css'; // Importando o CSS

const App: React.FC = () => {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/national-teams" element={<NationalTeamsPage />} />
      </Routes>
    </Router>
  );
};

export default App;

