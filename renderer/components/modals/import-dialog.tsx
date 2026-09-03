import { useState } from 'react';
import {
  Upload,
  FileUp,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Check,
  Terminal,
} from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/ipc';
import { isCurlCommand, parseCurlCommand } from '@/lib/curl-parser';
import { ApiRequest } from '@/types/db';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export function ImportDialog() {
  const { isImportModalOpen, closeImportModal, openTab } = useWorkspaceStore();
  const { getActiveWorkspace } = useWorkspaceContextStore();
  const { refresh } = useCollections();

  const [importMode, setImportMode] = useState<'file' | 'raw'>('file');
  const [fileName, setFileName] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [detectedInfo, setDetectedInfo] = useState<{
    format: string;
    name: string;
    itemCount: number;
    isCurl?: boolean;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState<string>('');

  const activeWs = getActiveWorkspace();

  const handleSelectFile = async () => {
    try {
      const fileData = await api.data.openFile();
      if (!fileData) return;

      setFileName(fileData.filename);
      setFileContent(fileData.content);
      parseFile(fileData.content);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to open file');
    }
  };

  const parseFile = (contentStr: string) => {
    setParseError('');
    const trimmed = contentStr.trim();
    if (!trimmed) {
      setDetectedInfo(null);
      return;
    }

    // 1. Check for cURL command
    if (isCurlCommand(trimmed)) {
      const parsed = parseCurlCommand(trimmed);
      if (parsed) {
        setDetectedInfo({
          format: 'cURL Command',
          name: `${parsed.method} ${parsed.url}`,
          itemCount: 1,
          isCurl: true,
        });
        return;
      }
    }

    // 2. Check for JSON (Workspace, Collection, Postman)
    try {
      const parsed = JSON.parse(trimmed);

      // Locapi Workspace
      if (parsed.locapi_version && parsed.type === 'workspace') {
        const collections = parsed.collections || [];
        const reqCount = collections.reduce(
          (acc: number, c: any) => acc + (c.requests?.length || 0),
          0
        );
        setDetectedInfo({
          format: 'Locapi Workspace Backup',
          name: parsed.workspace?.name || 'Workspace',
          itemCount: reqCount,
        });
        return;
      }

      // Locapi Collection
      if (parsed.locapi_version && parsed.type === 'collection') {
        const reqCount = parsed.collection?.requests?.length || 0;
        setDetectedInfo({
          format: 'Locapi Collection Backup',
          name: parsed.collection?.name || 'Collection',
          itemCount: reqCount,
        });
        return;
      }

      // OpenAPI / Swagger
      if (parsed.openapi || parsed.swagger) {
        const pathCount = Object.keys(parsed.paths || {}).length;
        setDetectedInfo({
          format: parsed.openapi ? `OpenAPI ${parsed.openapi}` : `Swagger ${parsed.swagger}`,
          name: parsed.info?.title || 'OpenAPI Specification',
          itemCount: pathCount,
        });
        return;
      }

      // Postman Collection
      if (parsed.info && (parsed.info.schema?.includes('postman') || parsed.item)) {
        setDetectedInfo({
          format: 'Postman Collection v2.1',
          name: parsed.info?.name || 'Collection',
          itemCount: parsed.item?.length || 0,
        });
        return;
      }

      // Generic Collection
      if (parsed.name && Array.isArray(parsed.requests)) {
        setDetectedInfo({
          format: 'API Collection',
          name: parsed.name,
          itemCount: parsed.requests.length,
        });
        return;
      }

      setParseError('Content does not match a recognized collection or cURL format.');
      setDetectedInfo(null);
    } catch {
      setParseError('Content is not valid JSON or a recognizable cURL command.');
      setDetectedInfo(null);
    }
  };

  const handleImport = async () => {
    if (!fileContent.trim() || !activeWs) return;

    // Handle cURL import into tab
    if (detectedInfo?.isCurl || isCurlCommand(fileContent.trim())) {
      const parsed = parseCurlCommand(fileContent.trim());
      if (parsed) {
        const newReq: ApiRequest = {
          id: uuidv4(),
          collection_id: null,
          folder_id: null,
          name: `${parsed.method} ${parsed.url}`,
          method: parsed.method,
          url: parsed.url,
          protocol: 'REST',
          headers: parsed.headers,
          params: parsed.params,
          body: {
            ...parsed.body,
            raw: parsed.body.raw || '',
          },
          auth: parsed.auth,
          settings: { timeout: 10000, followRedirects: true },
          sort_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        openTab(newReq);
        toast.success(`Imported cURL command into new tab`);
        handleClose();
        return;
      }
    }

    // Handle JSON file import into workspace database
    setIsImporting(true);
    try {
      const result = await api.data.importPayload(fileContent, activeWs.id);
      if (result.success) {
        toast.success(
          `Imported "${result.name}" (${result.requestsImported} requests) into "${activeWs.name}"`
        );
        await refresh();
        handleClose();
      } else {
        toast.error(result.error || 'Failed to import file');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFileName('');
    setFileContent('');
    setDetectedInfo(null);
    setParseError('');
    closeImportModal();
  };

  return (
    <Dialog open={isImportModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Upload className="size-4 text-[#0275E2]" />
            <span>Import to Workspace</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* Target Workspace Banner */}
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50 text-xs">
            <span className="text-muted-foreground">Target Workspace:</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Check className="size-3 text-[#0275E2]" />
              {activeWs?.name || 'Active Workspace'}
            </span>
          </div>

          {/* Mode Switcher: File or Raw / cURL */}
          <Tabs value={importMode} onValueChange={(v: any) => setImportMode(v)} className="w-full">
            <TabsList className="grid grid-cols-2 h-8">
              <TabsTrigger value="file" className="text-xs gap-1.5">
                <FileUp className="size-3.5" />
                <span>File Upload</span>
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs gap-1.5">
                <Terminal className="size-3.5" />
                <span>Raw Text / cURL</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="pt-2">
              <div
                onClick={handleSelectFile}
                className="border-2 border-dashed border-border/70 hover:border-[#0275E2]/70 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-card/40 hover:bg-muted/20 gap-2"
              >
                <div className="size-9 rounded-full bg-[#0275E2]/10 flex items-center justify-center text-[#0275E2]">
                  <FileUp className="size-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {fileName ? fileName : 'Choose a JSON file to import'}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">
                    Supports Locapi backups &amp; Postman v2.1 collection files
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="mt-1 h-6 text-xs border-border/80"
                >
                  Browse Files...
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="raw" className="pt-2">
              <div className="space-y-1.5">
                <textarea
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value);
                    parseFile(e.target.value);
                  }}
                  placeholder="Paste cURL command (e.g. curl -X POST ...) or raw JSON here..."
                  className="w-full h-32 p-2.5 font-mono text-xs bg-card/60 border border-border rounded-md outline-none focus:border-[#0275E2] resize-none select-text"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Detected Format Preview */}
          {detectedInfo && (
            <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-1 text-xs animate-in fade-in-0">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>Format Detected: {detectedInfo.format}</span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-[11px] pt-0.5">
                <span className="truncate max-w-[320px] font-mono">{detectedInfo.name}</span>
                <span>{detectedInfo.itemCount} item(s)</span>
              </div>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={!detectedInfo || isImporting}
            className="text-xs h-8 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white gap-1.5"
          >
            <FileCode className="size-3" />
            {isImporting
              ? 'Importing...'
              : detectedInfo?.isCurl
              ? 'Open in New Tab'
              : 'Import into Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
