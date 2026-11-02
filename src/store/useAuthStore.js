import { create } from 'zustand';
import {
  restoreSession,
  resumeSync,
  signIn as signInWithGoogle,
  signOut as signOutOfGoogle,
} from '../lib/syncService';

let initializationStarted = false;

/**
 * Google account state. The Drive token itself lives in syncService (memory
 * plus sessionStorage for this tab); this store only exposes the profile.
 */
export const useAuthStore = create((set, get) => ({
  session: null,
  initializing: true,
  busy: false,
  error: null,

  init: async () => {
    if (initializationStarted) return;
    initializationStarted = true;

    try {
      const session = restoreSession();
      if (session) {
        // Pull a newer Drive backup or push local edits before the app opens.
        await resumeSync();
      }
      set({ session, initializing: false });
    } catch (error) {
      set({
        session: null,
        initializing: false,
        error: error.message || 'Could not restore your Google session.',
      });
    }
  },

  signIn: async () => {
    if (get().busy) return get().session;
    set({ busy: true, error: null });

    try {
      const session = await signInWithGoogle();
      set({ session, busy: false, error: null });
      return session;
    } catch (error) {
      set({
        busy: false,
        error: error.message || 'Google sign-in failed. Please try again.',
      });
      throw error;
    }
  },

  signOut: async () => {
    signOutOfGoogle();
    set({ session: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
