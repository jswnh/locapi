import { create } from 'zustand';
import { HistoryItem } from '@/types/db';
import { api } from '@/lib/ipc';

interface HistoryState {
  items: HistoryItem[];
  isLoading: boolean;
  count: number;
  loadHistory: () => Promise<void>;
  addHistoryItem: (item: HistoryItem) => void;
  clearHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  items: [],
  isLoading: false,
  count: 0,

  loadHistory: async () => {
    // Only show loading if cache is empty to eliminate tab switching flicker
    if (get().items.length === 0) {
      set({ isLoading: true });
    }
    try {
      const items = await api.history.list(100);
      set({ items, count: items.length, isLoading: false });
    } catch (err) {
      console.error('Failed to load history:', err);
      set({ isLoading: false });
    }
  },

  addHistoryItem: (item: HistoryItem) => {
    set((state) => {
      const nextItems = [item, ...state.items.filter((i) => i.id !== item.id)].slice(0, 100);
      return {
        items: nextItems,
        count: nextItems.length,
      };
    });
  },

  clearHistory: async () => {
    try {
      await api.history.clear();
      set({ items: [], count: 0 });
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  },
}));
