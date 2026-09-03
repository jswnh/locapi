import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Sun,
  Moon,
  Briefcase,
  ChevronDown,
  Check,
  Plus,
  Minus,
  Square,
  Copy,
  X,
  Download,
  Upload,
  Cookie as CookieIcon,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspaceContextStore } from '@/stores/workspace-context-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCookieStore } from '@/stores/cookie-store';
import { useSettingsStore } from '@/stores/settings-store';
import { api } from '@/lib/ipc';
import { WorkspaceDialog } from '../modals/workspace-dialog';
import { TitleSearch } from './title-search';

export function TitleBar() {
  const { theme, setTheme } = useTheme();
  const { openExportModal, openImportModal } = useWorkspaceStore();
  const { openCookieModal } = useCookieStore();
  const { openSettings } = useSettingsStore();
  const disableCookies = useSettingsStore((s) => s.settings.disableCookies);
  const {
    workspaces,
    activeWorkspaceId,
    loadWorkspaces,
    setActiveWorkspace,
    getActiveWorkspace,
  } = useWorkspaceContextStore();

  const [isMaximized, setIsMaximized] = useState(false);
  const [isWsModalOpen, setIsWsModalOpen] = useState(false);

  useEffect(() => {
    loadWorkspaces();

    // Check initial window maximize state
    api.window.isMaximized().then(setIsMaximized).catch(() => {});

    // Listen to maximize / unmaximize events from main process
    const unsubscribe = api.window.onMaximizeChange((maximized) => {
      setIsMaximized(maximized);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadWorkspaces]);

  const activeWs = getActiveWorkspace();

  const handleMinimize = () => {
    api.window.minimize();
  };

  const handleMaximize = async () => {
    const next = await api.window.maximize();
    setIsMaximized(next);
  };

  const handleClose = () => {
    api.window.close();
  };

  return (
    <>
      <header
        style={{ WebkitAppRegion: 'drag' } as any}
        onDoubleClick={handleMaximize}
        className="h-9 border-b border-border/70 bg-card/80 backdrop-blur-md px-2 flex items-center justify-between select-none z-30 shrink-0 text-foreground"
      >
        {/* Left: Brand & Workspace Switcher */}
        <div
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="flex items-center gap-2"
        >
          {/* Brand Logo */}
          <div className="flex items-center gap-1.5 px-1 py-0.5 rounded cursor-default">
            <img
              src="/images/logo.png"
              alt="Locapi Logo"
              className="size-5 rounded-md object-contain shrink-0 shadow-xs"
            />
            <span className="font-bold text-xs tracking-tight text-foreground hidden sm:inline">
              Locapi
            </span>
          </div>

          <div className="h-3.5 w-px bg-border/60 mx-0.5 hidden sm:block" />

          {/* Workspace Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="h-6 px-2 gap-1.5 text-xs font-normal hover:bg-accent/60 hover:text-foreground text-muted-foreground border border-transparent hover:border-border/60"
              >
                <Briefcase className="size-3 text-[#0275E2]" />
                <span className="max-w-[130px] truncate font-medium text-foreground/90">
                  {activeWs ? activeWs.name : 'Workspaces'}
                </span>
                <ChevronDown className="size-2.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 text-xs">
              <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Workspaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspaceId && (
                    <Check className="size-3.5 text-[#0275E2]" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsWsModalOpen(true)}
                className="gap-2 text-[#0275E2] font-medium cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>New / Manage Workspaces</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center: Global Search Bar with Search History */}
        <div className="flex-1 h-full flex items-center justify-center px-2">
          <TitleSearch />
        </div>

        {/* Right: Actions & Native Window Control Buttons */}
        <div
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="flex items-center gap-0.5"
        >
          {/* Cookies Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openCookieModal()}
            className="h-6 px-2 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 hidden sm:flex items-center"
            title={disableCookies ? 'Manage Cookies (Disabled in Settings)' : 'Manage Cookies (Cookie Jar)'}
          >
            <CookieIcon className={`size-3 ${disableCookies ? 'text-amber-500/80' : 'text-[#0275E2]'}`} />
            <span>Cookies</span>
            {disableCookies && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-amber-500/15 text-amber-500 border border-amber-500/30 uppercase">
                Disabled
              </span>
            )}
          </Button>

          {/* Import Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openImportModal()}
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground hover:bg-accent/50 hidden sm:flex"
            title="Import Workspace or Collection"
          >
            <Upload className="size-3 text-[#0275E2]" />
            <span>Import</span>
          </Button>

          {/* Export Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openExportModal()}
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground hover:bg-accent/50 hidden sm:flex"
            title="Export Workspace or Collection"
          >
            <Download className="size-3 text-[#0275E2]" />
            <span>Export</span>
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </Button>

          {/* Settings Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openSettings()}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            title="Settings (Ctrl+,)"
          >
            <SettingsIcon className="size-3.5" />
          </Button>

          <div className="h-3.5 w-px bg-border/60 mx-1" />

          {/* Window Controls: Minimize */}
          <button
            onClick={handleMinimize}
            className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Minimize"
          >
            <Minus className="size-3" />
          </button>

          {/* Window Controls: Maximize / Restore */}
          <button
            onClick={handleMaximize}
            className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy className="size-3 rotate-180" />
            ) : (
              <Square className="size-3" />
            )}
          </button>

          {/* Window Controls: Close */}
          <button
            onClick={handleClose}
            className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-white hover:bg-rose-600 transition-colors"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Workspace Management Modal */}
      <WorkspaceDialog open={isWsModalOpen} onOpenChange={setIsWsModalOpen} />
    </>
  );
}
