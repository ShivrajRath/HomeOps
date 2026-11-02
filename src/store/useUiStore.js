import { create } from 'zustand';

let nextToastId = 0;

export const useUiStore = create((set) => ({
  toasts: [],

  pushToast: (message, type = 'success') => {
    const id = ++nextToastId;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 4500);
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
