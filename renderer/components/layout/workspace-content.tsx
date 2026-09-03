import { useState, useEffect } from 'react';
import { Group, Panel, usePanelRef } from 'react-resizable-panels';
import { TabBar } from './tab-bar';
import { ResizeHandle } from './resize-handle';
import { RequestEditor } from '../request/request-editor';
import { ResponseViewer } from '../response/response-viewer';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkspaceContent() {
  const {
    isResponseCollapsed,
    setResponseCollapsed,
    editorSplitRatio,
    setEditorSplitRatio,
    tabs,
    activeTabId,
  } = useWorkspaceStore();
  const responsePanelRef = usePanelRef();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [isLocalCollapsed, setIsLocalCollapsed] = useState(isResponseCollapsed);

  // Sync store state with resizable panel imperative handle
  useEffect(() => {
    setIsLocalCollapsed(isResponseCollapsed);
    if (isResponseCollapsed) {
      if (!responsePanelRef.current?.isCollapsed()) {
        responsePanelRef.current?.collapse();
      }
    } else {
      if (responsePanelRef.current?.isCollapsed()) {
        responsePanelRef.current?.expand();
      }
    }
  }, [isResponseCollapsed, responsePanelRef]);

  const handlePullToExpand = () => {
    setIsLocalCollapsed(false);
    setResponseCollapsed(false);
    responsePanelRef.current?.expand();
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        <Group
          orientation="horizontal"
          id="locapi-editor-split"
          onLayoutChanged={(layout, meta) => {
            if (!meta.isUserInteraction) return;
            const collapsed = Boolean(
              responsePanelRef.current?.isCollapsed() ||
              (layout['response-panel'] !== undefined && layout['response-panel'] <= 6)
            );
            if (collapsed) {
              setResponseCollapsed(true);
            } else {
              setResponseCollapsed(false);
              if (layout['editor-panel']) {
                setEditorSplitRatio(Math.round(layout['editor-panel']));
              }
            }
          }}
        >
          <Panel
            id="editor-panel"
            defaultSize={editorSplitRatio ? `${editorSplitRatio}%` : '55%'}
            minSize="25%"
            className="h-full overflow-hidden"
          >
            <RequestEditor />
          </Panel>

          <ResizeHandle direction="horizontal" />

          <Panel
            id="response-panel"
            panelRef={responsePanelRef}
            defaultSize={editorSplitRatio ? `${100 - editorSplitRatio}%` : '45%'}
            minSize="20%"
            collapsible={true}
            collapsedSize="34px"
            onResize={(size) => {
              const collapsed = size.inPixels <= 38 || Boolean(responsePanelRef.current?.isCollapsed());
              setIsLocalCollapsed((prev) => (prev !== collapsed ? collapsed : prev));
            }}
            className="h-full overflow-hidden"
          >
            {isLocalCollapsed ? (
              /* Collapsed Pull Button / Rail */
              <button
                type="button"
                onClick={handlePullToExpand}
                className="h-full w-full bg-card/60 hover:bg-muted/60 border-l border-border/70 flex flex-col items-center justify-between py-3 cursor-pointer select-none transition-all group shrink-0 focus:outline-none"
                title="Click or pull to expand Response panel"
              >
                {/* Top invisible spacer to balance with footer icon */}
                <div className="size-7 shrink-0" />

                {/* Vertical Label & Live Status Badge (Centered) */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground group-hover:text-foreground uppercase [writing-mode:vertical-lr] rotate-180">
                    Response
                  </span>

                  {activeTab?.response && activeTab.response.status !== undefined && (
                    <span
                      className={cn(
                        'px-1 py-0.5 rounded text-[9px] font-mono font-bold [writing-mode:vertical-lr] rotate-180',
                        activeTab.response.status >= 200 && activeTab.response.status < 300
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      )}
                    >
                      {activeTab.response.status}
                    </span>
                  )}
                </div>

                {/* Footer Expand Icon (Color Primary) */}
                <div className="p-1.5 rounded-md bg-[#0275E2]/10 text-[#0275E2] group-hover:bg-[#0275E2] group-hover:text-white transition-all shadow-xs shrink-0">
                  <PanelRightOpen className="size-3.5" />
                </div>
              </button>
            ) : (
              <ResponseViewer />
            )}
          </Panel>
        </Group>
      </div>
    </div>
  );
}
