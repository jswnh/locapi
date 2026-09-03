import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Boxes,
  History,
  PanelLeft,
  PanelLeftClose,
  MousePointer,
  Check,
  Trash2,
} from 'lucide-react';
import { Collection, Folder } from '@/types/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CollectionItem } from './collection-item';
import { HistoryList } from './history-list';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCollections } from '@/hooks/use-collections';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/ipc';
import { useHistoryStore } from '@/stores/history-store';

export function CollectionTree() {
  const {
    collections,
    isLoading,
    createCollection,
    updateCollection,
    deleteCollection,
    createFolder,
    deleteFolder,
    createRequest,
    deleteRequest,
    duplicateRequest,
  } = useCollections();

  // Store state
  const {
    sidebarMode,
    setSidebarMode,
    activeSidebarView,
    setActiveSidebarView,
    searchQuery,
    openTab,
    isNewCollectionModalOpen,
    setNewCollectionModalOpen,
    isNewFolderModalOpen,
    newFolderTarget,
    openNewFolderModal,
    closeNewFolderModal,
  } = useWorkspaceStore();

  // Hover state for 'hover' mode
  const [isHovered, setIsHovered] = useState(false);
  const { count: historyCount, loadHistory } = useHistoryStore();
  const [historyClearTrigger, setHistoryClearTrigger] = useState(0);

  // Dialog input states
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState('#0275E2');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameColor, setRenameColor] = useState('#0275E2');
  const [renameDesc, setRenameDesc] = useState('');

  const newColInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const editColInputRef = useRef<HTMLInputElement>(null);
  const hoverContainerRef = useRef<HTMLDivElement>(null);
  const isMouseInsideDrawer = useRef(false);

  const handleMouseEnter = () => {
    isMouseInsideDrawer.current = true;
    setIsHovered(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    isMouseInsideDrawer.current = false;
    const related = e.relatedTarget as HTMLElement | null;
    if (
      related?.closest?.(
        '[role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content]'
      )
    ) {
      return;
    }
    const hasOpenMenu = document.querySelector(
      '[role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content]'
    );
    if (
      hasOpenMenu ||
      Boolean(editingCollection) ||
      isNewCollectionModalOpen ||
      isNewFolderModalOpen
    ) {
      return;
    }
    setIsHovered(false);
  };

  // Close hover drawer when mouse is outside both drawer and open menus
  useEffect(() => {
    if (sidebarMode !== 'hover') return;

    const handlePointerMove = (e: PointerEvent) => {
      if (isHovered && !isMouseInsideDrawer.current) {
        const target = e.target as HTMLElement | null;
        const isOverDrawer = Boolean(
          hoverContainerRef.current?.contains(target as Node)
        );
        const isOverMenu = Boolean(
          target?.closest?.(
            '[role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content], [data-slot="dialog-portal"]'
          )
        );

        if (!isOverDrawer && !isOverMenu) {
          const hasOpenMenu = document.querySelector(
            '[role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content]'
          );
          if (
            !hasOpenMenu &&
            !Boolean(editingCollection) &&
            !isNewCollectionModalOpen &&
            !isNewFolderModalOpen
          ) {
            setIsHovered(false);
          }
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [sidebarMode, isHovered, editingCollection, isNewCollectionModalOpen, isNewFolderModalOpen]);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Handlers
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      await createCollection({
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim() || undefined,
        color: newCollectionColor,
      });
      setNewCollectionName('');
      setNewCollectionDesc('');
      setNewCollectionColor('#0275E2');
      setNewCollectionModalOpen(false);
    } catch (err) {
      console.error('Failed to create collection:', err);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !newFolderTarget) return;
    try {
      await createFolder({
        collectionId: newFolderTarget.collectionId,
        parentId: newFolderTarget.parentId || null,
        name: newFolderName.trim(),
      });
      setNewFolderName('');
      closeNewFolderModal();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleRenameCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection || !renameValue.trim()) return;
    try {
      await updateCollection(editingCollection.id, {
        name: renameValue.trim(),
        description: renameDesc.trim(),
        color: renameColor,
      });
      setEditingCollection(null);
      setRenameValue('');
      setRenameDesc('');
      setRenameColor('#0275E2');
    } catch (err) {
      console.error('Failed to rename collection:', err);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this collection and all its requests?'))
      return;
    try {
      await deleteCollection(id);
    } catch (err) {
      console.error('Failed to delete collection:', err);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this folder?')) return;
    try {
      await deleteFolder(id);
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  const handleAddRequest = async (collectionId: string, folderId: string | null = null) => {
    try {
      const created = await createRequest({
        collection_id: collectionId,
        folder_id: folderId,
        name: 'New Request',
        method: 'GET',
        protocol: 'REST',
        url: 'https://dummyjson.com/quotes/random',
      });
      openTab(created);
    } catch (err) {
      console.error('Failed to add request:', err);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await deleteRequest(id);
    } catch (err) {
      console.error('Failed to delete request:', err);
    }
  };

  const handleDuplicateRequest = async (id: string) => {
    try {
      const duplicated = await duplicateRequest(id);
      if (duplicated) openTab(duplicated);
    } catch (err) {
      console.error('Failed to duplicate request:', err);
    }
  };

  // Filter collections by search query
  const filteredCollections = collections.map((col) => {
    if (!searchQuery.trim()) return col;
    const query = searchQuery.toLowerCase();

    const matchesCollection = col.name.toLowerCase().includes(query);
    const filteredRequests = col.requests?.filter(
      (r) => r.name.toLowerCase().includes(query) || r.url.toLowerCase().includes(query)
    );

    const filterFolders = (folders: Folder[]): Folder[] => {
      return folders
        .map((f) => ({
          ...f,
          requests: f.requests?.filter(
            (r) => r.name.toLowerCase().includes(query) || r.url.toLowerCase().includes(query)
          ),
          children: f.children ? filterFolders(f.children) : [],
        }))
        .filter((f) => (f.requests && f.requests.length > 0) || (f.children && f.children.length > 0));
    };

    const filteredFolders = col.folders ? filterFolders(col.folders) : [];

    if (matchesCollection) return col;

    return {
      ...col,
      requests: filteredRequests,
      folders: filteredFolders,
    };
  });

  // COLLAPSED ICON-ONLY RAIL
  const renderCollapsedRail = () => (
    <div className="h-full w-12 flex flex-col items-center py-2.5 bg-card/60 border-r border-border/70 select-none justify-between shrink-0">
      {/* Top Icons */}
      <div className="flex flex-col items-center gap-3 w-full px-1">
        {/* Collections Icon with (number) badge */}
        <button
          onClick={() => setActiveSidebarView('collections')}
          className={`relative flex flex-col items-center justify-center p-2 rounded-md w-full transition-colors ${
            activeSidebarView === 'collections'
              ? 'text-[#0275E2] bg-[#0275E2]/15 font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
          title={`Collections (${collections.length})`}
        >
          <Boxes className="size-4.5" />
          <span className="text-[9px] font-mono font-bold mt-1 px-1 rounded-full bg-muted border border-border/50 text-foreground/80 leading-tight">
            {collections.length}
          </span>
        </button>

        {/* History Icon with (number) badge */}
        <button
          onClick={() => setActiveSidebarView('history')}
          className={`relative flex flex-col items-center justify-center p-2 rounded-md w-full transition-colors ${
            activeSidebarView === 'history'
              ? 'text-[#0275E2] bg-[#0275E2]/15 font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
          title={`History (${historyCount})`}
        >
          <History className="size-4.5" />
          <span className="text-[9px] font-mono font-bold mt-1 px-1 rounded-full bg-muted border border-border/50 text-foreground/80 leading-tight">
            {historyCount}
          </span>
        </button>

        {/* Plus Button for New Collection */}
        <button
          onClick={() => setNewCollectionModalOpen(true)}
          className="flex items-center justify-center p-2 rounded-md w-full text-[#0275E2] hover:bg-[#0275E2]/15 border border-[#0275E2]/30 transition-colors mt-1"
          title="New Collection"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Bottom Footer 3-State Dropdown */}
      <div className="w-full px-1 pt-2 border-t border-border/40 flex justify-center">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center justify-center transition-colors"
              title={`Sidebar Mode: ${sidebarMode}`}
            >
              {sidebarMode === 'expanded' ? (
                <PanelLeftClose className="size-4 text-[#0275E2]" />
              ) : sidebarMode === 'collapsed' ? (
                <PanelLeft className="size-4 text-[#0275E2]" />
              ) : (
                <MousePointer className="size-4 text-[#0275E2]" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-36 p-1 text-[11px] font-sans">
            <DropdownMenuLabel className="text-[9px] uppercase font-semibold text-muted-foreground px-1.5 py-0.5 tracking-wider">
              Sidebar Mode
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-0.5" />
            <DropdownMenuItem
              onClick={() => setSidebarMode('expanded')}
              className="px-1.5 py-1 text-[11px] gap-1.5 cursor-pointer rounded-xs"
            >
              <PanelLeftClose className="size-3 text-muted-foreground" />
              <span>Expanded</span>
              {sidebarMode === 'expanded' && (
                <Check className="size-2.5 ml-auto text-[#0275E2]" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSidebarMode('collapsed')}
              className="px-1.5 py-1 text-[11px] gap-1.5 cursor-pointer rounded-xs"
            >
              <PanelLeft className="size-3 text-muted-foreground" />
              <span>Collapsed</span>
              {sidebarMode === 'collapsed' && (
                <Check className="size-2.5 ml-auto text-[#0275E2]" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSidebarMode('hover')}
              className="px-1.5 py-1 text-[11px] gap-1.5 cursor-pointer rounded-xs"
            >
              <MousePointer className="size-3 text-muted-foreground" />
              <span>Expand on Hover</span>
              {sidebarMode === 'hover' && (
                <Check className="size-2.5 ml-auto text-[#0275E2]" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  // EXPANDED VIEW
  const renderExpandedContent = () => (
    <div className="h-full w-full flex flex-col bg-card/50 border-r border-border/70 overflow-hidden select-none">
      {/* Top View Switcher & Action Bar */}
      <div className="flex items-center justify-between p-1.5 border-b border-border/50 bg-muted/20 gap-1.5 shrink-0">
        <div className="flex items-center gap-1">
          {/* Collection Tab: Icon + (number) only, no word */}
          <button
            type="button"
            onClick={() => setActiveSidebarView('collections')}
            className={`flex items-center gap-1.5 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
              activeSidebarView === 'collections'
                ? 'bg-background text-[#0275E2] shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
            title="Collections"
          >
            <Boxes className="size-3.5 shrink-0" />
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold border leading-none ${
                activeSidebarView === 'collections'
                  ? 'bg-[#0275E2]/15 text-[#0275E2] border-[#0275E2]/30'
                  : 'bg-muted text-muted-foreground border-border/60'
              }`}
            >
              {collections.length}
            </span>
          </button>

          {/* History Tab: Icon + (number) only, no word */}
          <button
            type="button"
            onClick={() => setActiveSidebarView('history')}
            className={`flex items-center gap-1.5 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
              activeSidebarView === 'history'
                ? 'bg-background text-[#0275E2] shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
            title="History"
          >
            <History className="size-3.5 shrink-0" />
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold border leading-none ${
                activeSidebarView === 'history'
                  ? 'bg-[#0275E2]/15 text-[#0275E2] border-[#0275E2]/30'
                  : 'bg-muted text-muted-foreground border-border/60'
              }`}
            >
              {historyCount}
            </span>
          </button>
        </div>

        {activeSidebarView === 'collections' ? (
          /* Plus Icon for Add Collection with Tooltip */
          <button
            type="button"
            onClick={() => setNewCollectionModalOpen(true)}
            className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-[#0275E2] hover:bg-background transition-colors border border-transparent hover:border-border/60"
            title="New Collection"
          >
            <Plus className="size-3.5" />
          </button>
        ) : (
          /* Clear Icon for Clear History with Tooltip */
          <button
            type="button"
            onClick={() => setHistoryClearTrigger((prev) => prev + 1)}
            disabled={historyCount === 0}
            className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-400 hover:bg-background transition-colors border border-transparent hover:border-border/60 disabled:opacity-30 disabled:pointer-events-none"
            title="Clear History"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {activeSidebarView === 'collections' ? (
        <>
          {/* Collection Tree Items */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                Loading collections...
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground p-4">
                <p>No collections found</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setNewCollectionModalOpen(true)}
                  className="mt-2 text-xs text-[#0275E2]"
                >
                  Create your first collection
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCollections.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    onAddFolder={(collectionId, parentId) =>
                      openNewFolderModal({ collectionId, parentId })
                    }
                    onAddRequest={handleAddRequest}
                    onDeleteCollection={handleDeleteCollection}
                    onDeleteFolder={handleDeleteFolder}
                    onDeleteRequest={handleDeleteRequest}
                    onDuplicateRequest={handleDuplicateRequest}
                    onRenameCollection={(col) => {
                      setEditingCollection(col);
                      setRenameValue(col.name);
                      setRenameDesc(col.description || '');
                      setRenameColor(col.color || '#0275E2');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* History View */
        <div className="flex-1 overflow-hidden flex flex-col">
          <HistoryList
            onCountChange={setHistoryCount}
            clearTrigger={historyClearTrigger}
          />
        </div>
      )}

      {/* Sidebar Footer with 3-State Option */}
      <div className="p-2 border-t border-border/50 bg-muted/10 shrink-0 flex items-center justify-center">
        <div className="flex items-center p-0.5 rounded-md bg-muted/40 border border-border/50 gap-0.5 w-full">
          <button
            onClick={() => setSidebarMode('expanded')}
            className={`flex-1 py-1 rounded text-[10px] flex items-center justify-center gap-1 font-medium transition-colors ${
              sidebarMode === 'expanded'
                ? 'bg-[#0275E2] text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Expanded (Fixed Resizable)"
          >
            <PanelLeftClose className="size-3" />
            <span>Expanded</span>
          </button>
          <button
            onClick={() => setSidebarMode('collapsed')}
            className={`flex-1 py-1 rounded text-[10px] flex items-center justify-center gap-1 font-medium transition-colors ${
              sidebarMode === 'collapsed'
                ? 'bg-[#0275E2] text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Collapsed (Icons Only)"
          >
            <PanelLeft className="size-3" />
            <span>Collapsed</span>
          </button>
          <button
            onClick={() => setSidebarMode('hover')}
            className={`flex-1 py-1 rounded text-[10px] flex items-center justify-center gap-1 font-medium transition-colors ${
              sidebarMode === 'hover'
                ? 'bg-[#0275E2] text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Expand on Hover"
          >
            <MousePointer className="size-3" />
            <span>Hover</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <aside className="h-full select-none">
      {/* 1. COLLAPSED MODE */}
      {sidebarMode === 'collapsed' && renderCollapsedRail()}

      {/* 2. EXPAND ON HOVER MODE */}
      {sidebarMode === 'hover' && (
        <div
          ref={hoverContainerRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative h-full w-12"
        >
          {/* Base icon rail in normal flow */}
          {renderCollapsedRail()}

          {/* Floating drawer over workspace on hover */}
          {isHovered && (
            <div
              className="absolute top-0 bottom-0 left-0 w-64 z-40 shadow-2xl bg-card border-r border-border animate-in fade-in-0 slide-in-from-left-2 duration-150 flex flex-col"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {renderExpandedContent()}
            </div>
          )}
        </div>
      )}

      {/* 3. EXPANDED MODE */}
      {sidebarMode === 'expanded' && renderExpandedContent()}

      {/* New Collection Modal */}
      <Dialog open={isNewCollectionModalOpen} onOpenChange={setNewCollectionModalOpen}>
        <DialogContent
          className="sm:max-w-[420px]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => newColInputRef.current?.focus(), 50);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Create New Collection</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCollection} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Collection Name</Label>
              <Input
                ref={newColInputRef}
                placeholder="e.g. Authentication API"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                className="h-8 text-xs bg-card select-text cursor-text"
              />
            </div>

            {/* Custom Color Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Collection Color</Label>
              <div className="flex items-center gap-2.5">
                <div
                  className="size-8 rounded-md border border-border shadow-xs cursor-pointer relative overflow-hidden shrink-0 hover:ring-2 hover:ring-[#0275E2]/40 transition-all"
                  style={{ backgroundColor: newCollectionColor }}
                >
                  <input
                    type="color"
                    value={newCollectionColor}
                    onChange={(e) => setNewCollectionColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Click to open color picker"
                  />
                </div>
                <Input
                  type="text"
                  value={newCollectionColor}
                  onChange={(e) => setNewCollectionColor(e.target.value)}
                  className="h-8 text-xs font-mono w-28 uppercase bg-card select-text cursor-text"
                  placeholder="#0275E2"
                />
                <span className="text-[11px] text-muted-foreground">Click color box to pick any color</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Description (Optional)</Label>
              <Input
                placeholder="Brief description of this collection"
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                className="h-8 text-xs bg-card select-text cursor-text"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNewCollectionModalOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-8 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
                disabled={!newCollectionName.trim()}
              >
                Create Collection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Folder Modal */}
      <Dialog open={isNewFolderModalOpen} onOpenChange={closeNewFolderModal}>
        <DialogContent
          className="sm:max-w-[360px]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => newFolderInputRef.current?.focus(), 50);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Create New Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Folder Name</Label>
              <Input
                ref={newFolderInputRef}
                placeholder="e.g. Users"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="h-8 text-xs bg-card select-text cursor-text"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeNewFolderModal}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-8 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
                disabled={!newFolderName.trim()}
              >
                Create Folder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename / Edit Collection Modal with Color Picker */}
      <Dialog
        open={Boolean(editingCollection)}
        onOpenChange={(open) => !open && setEditingCollection(null)}
      >
        <DialogContent
          className="sm:max-w-[420px]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => {
              editColInputRef.current?.focus();
              editColInputRef.current?.select();
            }, 50);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Edit Collection Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameCollection} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Collection Name</Label>
              <Input
                ref={editColInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-8 text-xs bg-card select-text cursor-text"
              />
            </div>

            {/* Custom Color Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Collection Color</Label>
              <div className="flex items-center gap-2.5">
                <div
                  className="size-8 rounded-md border border-border shadow-xs cursor-pointer relative overflow-hidden shrink-0 hover:ring-2 hover:ring-[#0275E2]/40 transition-all"
                  style={{ backgroundColor: renameColor }}
                >
                  <input
                    type="color"
                    value={renameColor}
                    onChange={(e) => setRenameColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Click to open color picker"
                  />
                </div>
                <Input
                  type="text"
                  value={renameColor}
                  onChange={(e) => setRenameColor(e.target.value)}
                  className="h-8 text-xs font-mono w-28 uppercase bg-card select-text cursor-text"
                  placeholder="#0275E2"
                />
                <span className="text-[11px] text-muted-foreground">Click color box to pick any color</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Description (Optional)</Label>
              <Input
                placeholder="Brief description of this collection"
                value={renameDesc}
                onChange={(e) => setRenameDesc(e.target.value)}
                className="h-8 text-xs bg-card select-text cursor-text"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingCollection(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-8 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
                disabled={!renameValue.trim()}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
