import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, AuthRole, RefreshResponse } from '@/types/auth';

interface AuthStoreState extends AuthState {
  isAuthenticated: boolean;
  setAuth: (
    token: string,
    role: AuthRole,
    eventId?: string | null,
    eventName?: string | null,
    mustChangePassword?: boolean
  ) => void;
  clearAuth: () => void;
  refreshAccessToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      role: null,
      eventId: null,
      eventName: null,
      mustChangePassword: false,
      isAuthenticated: false,

      setAuth: (token, role, eventId = null, eventName = null, mustChangePassword = false) => {
        set({
          accessToken: token,
          role,
          eventId: eventId ?? null,
          eventName: eventName ?? null,
          mustChangePassword: mustChangePassword === true,
          isAuthenticated: true,
        });
      },

      clearAuth: () => {
        set({
          accessToken: null,
          role: null,
          eventId: null,
          eventName: null,
          mustChangePassword: false,
          isAuthenticated: false,
        });
      },

      refreshAccessToken: async (): Promise<string | null> => {
        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (!res.ok) {
            get().clearAuth();
            return null;
          }

          const data: RefreshResponse = await res.json();
          const currentState = get();
          const currentRole = currentState.role as AuthRole | null;

          if (currentRole) {
            set({
              accessToken: data.accessToken,
              mustChangePassword: data.mustChangePassword === true,
            });
          }

          return data.accessToken;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().clearAuth();
          return null;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: {
        getItem: (key: string) => {
          const item = sessionStorage.getItem(key);
          if (!item) return null;
          try {
            return JSON.parse(item);
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: any) => {
          sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        },
        removeItem: (key: string) => sessionStorage.removeItem(key),
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        role: state.role,
        eventId: state.eventId,
        eventName: state.eventName,
        mustChangePassword: state.mustChangePassword,
      }),
    }
  )
);
