import { create } from 'zustand';
import { Workspace } from '@/types/db';
import { api } from '@/lib/ipc';
import { useCollectionStore } from './collection-store';

interface WorkspaceContextState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string) => Promise<void>;
  createWorkspace: (data: { name: string; description?: string }) => Promise<Workspace>;
  updateWorkspace: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  getActiveWorkspace: () => Workspace | undefined;
}

export const useWorkspaceContextStore = create<WorkspaceContextState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,

  loadWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const list = await api.workspaces.list();
      const active = list.find((w) => w.is_active) || list[0];
      set({
        workspaces: list,
        activeWorkspaceId: active ? active.id : null,
        isLoading: false,
      });

      // Also reload collections for this active workspace
      if (active) {
        useCollectionStore.getState().loadCollections(active.id);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      set({ isLoading: false });
    }
  },

  setActiveWorkspace: async (id: string) => {
    // 1. Instant optimistic state update - UI updates with 0 latency
    set((state) => ({
      activeWorkspaceId: id,
      workspaces: state.workspaces.map((w) => ({
        ...w,
        is_active: w.id === id,
      })),
    }));

    try {
      // 2. Persist active workspace and reload collections in parallel
      await Promise.all([
        api.workspaces.setActive(id),
        useCollectionStore.getState().loadCollections(id),
      ]);
    } catch (err) {
      console.error('Failed to set active workspace:', err);
    }
  },

  createWorkspace: async (data) => {
    const created = await api.workspaces.create(data);
    await get().loadWorkspaces();
    await get().setActiveWorkspace(created.id);
    return created;
  },

  updateWorkspace: async (id, data) => {
    await api.workspaces.update(id, data);
    await get().loadWorkspaces();
  },

  deleteWorkspace: async (id) => {
    const success = await api.workspaces.delete(id);
    if (success) {
      await get().loadWorkspaces();
    }
    return success;
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId);
  },
}));
