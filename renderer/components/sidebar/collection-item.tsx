import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Download,
  Trash2,
  Boxes,
  Palette,
  Play,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collection, Folder, ApiRequest } from '@/types/db';
import { RequestItem } from './request-item';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCollections } from '@/hooks/use-collections';

interface CollectionItemProps {
  collection: Collection;
  onAddRequest: (collectionId: string, folderId?: string | null) => void;
  onAddFolder: (collectionId: string, parentId?: string | null) => void;
  onDeleteCollection: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  onDuplicateRequest: (id: string) => void;
  onRenameCollection: (collection: Collection) => void;
}

export function CollectionItem({
  collection,
  onAddRequest,
  onAddFolder,
  onDeleteCollection,
  onDeleteFolder,
  onDeleteRequest,
  onDuplicateRequest,
  onRenameCollection,
}: CollectionItemProps) {
  const {
    expandedCollectionIds,
    toggleCollectionExpanded,
    expandedFolderIds,
    toggleFolderExpanded,
    openExportModal,
    openRunnerModal,
  } = useWorkspaceStore();
  const { reorderRequests } = useCollections();

  const isExpanded = expandedCollectionIds.includes(collection.id);

  const totalRequestsCount =
    (collection.requests?.length || 0) +
    countFolderRequests(collection.folders || []);

  function countFolderRequests(folders: Folder[]): number {
    return folders.reduce((acc, f) => {
      const direct = f.requests?.length || 0;
      const sub = f.children ? countFolderRequests(f.children) : 0;
      return acc + direct + sub;
    }, 0);
  }

  function findFolderRequests(folders: Folder[], folderId: string): ApiRequest[] {
    for (const f of folders) {
      if (f.id === folderId) return f.requests || [];
      if (f.children) {
        const found = findFolderRequests(f.children, folderId);
        if (found.length > 0) return found;
      }
    }
    return [];
  }

  function findRequestInFolders(folders: Folder[], reqId: string): ApiRequest | null {
    for (const f of folders) {
      const found = f.requests?.find((r) => r.id === reqId);
      if (found) return found;
      if (f.children) {
        const sub = findRequestInFolders(f.children, reqId);
        if (sub) return sub;
      }
    }
    return null;
  }

  const handleReorder = async (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after',
    targetFolderId: string | null
  ) => {
    // Current list under this target container
    const currentList = targetFolderId
      ? findFolderRequests(collection.folders || [], targetFolderId)
      : collection.requests || [];

    // Find dragged request across entire collection
    const draggedReq =
      collection.requests?.find((r) => r.id === draggedId) ||
      findRequestInFolders(collection.folders || [], draggedId);

    if (!draggedReq) return;

    // Filter out dragged item
    const filtered = currentList.filter((r) => r.id !== draggedId);
    const targetIdx = filtered.findIndex((r) => r.id === targetId);

    let newList: ApiRequest[];
    if (targetIdx === -1) {
      newList = [...filtered, draggedReq];
    } else {
      const insertAt = position === 'before' ? targetIdx : targetIdx + 1;
      newList = [...filtered.slice(0, insertAt), draggedReq, ...filtered.slice(insertAt)];
    }

    const payload = newList.map((item, index) => ({
      id: item.id,
      sort_order: index,
      folder_id: targetFolderId,
      collection_id: collection.id,
    }));

    await reorderRequests(payload);
  };

  // Recursive folder renderer
  const renderFolder = (folder: Folder, depth = 1) => {
    const isFolderExpanded = expandedFolderIds.includes(folder.id);

    return (
      <div key={folder.id} className="flex flex-col">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              onClick={() => toggleFolderExpanded(folder.id)}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className="flex items-center justify-between py-1 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer select-none transition-colors group"
            >
              <div className="flex items-center gap-1.5 truncate">
                <ChevronRight
                  className={cn(
                    'size-3 shrink-0 transition-transform duration-150',
                    isFolderExpanded && 'rotate-90 text-foreground'
                  )}
                />
                {isFolderExpanded ? (
                  <FolderOpen className="size-3.5 shrink-0 text-[#0275E2]" />
                ) : (
                  <FolderIcon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                )}
                <span className="truncate">{folder.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                {folder.requests?.length || 0}
              </span>
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-44 text-xs">
            <ContextMenuItem
              onClick={() => onAddRequest(collection.id, folder.id)}
              className="gap-2"
            >
              <FilePlus className="size-3.5 text-muted-foreground" />
              <span>Add Request</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onAddFolder(collection.id, folder.id)}
              className="gap-2"
            >
              <FolderPlus className="size-3.5 text-muted-foreground" />
              <span>Add Subfolder</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onDeleteFolder(folder.id)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="size-3.5" />
              <span>Delete Folder</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Folder children & requests */}
        {isFolderExpanded && (
          <div className="flex flex-col">
            {folder.children?.map((child) => renderFolder(child, depth + 1))}
            {folder.requests?.map((req) => (
              <div key={req.id} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
                <RequestItem
                  request={req}
                  collectionId={collection.id}
                  folderId={folder.id}
                  onDelete={onDeleteRequest}
                  onDuplicate={onDuplicateRequest}
                  onReorder={(draggedId, targetId, pos) =>
                    handleReorder(draggedId, targetId, pos, folder.id)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const collectionColor = collection.color || '#0275E2';

  return (
    <div className="flex flex-col mb-1">
      {/* Collection Header */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={() => toggleCollectionExpanded(collection.id)}
            title={
              collection.description
                ? `${collection.name}\n${collection.description}`
                : collection.name
            }
            className={cn(
              'flex items-center justify-between py-1 px-2 rounded-md text-xs font-medium cursor-pointer select-none transition-colors group',
              isExpanded
                ? 'bg-muted/40 text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
            )}
          >
            <div className="flex items-center gap-1.5 truncate min-w-0 flex-1 mr-1">
              <ChevronRight
                className={cn(
                  'size-3 shrink-0 transition-transform duration-150',
                  isExpanded && 'rotate-90'
                )}
                style={{ color: isExpanded ? collectionColor : undefined }}
              />
              <Boxes
                className="size-3.5 shrink-0 transition-colors"
                style={{ color: collectionColor }}
              />
              <span className="truncate font-medium">{collection.name}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openRunnerModal(collection.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                title="Run Collection"
              >
                <Play className="size-3 fill-current" />
              </button>
              <span className="text-[10px] text-muted-foreground/60 font-mono px-1.5 py-0.5 rounded bg-muted/40">
                {totalRequestsCount}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-60 group-hover:opacity-100 transition-all focus:outline-none"
                    title="Collection options"
                  >
                    <MoreVertical className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-48 text-xs font-sans">
                  <DropdownMenuItem
                    onClick={() => openRunnerModal(collection.id)}
                    className="gap-2 text-emerald-400 focus:text-emerald-400 font-medium cursor-pointer"
                  >
                    <Play className="size-3.5 fill-current" />
                    <span>Run Collection...</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onAddRequest(collection.id, null)}
                    className="gap-2 cursor-pointer"
                  >
                    <FilePlus className="size-3.5 text-muted-foreground" />
                    <span>Add Request</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onAddFolder(collection.id, null)}
                    className="gap-2 cursor-pointer"
                  >
                    <FolderPlus className="size-3.5 text-muted-foreground" />
                    <span>Add Folder</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => openExportModal(collection.id)}
                    className="gap-2 text-[#0275E2] cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    <span>Export Collection...</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onRenameCollection(collection)}
                    className="gap-2 cursor-pointer"
                  >
                    <Palette className="size-3.5 shrink-0" style={{ color: collectionColor }} />
                    <span>Edit Details &amp; Color...</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteCollection(collection.id)}
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete Collection</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-52 text-xs">
          <ContextMenuItem
            onClick={() => openRunnerModal(collection.id)}
            className="gap-2 text-emerald-400 focus:text-emerald-400 font-medium"
          >
            <Play className="size-3.5 fill-current" />
            <span>Run Collection...</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onAddRequest(collection.id, null)}
            className="gap-2"
          >
            <FilePlus className="size-3.5 text-muted-foreground" />
            <span>Add Request</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onAddFolder(collection.id, null)}
            className="gap-2"
          >
            <FolderPlus className="size-3.5 text-muted-foreground" />
            <span>Add Folder</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => openExportModal(collection.id)}
            className="gap-2 text-[#0275E2]"
          >
            <Download className="size-3.5" />
            <span>Export Collection...</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onRenameCollection(collection)}
            className="gap-2"
          >
            <Palette className="size-3.5 shrink-0" style={{ color: collectionColor }} />
            <span>Edit Details &amp; Color...</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDeleteCollection(collection.id)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Collection</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Expanded Contents */}
      {isExpanded && (
        <div className="flex flex-col py-0.5">
          {/* Collection Description Note (Unbordered, inside tree) */}
          {collection.description && (
            <div
              onClick={() => onRenameCollection(collection)}
              className="pl-6 pr-2 py-1 text-[11px] text-muted-foreground/60 italic leading-relaxed cursor-pointer hover:text-foreground transition-colors select-text"
              title="Click to edit collection description"
            >
              <p className="line-clamp-2">{collection.description}</p>
            </div>
          )}

          {/* Folders */}
          {collection.folders?.map((folder) => renderFolder(folder, 1))}

          {/* Direct Collection Requests */}
          {collection.requests?.map((req) => (
            <div key={req.id} className="pl-5">
              <RequestItem
                request={req}
                collectionId={collection.id}
                folderId={null}
                onDelete={onDeleteRequest}
                onDuplicate={onDuplicateRequest}
                onReorder={(draggedId, targetId, pos) =>
                  handleReorder(draggedId, targetId, pos, null)
                }
              />
            </div>
          ))}

          {totalRequestsCount === 0 && (!collection.folders || collection.folders.length === 0) && (
            <div className="pl-6 py-2 text-[11px] text-muted-foreground/50 italic">
              Empty collection. Right click to add request.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
