import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { RequireProperty, RequireSession } from './components/RouteGuards';
import Toaster from './components/Toaster';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import PropertyWizardPage from './pages/PropertyWizardPage';
import RoomsPage from './pages/RoomsPage';
import SettingsPage from './pages/SettingsPage';
import TasksPage from './pages/TasksPage';
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const init = useAuthStore((state) => state.init);

  // Restore a tab-scoped Google session and reconcile the IndexedDB cache
  // with the Drive backup once per app load.
  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route element={<RequireSession />}>
          <Route path="/onboarding" element={<PropertyWizardPage />} />
          <Route element={<RequireProperty />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="rooms" element={<RoomsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
