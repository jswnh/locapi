import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, ApiProtocol, Cookie } from '@/types/db';

export interface WorkspaceTab {
  id: string;
  requestId: string | null;
  title: string;
  isDirty: boolean;
  request: ApiRequest;
  response: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: any;
    durationMs?: number;
    sizeBytes?: number;
    contentType?: string;
    cookies?: Cookie[];
    testResults?: { id: string; name: string; passed: boolean; error?: string }[];
    scriptLogs?: string[];
    error?: string;
  } | null;
  isLoading: boolean;
}

export function createDefaultRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  const now = new Date().toISOString();
  return {
    id: overrides.id || uuidv4(),
    collection_id: overrides.collection_id || null,
    folder_id: overrides.folder_id || null,
    name: overrides.name || 'Untitled Request',
    method: overrides.method || 'GET',
    protocol: overrides.protocol || 'REST',
    url: overrides.url || 'https://dummyjson.com/quotes/random',
    headers: overrides.headers || [
      { id: uuidv4(), key: 'Accept', value: 'application/json', enabled: true }
    ],
    params: overrides.params || [],
    body: overrides.body || { type: 'none', raw: '' },
    auth: overrides.auth || { type: 'none' },
    settings: overrides.settings || { timeout: 10000, followRedirects: true },
    scripts: overrides.scripts || { preRequest: '', test: '' },
    sort_order: overrides.sort_order || 0,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

interface WorkspaceState {
  // Tabs
  tabs: WorkspaceTab[];
  activeTabId: string;
  openTab: (request: ApiRequest) => void;
  openNewTab: (protocol?: ApiProtocol) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTabId: (tabId: string) => void;
  updateActiveRequest: (updater: (prev: ApiRequest) => ApiRequest) => void;
  setTabResponse: (tabId: string, response: WorkspaceTab['response']) => void;
  setTabLoading: (tabId: string, isLoading: boolean) => void;
  markTabSaved: (tabId: string, savedRequest: ApiRequest) => void;
  reorderTabs: (draggedTabId: string, targetTabId: string, position: 'before' | 'after') => void;

  // Sidebar
  activeSidebarView: 'collections' | 'history';
  setActiveSidebarView: (view: 'collections' | 'history') => void;
  sidebarMode: 'expanded' | 'collapsed' | 'hover';
  setSidebarMode: (mode: 'expanded' | 'collapsed' | 'hover') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  expandedCollectionIds: string[];
  toggleCollectionExpanded: (id: string) => void;
  expandedFolderIds: string[];
  toggleFolderExpanded: (id: string) => void;

  // Modals & Dialogs
  isEnvModalOpen: boolean;
  setEnvModalOpen: (open: boolean) => void;
  isExportModalOpen: boolean;
  exportCollectionId: string | null;
  openExportModal: (collectionId?: string) => void;
  closeExportModal: () => void;
  isNewCollectionModalOpen: boolean;
  setNewCollectionModalOpen: (open: boolean) => void;
  isNewFolderModalOpen: boolean;
  newFolderTarget: { collectionId: string; parentId?: string | null } | null;
  openNewFolderModal: (target: { collectionId: string; parentId?: string | null }) => void;
  closeNewFolderModal: () => void;
  isSaveRequestModalOpen: boolean;
  setSaveRequestModalOpen: (open: boolean) => void;
  isImportModalOpen: boolean;
  openImportModal: () => void;
  closeImportModal: () => void;
  isRunnerModalOpen: boolean;
  runnerCollectionId: string | null;
  openRunnerModal: (collectionId: string) => void;
  closeRunnerModal: () => void;
  isResponseCollapsed: boolean;
  setResponseCollapsed: (collapsed: boolean) => void;
  toggleResponseCollapsed: () => void;
  sidebarSize: number;
  setSidebarSize: (size: number) => void;
  editorSplitRatio: number;
  setEditorSplitRatio: (ratio: number) => void;
}

const initialRequest = createDefaultRequest();
const initialTabId = uuidv4();

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
  tabs: [
    {
      id: initialTabId,
      requestId: null,
      title: initialRequest.name,
      isDirty: false,
      request: initialRequest,
      response: null,
      isLoading: false,
    },
  ],
  activeTabId: initialTabId,

  openTab: (request: ApiRequest) => {
    const { tabs } = get();
    // Check if tab already exists for this saved request
    const existingIndex = tabs.findIndex((t) => t.requestId === request.id);
    if (existingIndex !== -1) {
      set({ activeTabId: tabs[existingIndex].id });
      return;
    }

    const newTabId = uuidv4();
    const newTab: WorkspaceTab = {
      id: newTabId,
      requestId: request.id,
      title: request.name,
      isDirty: false,
      request: { ...request },
      response: null,
      isLoading: false,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: newTabId,
    });
  },

  openNewTab: (protocol: ApiProtocol = 'REST') => {
    const { tabs } = get();
    const newTabId = uuidv4();

    const defaultUrls: Record<ApiProtocol, string> = {
      REST: 'https://dummyjson.com/quotes/random',
      GRAPHQL: 'https://countries.trevorblades.com/',
      SOAP: 'https://www.dataaccess.com/webservicesserver/NumberConversion.wso',
      WS: 'wss://echo.websocket.org',
      SOCKETIO: 'https://api.postman-echo.com',
      MQTT: 'mqtt://broker.hivemq.com:1883',
      GRPC: 'localhost:50051',
    };

    const defaultNames: Record<ApiProtocol, string> = {
      REST: 'New HTTP Request',
      GRAPHQL: 'New GraphQL Query',
      SOAP: 'New SOAP Request',
      WS: 'New WebSocket Stream',
      SOCKETIO: 'New Socket.IO Client',
      MQTT: 'New MQTT Client',
      GRPC: 'New gRPC Call',
    };

    const newRequest = createDefaultRequest({
      name: defaultNames[protocol] || 'Untitled Request',
      protocol,
      method: protocol === 'GRAPHQL' || protocol === 'SOAP' ? 'POST' : 'GET',
      url: defaultUrls[protocol] || 'https://dummyjson.com/quotes/random',
    });

    const newTab: WorkspaceTab = {
      id: newTabId,
      requestId: null,
      title: newRequest.name,
      isDirty: false,
      request: newRequest,
      response: null,
      isLoading: false,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: newTabId,
    });
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 1) {
      // If closing the only tab, reset to a fresh blank tab
      const freshTabId = uuidv4();
      const freshRequest = createDefaultRequest();
      set({
        tabs: [
          {
            id: freshTabId,
            requestId: null,
            title: freshRequest.name,
            isDirty: false,
            request: freshRequest,
            response: null,
            isLoading: false,
          },
        ],
        activeTabId: freshTabId,
      });
      return;
    }

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);

    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      const nextIndex = tabIndex === tabs.length - 1 ? tabIndex - 1 : tabIndex;
      nextActiveId = newTabs[nextIndex].id;
    }

    set({
      tabs: newTabs,
      activeTabId: nextActiveId,
    });
  },

  closeOtherTabs: (tabId: string) => {
    const { tabs } = get();
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      set({
        tabs: [target],
        activeTabId: target.id,
      });
    }
  },

  closeAllTabs: () => {
    const freshTabId = uuidv4();
    const freshRequest = createDefaultRequest();
    set({
      tabs: [
        {
          id: freshTabId,
          requestId: null,
          title: freshRequest.name,
          isDirty: false,
          request: freshRequest,
          response: null,
          isLoading: false,
        },
      ],
      activeTabId: freshTabId,
    });
  },

  setActiveTabId: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  reorderTabs: (draggedTabId: string, targetTabId: string, position: 'before' | 'after') => {
    const { tabs } = get();
    if (draggedTabId === targetTabId) return;

    const draggedIndex = tabs.findIndex((t) => t.id === draggedTabId);
    const targetIndex = tabs.findIndex((t) => t.id === targetTabId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);

    const updatedTargetIndex = newTabs.findIndex((t) => t.id === targetTabId);
    const insertIndex = position === 'before' ? updatedTargetIndex : updatedTargetIndex + 1;
    newTabs.splice(insertIndex, 0, draggedTab);

    set({ tabs: newTabs });
  },

  updateActiveRequest: (updater: (prev: ApiRequest) => ApiRequest) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map((tab) => {
        if (tab.id === activeTabId) {
          const updatedRequest = updater(tab.request);
          return {
            ...tab,
            title: updatedRequest.name || 'Untitled Request',
            isDirty: true,
            request: updatedRequest,
          };
        }
        return tab;
      }),
    });
  },

  setTabResponse: (tabId: string, response: WorkspaceTab['response']) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) => (t.id === tabId ? { ...t, response, isLoading: false } : t)),
    });
  },

  setTabLoading: (tabId: string, isLoading: boolean) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) => (t.id === tabId ? { ...t, isLoading } : t)),
    });
  },

  markTabSaved: (tabId: string, savedRequest: ApiRequest) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              requestId: savedRequest.id,
              title: savedRequest.name,
              isDirty: false,
              request: savedRequest,
            }
          : t
      ),
    });
  },

  // Sidebar
  activeSidebarView: 'collections',
  setActiveSidebarView: (view) => set({ activeSidebarView: view }),
  sidebarMode:
    typeof window !== 'undefined'
      ? ((localStorage.getItem('locapi-sidebar-mode') as any) || 'expanded')
      : 'expanded',
  setSidebarMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('locapi-sidebar-mode', mode);
    }
    set({ sidebarMode: mode });
  },
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  expandedCollectionIds: [],
  toggleCollectionExpanded: (id) => {
    const { expandedCollectionIds } = get();
    set({
      expandedCollectionIds: expandedCollectionIds.includes(id)
        ? expandedCollectionIds.filter((item) => item !== id)
        : [...expandedCollectionIds, id],
    });
  },
  expandedFolderIds: [],
  toggleFolderExpanded: (id) => {
    const { expandedFolderIds } = get();
    set({
      expandedFolderIds: expandedFolderIds.includes(id)
        ? expandedFolderIds.filter((item) => item !== id)
        : [...expandedFolderIds, id],
    });
  },

  // Modals & Dialogs
  isEnvModalOpen: false,
  setEnvModalOpen: (open) => set({ isEnvModalOpen: open }),
  isExportModalOpen: false,
  exportCollectionId: null,
  openExportModal: (collectionId) =>
    set({ isExportModalOpen: true, exportCollectionId: collectionId || null }),
  closeExportModal: () =>
    set({ isExportModalOpen: false, exportCollectionId: null }),
  isNewCollectionModalOpen: false,
  setNewCollectionModalOpen: (open) => set({ isNewCollectionModalOpen: open }),
  isNewFolderModalOpen: false,
  newFolderTarget: null,
  openNewFolderModal: (target) =>
    set({ isNewFolderModalOpen: true, newFolderTarget: target }),
  closeNewFolderModal: () =>
    set({ isNewFolderModalOpen: false, newFolderTarget: null }),
  isSaveRequestModalOpen: false,
  setSaveRequestModalOpen: (open) => set({ isSaveRequestModalOpen: open }),
  isImportModalOpen: false,
  openImportModal: () => set({ isImportModalOpen: true }),
  closeImportModal: () => set({ isImportModalOpen: false }),
  isRunnerModalOpen: false,
  runnerCollectionId: null,
  openRunnerModal: (collectionId) =>
    set({ isRunnerModalOpen: true, runnerCollectionId: collectionId }),
  closeRunnerModal: () =>
    set({ isRunnerModalOpen: false, runnerCollectionId: null }),
  isResponseCollapsed: false,
  setResponseCollapsed: (collapsed) => set({ isResponseCollapsed: collapsed }),
  toggleResponseCollapsed: () =>
    set((state) => ({ isResponseCollapsed: !state.isResponseCollapsed })),
  sidebarSize: 22,
  setSidebarSize: (size) => set({ sidebarSize: size }),
  editorSplitRatio: 55,
  setEditorSplitRatio: (ratio) => set({ editorSplitRatio: ratio }),
}),
    {
      name: 'locapi-workspace-store',
      partialize: (state) => ({
        tabs: state.tabs.map((t) => ({
          ...t,
          isLoading: false,
        })),
        activeTabId: state.activeTabId,
        activeSidebarView: state.activeSidebarView,
        sidebarMode: state.sidebarMode,
        expandedCollectionIds: state.expandedCollectionIds,
        expandedFolderIds: state.expandedFolderIds,
        isResponseCollapsed: state.isResponseCollapsed,
        sidebarSize: state.sidebarSize,
        editorSplitRatio: state.editorSplitRatio,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure at least one tab exists and activeTabId is valid
          if (!state.tabs || state.tabs.length === 0) {
            const defaultReq = createDefaultRequest();
            const defaultTabId = uuidv4();
            state.tabs = [
              {
                id: defaultTabId,
                requestId: null,
                title: defaultReq.name,
                isDirty: false,
                request: defaultReq,
                response: null,
                isLoading: false,
              },
            ];
            state.activeTabId = defaultTabId;
          } else if (!state.tabs.some((t) => t.id === state.activeTabId)) {
            state.activeTabId = state.tabs[0].id;
          }
        }
      },
    }
  )
);
