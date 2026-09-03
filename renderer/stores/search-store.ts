import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SearchState {
  query: string;
  history: string[];
  isOpen: boolean;
  setQuery: (query: string) => void;
  addToHistory: (term: string) => void;
  removeFromHistory: (term: string) => void;
  clearHistory: () => void;
  setIsOpen: (isOpen: boolean) => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      query: '',
      history: ['auth/login', 'users', 'status', 'GET'],
      isOpen: false,

      setQuery: (query) => set({ query }),

      addToHistory: (term) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        set((state) => {
          const filtered = state.history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
          return {
            history: [trimmed, ...filtered].slice(0, 10), // keep top 10
          };
        });
      },

      removeFromHistory: (term) =>
        set((state) => ({
          history: state.history.filter((item) => item !== term),
        })),

      clearHistory: () => set({ history: [] }),

      setIsOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: 'locapi-search-store',
      partialize: (state) => ({ history: state.history }),
    }
  )
);
