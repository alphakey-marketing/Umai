import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { SettingsProvider } from './lib/settingsContext';
import { useSettings } from './lib/settingsContext';
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
import ProgressDashboardPage from './pages/ProgressDashboardPage';
import SettingsPage from './pages/SettingsPage';
import OnboardingPage from './pages/OnboardingPage';
import './App.css';

// AppRoutes must live INSIDE BrowserRouter so all children can use useNavigate/useLocation
function AppRoutes() {
  const { settings } = useSettings();

  if (!settings.onboarded) {
    return <OnboardingPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/progress" element={<ProgressDashboardPage />} />
        <Route path="/templates" element={<TemplateLibraryPage />} />
        <Route path="/skills" element={<MySkillsPage />} />
        <Route path="/skills/:skillId" element={<SkillDetailPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/session" element={<SessionSetupPage />} />
        <Route path="/session/run" element={<SessionRunPage />} />
        <Route path="/session/feedback" element={<SessionFeedbackPage />} />
        <Route path="/session/history" element={<SessionHistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      {/* BrowserRouter wraps everything so OnboardingPage can also use useNavigate */}
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SettingsProvider>
  );
}
