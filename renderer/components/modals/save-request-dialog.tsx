import React, { useState, useEffect } from 'react';
import { Bookmark, Folder as FolderIcon, Boxes } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCollections } from '@/hooks/use-collections';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export function SaveRequestDialog() {
  const {
    isSaveRequestModalOpen,
    setSaveRequestModalOpen,
    tabs,
    activeTabId,
    markTabSaved,
  } = useWorkspaceStore();
  const { collections, createRequest } = useCollections();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [requestName, setRequestName] = useState('');
  const [selectedColId, setSelectedColId] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');

  useEffect(() => {
    if (isSaveRequestModalOpen && activeTab) {
      setRequestName(activeTab.request.name || 'My Request');
      if (activeTab.request.collection_id) {
        setSelectedColId(activeTab.request.collection_id);
      } else if (collections.length > 0) {
        setSelectedColId(collections[0].id);
      }
      setSelectedFolderId(activeTab.request.folder_id || 'root');
    }
  }, [isSaveRequestModalOpen, activeTab, collections]);

  const selectedCol = collections.find((c) => c.id === selectedColId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab || !selectedColId || !requestName.trim()) return;

    try {
      const folderId = selectedFolderId === 'root' ? null : selectedFolderId;
      const dataToSave = {
        ...activeTab.request,
        name: requestName.trim(),
        collection_id: selectedColId,
        folder_id: folderId,
      };

      const saved = await createRequest(dataToSave);
      markTabSaved(activeTab.id, saved);
      setSaveRequestModalOpen(false);
      toast.success('Request saved to collection');
    } catch (err) {
      console.error('Failed to save request:', err);
      toast.error('Failed to save request');
    }
  };

  return (
    <Dialog open={isSaveRequestModalOpen} onOpenChange={setSaveRequestModalOpen}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Bookmark className="size-4 text-[#0275E2]" />
            Save Request to Collection
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Request Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Request Name</Label>
            <Input
              autoFocus
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="e.g. Get User Profile"
              className="h-8 text-xs"
            />
          </div>

          {/* Collection Select */}
          <div className="space-y-1.5">
            <Label className="text-xs">Target Collection</Label>
            <Select value={selectedColId} onValueChange={(val) => {
              setSelectedColId(val);
              setSelectedFolderId('root');
            }}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select a collection..." />
              </SelectTrigger>
              <SelectContent>
                {collections.map((col) => (
                  <SelectItem key={col.id} value={col.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Boxes className="size-3 text-[#0275E2]" />
                      {col.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Folder Select */}
          {selectedCol && selectedCol.folders && selectedCol.folders.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Folder (Optional)</Label>
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Root of collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root" className="text-xs">
                    Root of Collection (No Folder)
                  </SelectItem>
                  {selectedCol.folders.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <FolderIcon className="size-3 text-muted-foreground" />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSaveRequestModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-xs h-8 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
              disabled={!selectedColId || !requestName.trim()}
            >
              Save Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
