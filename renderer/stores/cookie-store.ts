import { create } from 'zustand';
import { Cookie } from '@/types/db';
import { api } from '@/lib/ipc';

interface CookieState {
  cookies: Cookie[];
  selectedDomain: string | null;
  isCookieModalOpen: boolean;
  isLoading: boolean;
  loadCookies: (domain?: string) => Promise<void>;
  saveCookie: (cookie: Omit<Cookie, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => Promise<void>;
  deleteCookie: (id: string) => Promise<void>;
  clearCookies: (domain?: string) => Promise<void>;
  openCookieModal: (domain?: string) => void;
  closeCookieModal: () => void;
  setSelectedDomain: (domain: string | null) => void;
}

export const useCookieStore = create<CookieState>((set, get) => ({
  cookies: [],
  selectedDomain: null,
  isCookieModalOpen: false,
  isLoading: false,

  loadCookies: async (domain?: string) => {
    set({ isLoading: true });
    try {
      const list = await api.cookies.list(domain);
      set({ cookies: list, isLoading: false });
    } catch (err) {
      console.error('Failed to load cookies:', err);
      set({ isLoading: false });
    }
  },

  saveCookie: async (cookie) => {
    await api.cookies.save(cookie);
    await get().loadCookies();
  },

  deleteCookie: async (id: string) => {
    await api.cookies.delete(id);
    await get().loadCookies();
  },

  clearCookies: async (domain?: string) => {
    await api.cookies.clear(domain);
    await get().loadCookies();
  },

  openCookieModal: (domain?: string) => {
    set({ isCookieModalOpen: true, selectedDomain: domain || null });
    get().loadCookies();
  },

  closeCookieModal: () => {
    set({ isCookieModalOpen: false });
  },

  setSelectedDomain: (domain: string | null) => {
    set({ selectedDomain: domain });
  },
}));
