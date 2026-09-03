import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppSettings {
  // Request Section
  httpVersion: 'auto' | '1.1' | '2';
  requestTimeout: number; // in seconds (e.g. 30)
  maxResponseSizeMb: number; // in MB (0 = unlimited, default 50)
  disableCookies: boolean;
  responseFormatDetection: 'auto' | 'json';

  // Working directory
  exportLocation: string;

  // Interface
  editorFontSize: number; // in px, default 12 (applies to request body & response body only)
  editorMinimap: boolean; // toggle code minimap on Monaco editor

  // Features
  enableScripts: boolean; // toggle Scripts & Tests feature
}

const DEFAULT_SETTINGS: AppSettings = {
  httpVersion: 'auto',
  requestTimeout: 30,
  maxResponseSizeMb: 50,
  disableCookies: false,
  responseFormatDetection: 'auto',
  exportLocation: '',
  editorFontSize: 12,
  editorMinimap: false,
  enableScripts: true,
};

interface SettingsState {
  settings: AppSettings;
  isOpen: boolean;
  activeTab: 'general' | 'shortcuts' | 'update' | 'about';
  openSettings: (tab?: 'general' | 'shortcuts' | 'update' | 'about') => void;
  closeSettings: () => void;
  setActiveTab: (tab: 'general' | 'shortcuts' | 'update' | 'about') => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      isOpen: false,
      activeTab: 'general',

      openSettings: (tab = 'general') =>
        set({ isOpen: true, activeTab: tab }),

      closeSettings: () =>
        set({ isOpen: false }),

      setActiveTab: (activeTab) =>
        set({ activeTab }),

      updateSettings: (patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...patch,
          },
        })),

      resetSettings: () =>
        set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'locapi-settings-store',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
