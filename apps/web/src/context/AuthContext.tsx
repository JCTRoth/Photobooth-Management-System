import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AuthState, AuthRole, RefreshResponse } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'pb_access_token';
const ROLE_KEY = 'pb_role';
const EVENT_ID_KEY = 'pb_event_id';
const EVENT_NAME_KEY = 'pb_event_name';
const MUST_CHANGE_PASSWORD_KEY = 'pb_must_change_password';

interface AuthContextValue extends AuthState {
  setAuth: (
    token: string,
    role: AuthRole,
    eventId?: string | null,
    eventName?: string | null,
    mustChangePassword?: boolean
  ) => void;
  clearAuth: () => void;
  refreshAccessToken: () => Promise<string | null>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    accessToken: sessionStorage.getItem(ACCESS_TOKEN_KEY),
    role: (sessionStorage.getItem(ROLE_KEY) as AuthRole | null),
    eventId: sessionStorage.getItem(EVENT_ID_KEY),
    eventName: sessionStorage.getItem(EVENT_NAME_KEY),
    mustChangePassword: sessionStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === 'true',
  }));

  const setAuth = useCallback(
    (token: string, role: AuthRole, eventId?: string | null, eventName?: string | null, mustChangePassword?: boolean) => {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
      sessionStorage.setItem(ROLE_KEY, role);
      if (eventId) sessionStorage.setItem(EVENT_ID_KEY, eventId);
      else sessionStorage.removeItem(EVENT_ID_KEY);
      if (eventName) sessionStorage.setItem(EVENT_NAME_KEY, eventName);
      else sessionStorage.removeItem(EVENT_NAME_KEY);
      const mustChange = mustChangePassword === true;
      sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, mustChange ? 'true' : 'false');
      setState({
        accessToken: token,
        role,
        eventId: eventId ?? null,
        eventName: eventName ?? null,
        mustChangePassword: mustChange,
      });
    },
    []
  );

  const clearAuth = useCallback(() => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(EVENT_ID_KEY);
    sessionStorage.removeItem(EVENT_NAME_KEY);
    sessionStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
    setState({ accessToken: null, role: null, eventId: null, eventName: null, mustChangePassword: false });
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        clearAuth();
        return null;
      }
      const data: RefreshResponse = await res.json();
      const currentRole = sessionStorage.getItem(ROLE_KEY) as AuthRole | null;
      const currentEventId = sessionStorage.getItem(EVENT_ID_KEY);
      const currentEventName = sessionStorage.getItem(EVENT_NAME_KEY);
      if (currentRole) {
        setAuth(data.accessToken, currentRole, currentEventId, currentEventName, data.mustChangePassword === true);
      }
      return data.accessToken;
    } catch {
      clearAuth();
      return null;
    }
  }, [clearAuth, setAuth]);

  // Proactively refresh every 14 minutes (access token lifetime is 15m)
  useEffect(() => {
    if (!state.accessToken) return;
    const interval = setInterval(() => {
      refreshAccessToken();
    }, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.accessToken, refreshAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        setAuth,
        clearAuth,
        refreshAccessToken,
        isAuthenticated: state.accessToken !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
