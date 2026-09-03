import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Boxes, ShieldCheck } from 'lucide-react';
import { Environment, EnvironmentVariable } from '@/types/db';
import { api } from '@/lib/ipc';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useEnvStore } from '@/stores/env-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { v4 as uuidv4 } from 'uuid';

export function EnvDialog() {
  const { isEnvModalOpen, setEnvModalOpen } = useWorkspaceStore();
  const { environments, activeEnvironmentId, loadEnvironments, setActiveEnvironment } = useEnvStore();

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [currentEnv, setCurrentEnv] = useState<Environment | null>(null);
  const [newEnvName, setNewEnvName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isEnvModalOpen) {
      loadEnvironments();
    }
  }, [isEnvModalOpen, loadEnvironments]);

  useEffect(() => {
    if (environments.length > 0) {
      const match = environments.find((e) => e.id === selectedEnvId) || environments[0];
      setSelectedEnvId(match.id);
      setCurrentEnv(JSON.parse(JSON.stringify(match)));
    } else {
      setSelectedEnvId(null);
      setCurrentEnv(null);
    }
  }, [environments, selectedEnvId]);

  const handleSelectEnv = (env: Environment) => {
    setSelectedEnvId(env.id);
    setCurrentEnv(JSON.parse(JSON.stringify(env)));
  };

  const handleCreateEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvName.trim()) return;

    try {
      const created = await api.environments.create(newEnvName.trim(), [
        { id: uuidv4(), key: 'baseUrl', value: 'https://api.example.com', enabled: true },
      ]);
      setNewEnvName('');
      setIsCreating(false);
      await loadEnvironments();
      setSelectedEnvId(created.id);
    } catch (err) {
      console.error('Failed to create environment:', err);
    }
  };

  const handleDeleteEnv = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this environment?')) return;
    try {
      await api.environments.delete(id);
      await loadEnvironments();
    } catch (err) {
      console.error('Failed to delete environment:', err);
    }
  };

  const handleAddVariable = () => {
    if (!currentEnv) return;
    const newVar: EnvironmentVariable = {
      id: uuidv4(),
      key: '',
      value: '',
      enabled: true,
    };
    setCurrentEnv({
      ...currentEnv,
      variables: [...currentEnv.variables, newVar],
    });
  };

  const handleUpdateVariable = (index: number, patch: Partial<EnvironmentVariable>) => {
    if (!currentEnv) return;
    const updated = [...currentEnv.variables];
    updated[index] = { ...updated[index], ...patch };
    setCurrentEnv({
      ...currentEnv,
      variables: updated,
    });
  };

  const handleDeleteVariable = (index: number) => {
    if (!currentEnv) return;
    const updated = currentEnv.variables.filter((_, i) => i !== index);
    setCurrentEnv({
      ...currentEnv,
      variables: updated,
    });
  };

  const handleSaveCurrentEnv = async () => {
    if (!currentEnv) return;
    try {
      await api.environments.update(currentEnv.id, {
        name: currentEnv.name,
        variables: currentEnv.variables.filter((v) => v.key.trim() !== ''),
      });
      await loadEnvironments();
    } catch (err) {
      console.error('Failed to update environment:', err);
    }
  };

  return (
    <Dialog open={isEnvModalOpen} onOpenChange={setEnvModalOpen}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border/70 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="size-4 text-[#0275E2]" />
            Manage Environment Variables
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-[420px] overflow-hidden">
          {/* Left: Environments list */}
          <div className="w-56 border-r border-border/70 bg-muted/10 p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
                Environments
              </span>
              <div className="space-y-1 pt-1.5 overflow-y-auto max-h-[300px]">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    onClick={() => handleSelectEnv(env)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors group ${
                      selectedEnvId === env.id
                        ? 'bg-[#0275E2]/15 text-[#0275E2] font-semibold border border-[#0275E2]/30'
                        : 'hover:bg-muted/50 text-foreground/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{env.name}</span>
                      {env.id === activeEnvironmentId && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEnv(env.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}

                {environments.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic px-2 py-4">
                    No environments created yet.
                  </p>
                )}
              </div>
            </div>

            {/* Add Environment Form */}
            <div className="pt-2 border-t border-border/50">
              {isCreating ? (
                <form onSubmit={handleCreateEnv} className="space-y-2">
                  <Input
                    autoFocus
                    size={20}
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    placeholder="Env name (e.g. Staging)"
                    className="h-7 text-xs"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="submit"
                      size="xs"
                      className="flex-1 h-6 text-xs bg-[#0275E2] text-white"
                    >
                      Create
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setIsCreating(false)}
                      className="h-6 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setIsCreating(true)}
                  className="w-full h-7 text-xs gap-1 border-dashed"
                >
                  <Plus className="size-3" />
                  Add Environment
                </Button>
              )}
            </div>
          </div>

          {/* Right: Variable Table */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {currentEnv ? (
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Input
                      value={currentEnv.name}
                      onChange={(e) =>
                        setCurrentEnv({ ...currentEnv, name: e.target.value })
                      }
                      className="h-7 text-xs font-semibold w-48"
                    />
                    <Button
                      variant={currentEnv.id === activeEnvironmentId ? 'default' : 'outline'}
                      size="xs"
                      onClick={() =>
                        setActiveEnvironment(
                          currentEnv.id === activeEnvironmentId ? null : currentEnv.id
                        )
                      }
                      className={
                        currentEnv.id === activeEnvironmentId
                          ? 'h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1'
                          : 'h-7 text-xs gap-1'
                      }
                    >
                      <ShieldCheck className="size-3" />
                      {currentEnv.id === activeEnvironmentId ? 'Active' : 'Set as Active'}
                    </Button>
                  </div>

                  <Button
                    size="xs"
                    onClick={handleSaveCurrentEnv}
                    className="h-7 text-xs bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
                  >
                    Save Changes
                  </Button>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Reference variables in URLs, headers, or body using{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">
                    {'{{variableName}}'}
                  </code>
                </div>

                {/* Variable rows */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {currentEnv.variables.map((variable, idx) => (
                    <div
                      key={variable.id || idx}
                      className="flex items-center gap-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={variable.enabled}
                        onChange={(e) =>
                          handleUpdateVariable(idx, { enabled: e.target.checked })
                        }
                        className="rounded border-border accent-[#0275E2]"
                      />
                      <Input
                        value={variable.key}
                        onChange={(e) =>
                          handleUpdateVariable(idx, { key: e.target.value })
                        }
                        placeholder="Variable Key (e.g. token)"
                        className="h-7 text-xs font-mono w-40 shrink-0"
                      />
                      <Input
                        value={variable.value}
                        onChange={(e) =>
                          handleUpdateVariable(idx, { value: e.target.value })
                        }
                        placeholder="Value"
                        className="h-7 text-xs font-mono flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDeleteVariable(idx)}
                        className="size-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}

                  {currentEnv.variables.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 italic py-6 text-center">
                      No variables added yet. Click &quot;Add Variable&quot; below.
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleAddVariable}
                    className="h-7 text-xs gap-1 border-dashed"
                  >
                    <Plus className="size-3" />
                    Add Variable
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-xs">
                Select an environment from the left or create a new one.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
