import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import ScorePage from './pages/ScorePage';
import TunerPage from './pages/TunerPage';
import ChordsPage from './pages/ChordsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="score/:id" element={<ScorePage />} />
        <Route path="chords" element={<ChordsPage />} />
        <Route path="tuner" element={<TunerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
