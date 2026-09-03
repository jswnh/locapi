import { useState, useEffect } from 'react';
import { Download, FileJson, Boxes, Briefcase } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useWorkspaceContextStore } from '@/stores/workspace-context-store';
import { useCollections } from '@/hooks/use-collections';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/ipc';
import { toast } from 'sonner';

export function ExportDialog() {
  const { isExportModalOpen, closeExportModal, exportCollectionId } = useWorkspaceStore();
  const { getActiveWorkspace } = useWorkspaceContextStore();
  const { collections } = useCollections();

  const [exportScope, setExportScope] = useState<'workspace' | 'collection'>('workspace');
  const [selectedColId, setSelectedColId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const activeWs = getActiveWorkspace();

  useEffect(() => {
    if (isExportModalOpen) {
      if (exportCollectionId) {
        setExportScope('collection');
        setSelectedColId(exportCollectionId);
      } else {
        setExportScope('workspace');
        if (collections.length > 0) {
          setSelectedColId(collections[0].id);
        }
      }
    }
  }, [isExportModalOpen, exportCollectionId, collections]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let jsonContent = '';
      let defaultFilename = 'locapi-export.json';

      if (exportScope === 'workspace') {
        jsonContent = await api.data.exportWorkspace(activeWs?.id);
        const cleanWsName = (activeWs?.name || 'workspace')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-');
        defaultFilename = `${cleanWsName}.locapi.json`;
      } else {
        const targetCol = collections.find((c) => c.id === selectedColId);
        if (!targetCol) {
          toast.error('Please select a collection to export');
          setIsExporting(false);
          return;
        }
        jsonContent = await api.data.exportCollection(targetCol.id);
        const cleanColName = targetCol.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        defaultFilename = `${cleanColName}.json`;
      }

      const saveResult = await api.data.saveFile(defaultFilename, jsonContent);
      if (saveResult.success) {
        const fileName = saveResult.filePath?.split(/[/\\]/).pop() || defaultFilename;
        toast.success(`Export saved to ${fileName}`);
        closeExportModal();
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error(err.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isExportModalOpen} onOpenChange={(open) => !open && closeExportModal()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <FileJson className="size-4 text-[#0275E2]" />
            Export Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Export Scope Selector */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground/80">Export Scope</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('workspace')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                  exportScope === 'workspace'
                    ? 'border-[#0275E2] bg-[#0275E2]/10 text-foreground'
                    : 'border-border/60 hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <Briefcase className="size-4 text-[#0275E2] shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold">Entire Workspace</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {activeWs?.name || 'Current workspace'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('collection')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                  exportScope === 'collection'
                    ? 'border-[#0275E2] bg-[#0275E2]/10 text-foreground'
                    : 'border-border/60 hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <Boxes className="size-4 text-[#0275E2] shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold">Single Collection</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Choose collection
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Collection Select if single collection */}
          {exportScope === 'collection' && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium">Select Collection</span>
              <Select value={selectedColId} onValueChange={setSelectedColId}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Choose collection..." />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((col) => (
                    <SelectItem key={col.id} value={col.id} className="text-xs">
                      {col.name} ({col.requests?.length || 0} requests)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {exportScope === 'workspace'
              ? 'Exports all collections, nested folders, requests, protocols, and environment variables in the active workspace into a backup file.'
              : 'Exports all requests, folders, headers, and payloads for the chosen collection into a standard JSON file.'}
          </p>
        </div>

        <DialogFooter className="pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={closeExportModal}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || (exportScope === 'collection' && !selectedColId)}
            className="text-xs h-8 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white gap-1.5"
          >
            <Download className="size-3" />
            {isExporting ? 'Exporting...' : 'Export File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
