import { create } from 'zustand';
import { Environment } from '@/types/db';
import { api } from '@/lib/ipc';

interface EnvState {
  environments: Environment[];
  activeEnvironmentId: string | null;
  loadEnvironments: () => Promise<void>;
  setActiveEnvironment: (id: string | null) => Promise<void>;
  getActiveEnvironment: () => Environment | null;
}

export const useEnvStore = create<EnvState>((set, get) => ({
  environments: [],
  activeEnvironmentId: null,

  loadEnvironments: async () => {
    try {
      const list = await api.environments.list();
      const active = list.find((e) => e.is_active);
      set({
        environments: list,
        activeEnvironmentId: active ? active.id : null,
      });
    } catch (err) {
      console.error('Failed to load environments:', err);
    }
  },

  setActiveEnvironment: async (id: string | null) => {
    try {
      await api.environments.setActive(id);
      set((state) => ({
        activeEnvironmentId: id,
        environments: state.environments.map((e) => ({
          ...e,
          is_active: e.id === id,
        })),
      }));
    } catch (err) {
      console.error('Failed to set active environment:', err);
    }
  },

  getActiveEnvironment: () => {
    const { environments, activeEnvironmentId } = get();
    return environments.find((e) => e.id === activeEnvironmentId) || null;
  },
}));
