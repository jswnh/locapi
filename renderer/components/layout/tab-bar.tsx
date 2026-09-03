import { useEffect, useState } from 'react';
import {
  Plus,
  X,
  Globe,
  Radio,
  Code2,
  FileCode,
  Boxes,
  ChevronDown,
  Check,
  Settings2,
  Zap,
  Activity,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MethodBadge } from '@/components/ui/method-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useEnvStore } from '@/stores/env-store';

export function TabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    openNewTab,
    setEnvModalOpen,
    reorderTabs,
  } = useWorkspaceStore();

  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ tabId: string; position: 'before' | 'after' } | null>(null);

  const {
    environments,
    activeEnvironmentId,
    loadEnvironments,
    setActiveEnvironment,
  } = useEnvStore();

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  return (
    <div className="h-9 border-b border-border/70 bg-muted/20 flex items-center justify-between px-2 gap-2 select-none shrink-0 overflow-hidden">
      {/* Scrollable Tabs container */}
      <div className="flex items-center gap-1 overflow-x-auto h-full scrollbar-none flex-1 py-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const method = tab.request?.method || 'GET';
          const protocol = tab.request?.protocol || 'REST';
          const isDragging = draggingTabId === tab.id;
          const isDropTargetBefore = dropTarget?.tabId === tab.id && dropTarget.position === 'before';
          const isDropTargetAfter = dropTarget?.tabId === tab.id && dropTarget.position === 'after';

          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', tab.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingTabId(tab.id);
                  }}
                  onDragEnd={() => {
                    setDraggingTabId(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;
                    const position = e.clientX < midX ? 'before' : 'after';
                    setDropTarget({ tabId: tab.id, position });
                  }}
                  onDragLeave={() => {
                    setDropTarget((curr) => (curr?.tabId === tab.id ? null : curr));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceTabId = e.dataTransfer.getData('text/plain') || draggingTabId;
                    if (sourceTabId && sourceTabId !== tab.id && dropTarget) {
                      reorderTabs(sourceTabId, tab.id, dropTarget.position);
                    }
                    setDropTarget(null);
                    setDraggingTabId(null);
                  }}
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    'group relative flex items-center gap-2 h-7 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all border shrink-0 max-w-[200px]',
                    isActive
                      ? 'bg-background text-foreground border-border/80 shadow-xs ring-1 ring-border/50'
                      : 'bg-transparent text-muted-foreground hover:bg-card/50 hover:text-foreground border-transparent',
                    isDragging && 'opacity-40 scale-[0.98]',
                    isDropTargetBefore && 'border-l-2 border-l-[#0275E2] rounded-l-none',
                    isDropTargetAfter && 'border-r-2 border-r-[#0275E2] rounded-r-none'
                  )}
                >
                  {/* Active highlight top indicator */}
                  {isActive && (
                    <div className="absolute top-0 left-2 right-2 h-0.5 bg-[#0275E2] rounded-full" />
                  )}

                  {/* Method Badge */}
                  <MethodBadge method={method} protocol={protocol} size="sm" />

                  {/* Title */}
                  <span className="truncate max-w-[110px]">{tab.title || 'Untitled Request'}</span>

                  {/* Dirty Dot Indicator */}
                  {tab.isDirty && (
                    <span className="size-1.5 rounded-full bg-[#0275E2] shrink-0" title="Unsaved changes" />
                  )}

                  {/* Close Tab Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={cn(
                      'size-3.5 rounded-sm flex items-center justify-center transition-colors opacity-40 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive',
                      isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-60'
                    )}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-44 text-xs">
                <ContextMenuItem onClick={() => closeTab(tab.id)}>
                  Close Tab
                </ContextMenuItem>
                <ContextMenuItem onClick={() => closeOtherTabs(tab.id)}>
                  Close Others
                </ContextMenuItem>
                <ContextMenuItem onClick={() => closeAllTabs()}>
                  Close All
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {/* Plus Button to open new tab */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border shrink-0"
              title="New Tab (Ctrl+N)"
            >
              <Plus className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 text-xs">
            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              HTTP Protocols
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openNewTab('REST')} className="gap-2 cursor-pointer">
              <Globe className="size-3.5 text-sky-400" />
              <span>HTTP / REST Request</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNewTab('GRAPHQL')} className="gap-2 cursor-pointer">
              <Code2 className="size-3.5 text-pink-400" />
              <span>GraphQL Query</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNewTab('SOAP')} className="gap-2 cursor-pointer">
              <FileCode className="size-3.5 text-amber-400" />
              <span>SOAP (XML) Request</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Real-Time & RPC
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openNewTab('WS')} className="gap-2 cursor-pointer">
              <Radio className="size-3.5 text-indigo-400" />
              <span>WebSocket Stream</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNewTab('SOCKETIO')} className="gap-2 cursor-pointer">
              <Zap className="size-3.5 text-amber-400" />
              <span>Socket.IO Client</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNewTab('MQTT')} className="gap-2 cursor-pointer">
              <Activity className="size-3.5 text-teal-400" />
              <span>MQTT IoT Stream</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNewTab('GRPC')} className="gap-2 cursor-pointer">
              <Cpu className="size-3.5 text-violet-400" />
              <span>gRPC Call</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Environment Selector directly inside Tab Bar */}
      <div className="flex items-center gap-1 shrink-0 pl-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              className="h-6 px-2 gap-1.5 text-[11px] font-normal border-border/80 bg-background/60 hover:bg-accent hover:border-[#0275E2]/40"
              title="Select Active Environment"
            >
              <Boxes className="size-3 text-[#0275E2]" />
              <span className="max-w-[100px] truncate">
                {activeEnv ? activeEnv.name : 'No Environment'}
              </span>
              <ChevronDown className="size-2.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Environments
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setActiveEnvironment(null)}
              className="text-xs flex items-center justify-between cursor-pointer"
            >
              <span>No Environment</span>
              {!activeEnvironmentId && <Check className="size-3.5 text-[#0275E2]" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {environments.map((env) => (
              <DropdownMenuItem
                key={env.id}
                onClick={() => setActiveEnvironment(env.id)}
                className="text-xs flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">{env.name}</span>
                {env.id === activeEnvironmentId && <Check className="size-3.5 text-[#0275E2]" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setEnvModalOpen(true)}
              className="text-xs text-[#0275E2] font-medium cursor-pointer"
            >
              <Settings2 className="size-3.5 mr-1.5" />
              Manage Environments
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
