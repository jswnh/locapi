import React, { useState } from 'react';
import { Briefcase, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { useWorkspaceContextStore } from '@/stores/workspace-context-store';
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
import { Workspace } from '@/types/db';
import { toast } from 'sonner';

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceDialog({ open, onOpenChange }: WorkspaceDialogProps) {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspaceContextStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');

  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editWsName, setEditWsName] = useState('');
  const [editWsDesc, setEditWsDesc] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      await createWorkspace({
        name: newWsName.trim(),
        description: newWsDesc.trim(),
      });
      setNewWsName('');
      setNewWsDesc('');
      setIsCreating(false);
      toast.success('Workspace created');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create workspace');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWs || !editWsName.trim()) return;

    try {
      await updateWorkspace(editingWs.id, {
        name: editWsName.trim(),
        description: editWsDesc.trim(),
      });
      setEditingWs(null);
      toast.success('Workspace updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update workspace');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (workspaces.length <= 1) {
      toast.error('Cannot delete the only remaining workspace');
      return;
    }

    if (!window.confirm(`Delete workspace "${name}" and all its collections?`)) return;

    try {
      const ok = await deleteWorkspace(id);
      if (ok) {
        toast.success(`Deleted workspace "${name}"`);
      } else {
        toast.error('Failed to delete workspace');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete workspace');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="size-4 text-[#0275E2]" />
            Manage Workspaces
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Workspace List */}
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <div
                  key={ws.id}
                  className={`flex items-center justify-between p-2 rounded-md border text-xs transition-colors ${
                    isActive
                      ? 'bg-[#0275E2]/10 border-[#0275E2]/30'
                      : 'bg-muted/20 border-border/50 hover:bg-muted/40'
                  }`}
                >
                  <div
                    onClick={() => {
                      setActiveWorkspace(ws.id);
                      toast.info(`Switched to "${ws.name}"`);
                    }}
                    className="flex-1 cursor-pointer truncate mr-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground truncate">{ws.name}</span>
                      {isActive && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono flex items-center gap-0.5">
                          <Check className="size-2.5" /> ACTIVE
                        </span>
                      )}
                    </div>
                    {ws.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{ws.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditingWs(ws);
                        setEditWsName(ws.name);
                        setEditWsDesc(ws.description);
                      }}
                      className="size-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={workspaces.length <= 1}
                      onClick={() => handleDelete(ws.id, ws.name)}
                      className="size-7 p-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create Workspace Form */}
          {isCreating ? (
            <form onSubmit={handleCreate} className="p-3 rounded-lg border border-border/70 bg-card space-y-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Workspace Name</Label>
                <Input
                  autoFocus
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Mobile App Backend"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (Optional)</Label>
                <Input
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="Workspace notes..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsCreating(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="xs"
                  className="h-7 text-xs bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
                  disabled={!newWsName.trim()}
                >
                  Create
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(true)}
              className="w-full h-8 text-xs border-dashed gap-1.5"
            >
              <Plus className="size-3.5" />
              New Workspace
            </Button>
          )}

          {/* Edit Workspace Form */}
          {editingWs && (
            <form onSubmit={handleUpdate} className="p-3 rounded-lg border border-border/70 bg-card space-y-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Rename Workspace</Label>
                <Input
                  autoFocus
                  value={editWsName}
                  onChange={(e) => setEditWsName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  value={editWsDesc}
                  onChange={(e) => setEditWsDesc(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingWs(null)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="xs"
                  className="h-7 text-xs bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
                  disabled={!editWsName.trim()}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
