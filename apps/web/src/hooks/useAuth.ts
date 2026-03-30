import { useAuthStore } from '@/store/authStore';

/**
 * Hook that provides auth state and methods.
 * Wraps the Zustand store for compatibility with existing code.
 */
export function useAuth() {
  const {
    accessToken,
    role,
    eventId,
    eventName,
    mustChangePassword,
    isAuthenticated,
    setAuth,
    clearAuth,
    refreshAccessToken,
  } = useAuthStore();

  return {
    accessToken,
    role,
    eventId,
    eventName,
    mustChangePassword,
    isAuthenticated,
    setAuth,
    clearAuth,
    refreshAccessToken,
  };
}
