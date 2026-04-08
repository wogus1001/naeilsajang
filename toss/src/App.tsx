import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomTabBar } from './components/BottomTabBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ChecklistProvider } from './hooks/useChecklist';
import { StoreProvider } from './hooks/useStore';
import { WorkersProvider } from './hooks/useWorkers';
import { ChecklistPage } from './pages/Checklist';
import { HistoryPage } from './pages/History';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { SettingsPage } from './pages/Settings';
import { SetupPage } from './pages/Setup';

function AppFrame(): ReactElement {
  const location = useLocation();
  const showTabBar =
    !location.pathname.startsWith('/login') &&
    !location.pathname.startsWith('/setup') &&
    !location.pathname.startsWith('/checklist/');

  return (
    <div className="app-shell">
      <div className="app-phone">
        <main className={showTabBar ? 'app-main app-main--with-tabbar' : 'app-main'}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/checklist/:type" element={<ChecklistPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {showTabBar ? <BottomTabBar /> : null}
      </div>
    </div>
  );
}

export default function App(): ReactElement {
  return (
    <BrowserRouter>
      <StoreProvider>
        <WorkersProvider>
          <ChecklistProvider>
            <AppFrame />
          </ChecklistProvider>
        </WorkersProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}
