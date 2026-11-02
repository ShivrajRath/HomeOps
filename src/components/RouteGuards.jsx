import { Navigate, Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageLoader } from './ui';
import { getPrimaryProperty } from '../lib/db';
import { useAuthStore } from '../store/useAuthStore';

export function RequireSession() {
  const session = useAuthStore((state) => state.session);
  const initializing = useAuthStore((state) => state.initializing);

  if (initializing) return <PageLoader label="Opening your Google Drive…" />;
  if (!session) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

export function RequireProperty() {
  // undefined means Dexie is still answering; null means there is no profile.
  const property = useLiveQuery(getPrimaryProperty, []);

  if (property === undefined) return <PageLoader label="Opening your home…" />;
  if (!property) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
