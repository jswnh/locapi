import { create } from 'zustand';
import { Collection, Folder, ApiRequest } from '@/types/db';
import { api } from '@/lib/ipc';
import { useWorkspaceStore } from './workspace-store';
import { useWorkspaceContextStore } from './workspace-context-store';

interface CollectionState {
  collections: Collection[];
  isLoading: boolean;
  hasLoaded: boolean;
  currentWorkspaceId: string | null;
  loadCollections: (workspaceId?: string) => Promise<void>;
  createCollection: (data: { name: string; description?: string; color?: string; workspaceId?: string }) => Promise<Collection>;
  updateCollection: (id: string, data: { name?: string; description?: string; color?: string }) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  createFolder: (data: { collectionId: string; parentId?: string | null; name: string }) => Promise<Folder>;
  updateFolder: (id: string, data: { name: string }) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createRequest: (data: Partial<ApiRequest>) => Promise<ApiRequest>;
  updateRequest: (id: string, data: Partial<ApiRequest>) => Promise<ApiRequest | null>;
  deleteRequest: (id: string) => Promise<void>;
  duplicateRequest: (id: string) => Promise<ApiRequest | null>;
  reorderRequests: (items: { id: string; sort_order: number; folder_id?: string | null; collection_id?: string | null }[]) => Promise<void>;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: [],
  isLoading: false,
  hasLoaded: false,
  currentWorkspaceId: null,

  loadCollections: async (workspaceId?: string) => {
    const targetWsId =
      workspaceId !== undefined
        ? workspaceId
        : useWorkspaceContextStore.getState().activeWorkspaceId || undefined;

    set({ isLoading: true });
    try {
      const data = await api.collections.list(targetWsId);
      set({
        collections: data,
        isLoading: false,
        hasLoaded: true,
        currentWorkspaceId: targetWsId || null,
      });
    } catch (err) {
      console.error('Failed to load collections from SQLite:', err);
      set({ isLoading: false, hasLoaded: true });
    }
  },

  createCollection: async (data) => {
    const wsId = data.workspaceId || useWorkspaceContextStore.getState().activeWorkspaceId;
    const created = await api.collections.create({
      ...data,
      workspaceId: wsId || undefined,
    });
    await get().loadCollections(wsId || undefined);
    return created;
  },

  updateCollection: async (id, data) => {
    await api.collections.update(id, data);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
  },

  deleteCollection: async (id) => {
    await api.collections.delete(id);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
  },

  createFolder: async (data) => {
    const created = await api.folders.create(data);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
    return created;
  },

  updateFolder: async (id, data) => {
    await api.folders.update(id, data);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
  },

  deleteFolder: async (id) => {
    await api.folders.delete(id);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
  },

  createRequest: async (data) => {
    const created = await api.requests.create(data);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
    return created;
  },

  updateRequest: async (id, data) => {
    const updated = await api.requests.update(id, data);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);

    // If an open tab matches, keep it synced
    const { tabs, markTabSaved } = useWorkspaceStore.getState();
    const matchingTab = tabs.find((t) => t.requestId === id);
    if (matchingTab && updated) {
      markTabSaved(matchingTab.id, updated);
    }

    return updated;
  },

  deleteRequest: async (id) => {
    await api.requests.delete(id);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);

    // If open tab has this requestId, detach it
    const { tabs } = useWorkspaceStore.getState();
    const matchingTab = tabs.find((t) => t.requestId === id);
    if (matchingTab) {
      useWorkspaceStore.setState({
        tabs: tabs.map((t) =>
          t.id === matchingTab.id ? { ...t, requestId: null, isDirty: true } : t
        ),
      });
    }
  },

  duplicateRequest: async (id) => {
    const duplicated = await api.requests.duplicate(id);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
    return duplicated;
  },

  reorderRequests: async (items) => {
    await api.requests.reorder(items);
    const wsId = useWorkspaceContextStore.getState().activeWorkspaceId;
    await get().loadCollections(wsId || undefined);
  },
}));
