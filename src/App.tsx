import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TemplateLibraryPage from './pages/TemplateLibraryPage';
import MySkillsPage from './pages/MySkillsPage';
import SkillDetailPage from './pages/SkillDetailPage';
import VaultPage from './pages/VaultPage';
import SessionSetupPage from './pages/SessionSetupPage';
import SessionRunPage from './pages/SessionRunPage';
import SessionFeedbackPage from './pages/SessionFeedbackPage';
import SessionHistoryPage from './pages/SessionHistoryPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/templates" element={<TemplateLibraryPage />} />
          <Route path="/skills" element={<MySkillsPage />} />
          <Route path="/skills/:skillId" element={<SkillDetailPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/session" element={<SessionSetupPage />} />
          <Route path="/session/run" element={<SessionRunPage />} />
          <Route path="/session/feedback" element={<SessionFeedbackPage />} />
          <Route path="/session/history" element={<SessionHistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
