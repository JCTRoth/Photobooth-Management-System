import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { AuthRole } from '@/types/auth';
import type { ReactNode } from 'react';

interface RequireAuthProps {
  children: ReactNode;
  role?: AuthRole;
}

export function RequireAuth({ children, role }: RequireAuthProps) {
  const { isAuthenticated, role: userRole, mustChangePassword } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const redirectTarget = role === 'Admin' ? '/admin/login' : '/';
    return <Navigate to={`${redirectTarget}?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (role && userRole !== role) {
    // Wrong role – send to appropriate login
    return <Navigate to={role === 'Admin' ? '/admin/login' : '/'} replace />;
  }

  if (
    role === 'Admin' &&
    mustChangePassword &&
    location.pathname !== '/admin/change-password'
  ) {
    return <Navigate to="/admin/change-password" replace />;
  }

  return <>{children}</>;
}
