import React, { useState } from 'react';
import { Copy, Trash2, ExternalLink, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiRequest } from '@/types/db';
import { MethodBadge } from '@/components/ui/method-badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface RequestItemProps {
  request: ApiRequest;
  collectionId: string;
  folderId?: string | null;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onReorder?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
}

export function RequestItem({
  request,
  collectionId,
  folderId = null,
  onDelete,
  onDuplicate,
  onReorder,
}: RequestItemProps) {
  const { openTab, tabs, activeTabId } = useWorkspaceStore();
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isSelected = activeTab?.requestId === request.id;

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        requestId: request.id,
        collectionId,
        folderId,
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverPosition(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      setDragOverPosition('before');
    } else {
      setDragOverPosition('after');
    }
  };

  const handleDragLeave = () => {
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.requestId && onReorder && data.requestId !== request.id) {
        onReorder(data.requestId, request.id, dragOverPosition || 'after');
      }
    } catch (err) {
      console.error('Failed to handle drop reorder:', err);
    } finally {
      setDragOverPosition(null);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => openTab(request)}
          className={cn(
            'group relative flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all select-none',
            isSelected
              ? 'bg-[#0275E2]/15 text-foreground font-medium border border-[#0275E2]/30'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent',
            isDragging && 'opacity-40 scale-[0.98]',
            dragOverPosition === 'before' && 'border-t-2 border-t-[#0275E2] rounded-t-none',
            dragOverPosition === 'after' && 'border-b-2 border-b-[#0275E2] rounded-b-none'
          )}
        >
          <div className="flex items-center gap-1.5 truncate min-w-0">
            <GripVertical className="size-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0 transition-opacity" />
            <MethodBadge method={request.method} protocol={request.protocol} size="sm" />
            <span className="truncate">{request.name}</span>
          </div>

          <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity uppercase font-mono shrink-0 ml-1">
            {request.protocol}
          </span>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-40 text-xs">
        <ContextMenuItem onClick={() => openTab(request)} className="gap-2">
          <ExternalLink className="size-3.5 text-muted-foreground" />
          <span>Open in Tab</span>
        </ContextMenuItem>
        {onDuplicate && (
          <ContextMenuItem onClick={() => onDuplicate(request.id)} className="gap-2">
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Duplicate</span>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        {onDelete && (
          <ContextMenuItem
            onClick={() => onDelete(request.id)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
