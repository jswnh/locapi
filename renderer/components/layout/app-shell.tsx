import { useEffect } from 'react';
import { Group, Panel } from 'react-resizable-panels';
import { TitleBar } from './title-bar';
import { ResizeHandle } from './resize-handle';
import { WorkspaceContent } from './workspace-content';
import { CollectionTree } from '../sidebar/collection-tree';
import { EnvDialog } from '../modals/env-dialog';
import { ExportDialog } from '../modals/export-dialog';
import { ImportDialog } from '../modals/import-dialog';
import { SaveRequestDialog } from '../modals/save-request-dialog';
import { CookieDialog } from '../modals/cookie-dialog';
import { SettingsDialog } from '../modals/settings-dialog';
import { RunnerDialog } from '../modals/runner-dialog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useSettingsStore } from '@/stores/settings-store';

export function AppShell() {
  const { openNewTab, closeTab, activeTabId, sidebarMode, sidebarSize, setSidebarSize } = useWorkspaceStore();
  const { openSettings } = useSettingsStore();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+,: Open Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
      }

      // Ctrl+N / Cmd+N: New Tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openNewTab('REST');
      }

      // Ctrl+W / Cmd+W: Close Current Tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openNewTab, closeTab, activeTabId, openSettings]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground select-none">
      {/* Top Application Bar */}
      <TitleBar />

      {/* Main Resizable Layout: Sidebar + Workspace */}
      <div className="flex-1 overflow-hidden">
        {sidebarMode === 'expanded' ? (
          <Group
            orientation="horizontal"
            id="locapi-main-layout"
            onLayoutChanged={(layout, meta) => {
              if (meta.isUserInteraction && layout['sidebar-panel']) {
                setSidebarSize(Math.round(layout['sidebar-panel']));
              }
            }}
          >
            {/* Left Panel: Sidebar */}
            <Panel
              id="sidebar-panel"
              defaultSize={sidebarSize ? `${sidebarSize}%` : '22%'}
              minSize="14%"
              maxSize="45%"
              className="h-full"
            >
              <CollectionTree />
            </Panel>

            <ResizeHandle direction="horizontal" />

            {/* Right Panel: Tabbed Multi-Request Workspace */}
            <Panel
              id="workspace-panel"
              defaultSize={sidebarSize ? `${100 - sidebarSize}%` : '78%'}
              minSize="40%"
              className="h-full flex flex-col overflow-hidden"
            >
              <WorkspaceContent />
            </Panel>
          </Group>
        ) : (
          /* Collapsed or Expand on Hover layout */
          <div className="relative flex h-full w-full overflow-hidden">
            {/* Left Collapsed Rail / Anchor (w-12) */}
            <div className="w-12 h-full shrink-0">
              <CollectionTree />
            </div>

            {/* Right Workspace */}
            <WorkspaceContent />
          </div>
        )}
      </div>

      {/* Global Modals */}
      <EnvDialog />
      <ExportDialog />
      <ImportDialog />
      <SaveRequestDialog />
      <CookieDialog />
      <SettingsDialog />
      <RunnerDialog />
    </div>
  );
}
