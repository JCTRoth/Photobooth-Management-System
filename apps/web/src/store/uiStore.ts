import { create } from 'zustand';

interface UIState {
  isLoading: boolean;
  notification: {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null;
  setLoading: (loading: boolean) => void;
  setNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  clearNotification: () => void;
  showSuccessNotification: (message: string) => void;
  showErrorNotification: (message: string) => void;
  showInfoNotification: (message: string) => void;
  showWarningNotification: (message: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  notification: null,

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    set({ notification: { message, type } });
    // Auto-clear notification after 5 seconds
    setTimeout(() => set({ notification: null }), 5000);
  },

  clearNotification: () => {
    set({ notification: null });
  },

  showSuccessNotification: (message: string) => {
    set({ notification: { message, type: 'success' } });
    setTimeout(() => set({ notification: null }), 5000);
  },

  showErrorNotification: (message: string) => {
    set({ notification: { message, type: 'error' } });
    setTimeout(() => set({ notification: null }), 5000);
  },

  showInfoNotification: (message: string) => {
    set({ notification: { message, type: 'info' } });
    setTimeout(() => set({ notification: null }), 5000);
  },

  showWarningNotification: (message: string) => {
    set({ notification: { message, type: 'warning' } });
    setTimeout(() => set({ notification: null }), 5000);
  },
}));
