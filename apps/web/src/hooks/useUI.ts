import { useUIStore } from '@/store/uiStore';

/**
 * Hook for accessing and controlling UI state and notifications.
 */
export function useUI() {
  const {
    isLoading,
    notification,
    setLoading,
    setNotification,
    clearNotification,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification,
    showWarningNotification,
  } = useUIStore();

  return {
    isLoading,
    notification,
    setLoading,
    setNotification,
    clearNotification,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification,
    showWarningNotification,
  };
}
