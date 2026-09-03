import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  StopCircle,
  RotateCcw,
  Download,
  Boxes,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCollections } from '@/hooks/use-collections';
import { useEnvStore } from '@/stores/env-store';
import { useRequestRunner } from '@/hooks/use-request-runner';
import { api } from '@/lib/ipc';
import { runPreRequestScript, runTestScript, TestResultItem } from '@/lib/script-runner';
import { ApiRequest, Folder } from '@/types/db';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RunnerRequestItem {
  request: ApiRequest;
  selected: boolean;
}

interface RunResultItem {
  iteration: number;
  requestId: string;
  name: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  testResults: TestResultItem[];
  error?: string;
}

export function RunnerDialog() {
  const { isRunnerModalOpen, runnerCollectionId, closeRunnerModal } = useWorkspaceStore();
  const { collections } = useCollections();
  const { environments, activeEnvironmentId, getActiveEnvironment, loadEnvironments } = useEnvStore();
  const { resolveRequest } = useRequestRunner();

  // Find target collection
  const collection = useMemo(() => {
    return collections.find((c) => c.id === runnerCollectionId) || null;
  }, [collections, runnerCollectionId]);

  // Extract all requests in collection
  const allRequestsInCollection = useMemo(() => {
    if (!collection) return [];
    const list: ApiRequest[] = [];

    // 1. Direct collection requests
    if (collection.requests) {
      list.push(...collection.requests);
    }

    // 2. Folder requests recursively
    const extractFolderRequests = (folders: Folder[]) => {
      for (const f of folders) {
        if (f.requests) list.push(...f.requests);
        if (f.children) extractFolderRequests(f.children);
      }
    };

    if (collection.folders) {
      extractFolderRequests(collection.folders);
    }

    return list;
  }, [collection]);

  // Setup state
  const [requestItems, setRequestItems] = useState<RunnerRequestItem[]>([]);
  const [iterations, setIterations] = useState<number>(1);
  const [delayMs, setDelayMs] = useState<number>(0);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasRun, setHasRun] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [results, setResults] = useState<RunResultItem[]>([]);
  const [expandedResultIdx, setExpandedResultIdx] = useState<number | null>(null);

  const abortControllerRef = useRef<boolean>(false);

  // Initialize checklist whenever collection changes
  useEffect(() => {
    if (allRequestsInCollection.length > 0) {
      setRequestItems(
        allRequestsInCollection.map((r) => ({
          request: r,
          selected: true,
        }))
      );
    } else {
      setRequestItems([]);
    }
    setResults([]);
    setHasRun(false);
    setIsRunning(false);
    setProgressPercent(0);
  }, [allRequestsInCollection, isRunnerModalOpen]);

  const toggleSelectAll = (select: boolean) => {
    setRequestItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const toggleItem = (idx: number) => {
    setRequestItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], selected: !next[idx].selected };
      return next;
    });
  };

  const selectedCount = requestItems.filter((i) => i.selected).length;

  // Run the batch collection
  const handleStartRun = async () => {
    const selected = requestItems.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error('No requests selected to run');
      return;
    }

    setIsRunning(true);
    setHasRun(true);
    setResults([]);
    abortControllerRef.current = false;

    const totalSteps = selected.length * Math.max(1, iterations);
    let completedSteps = 0;
    const runResults: RunResultItem[] = [];

    try {
      for (let iter = 1; iter <= iterations; iter++) {
        for (const item of selected) {
          if (abortControllerRef.current) break;

          const req = item.request;
          setCurrentStepText(`Iter ${iter}/${iterations}: ${req.method} ${req.name}`);

          const env = getActiveEnvironment();
          const varsMap: Record<string, string> = {};
          if (env) {
            env.variables.forEach((v) => {
              if (v.enabled && v.key) varsMap[v.key] = v.value;
            });
          }

          // 1. Pre-request Script
          if (req.scripts?.preRequest?.trim()) {
            const { updatedVariables } = runPreRequestScript(req.scripts.preRequest, varsMap);
            if (Object.keys(updatedVariables).length > 0 && env) {
              const nextVars = [...env.variables];
              for (const [k, val] of Object.entries(updatedVariables)) {
                const foundIdx = nextVars.findIndex((v) => v.key === k);
                if (foundIdx !== -1) {
                  nextVars[foundIdx] = { ...nextVars[foundIdx], value: val };
                } else {
                  nextVars.push({ id: Math.random().toString(), key: k, value: val, enabled: true });
                }
              }
              await api.environments.update(env.id, { variables: nextVars });
              await loadEnvironments();
            }
          }

          // 2. Send Request
          let response: any;
          let testResults: TestResultItem[] = [];

          try {
            const resolved = resolveRequest(req);
            response = await api.engine.execute(resolved);

            // 3. Test Script
            if (req.scripts?.test?.trim() && !response.error) {
              const currentEnv = getActiveEnvironment();
              const currentVars: Record<string, string> = {};
              if (currentEnv) {
                currentEnv.variables.forEach((v) => {
                  if (v.enabled && v.key) currentVars[v.key] = v.value;
                });
              }
              const testOutput = runTestScript(req.scripts.test, response, currentVars);
              testResults = testOutput.testResults;
            }
          } catch (err: any) {
            response = {
              status: 0,
              statusText: 'Execution Error',
              error: err.message || 'Execution failed',
              durationMs: 0,
            };
          }

          const resultItem: RunResultItem = {
            iteration: iter,
            requestId: req.id,
            name: req.name,
            method: req.method,
            url: req.url,
            status: response.status || 0,
            statusText: response.statusText || '',
            durationMs: response.durationMs || 0,
            testResults,
            error: response.error,
          };

          runResults.push(resultItem);
          setResults([...runResults]);

          completedSteps++;
          setProgressPercent(Math.round((completedSteps / totalSteps) * 100));

          // Delay between requests
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }

        if (abortControllerRef.current) break;
      }
    } finally {
      setIsRunning(false);
      setCurrentStepText('');
      toast.success(`Completed collection run (${runResults.length} requests executed)`);
    }
  };

  const handleStopRun = () => {
    abortControllerRef.current = true;
    setIsRunning(false);
    toast.info('Collection run stopped');
  };

  const handleExportResults = () => {
    const jsonStr = JSON.stringify(
      {
        collectionName: collection?.name,
        executedAt: new Date().toISOString(),
        totalRequests: results.length,
        results,
      },
      null,
      2
    );

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection?.name || 'collection'}-run-results.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Run results exported to JSON');
  };

  // Result statistics
  const totalTestsRun = results.reduce((acc, r) => acc + r.testResults.length, 0);
  const totalTestsPassed = results.reduce(
    (acc, r) => acc + r.testResults.filter((t) => t.passed).length,
    0
  );
  const totalTestsFailed = totalTestsRun - totalTestsPassed;
  const totalTimeMs = results.reduce((acc, r) => acc + r.durationMs, 0);
  const avgDurationMs = results.length > 0 ? Math.round(totalTimeMs / results.length) : 0;

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'POST':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'PUT':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    }
  };

  return (
    <Dialog open={isRunnerModalOpen} onOpenChange={(open) => !open && !isRunning && closeRunnerModal()}>
      <DialogContent className="sm:max-w-[760px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border/70 flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Play className="size-4 text-emerald-400 fill-current" />
            <span>Collection Runner: {collection?.name || 'Collection'}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
          {!hasRun ? (
            /* CONFIGURATION VIEW */
            <div className="flex-1 flex flex-col gap-3 overflow-hidden">
              {/* Settings Bar */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/20 border border-border/50 rounded-lg text-xs shrink-0">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Iterations</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={iterations}
                    onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-7 text-xs bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Delay (ms)</label>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={delayMs}
                    onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-7 text-xs bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Environment</label>
                  <div className="h-7 px-2 flex items-center justify-between rounded border border-border/70 bg-background text-xs text-foreground/90">
                    <span className="truncate">
                      {environments.find((e) => e.id === activeEnvironmentId)?.name || 'No Environment'}
                    </span>
                    <Boxes className="size-3 text-[#0275E2] shrink-0" />
                  </div>
                </div>
              </div>

              {/* Request Selection Checklist */}
              <div className="flex items-center justify-between pt-1 shrink-0 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Select Requests to Run</span>
                  <span className="text-muted-foreground">
                    ({selectedCount} of {requestItems.length} selected)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => toggleSelectAll(true)}
                    className="h-6 text-[11px]"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => toggleSelectAll(false)}
                    className="h-6 text-[11px]"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="flex-1 border border-border/60 rounded-lg overflow-y-auto p-2 space-y-1 bg-card/30">
                {requestItems.map((item, idx) => (
                  <div
                    key={item.request.id}
                    onClick={() => toggleItem(idx)}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer select-none transition-colors',
                      item.selected
                        ? 'border-[#0275E2]/40 bg-[#0275E2]/5 text-foreground'
                        : 'border-border/40 text-muted-foreground/60 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => {}}
                        className="rounded border-border accent-[#0275E2]"
                      />
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight border shrink-0',
                          getMethodColor(item.request.method)
                        )}
                      >
                        {item.request.method}
                      </span>
                      <span className="font-medium truncate">{item.request.name}</span>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[280px]">
                      {item.request.url}
                    </span>
                  </div>
                ))}

                {requestItems.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic py-8 text-center">
                    This collection has no requests yet.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* RESULTS / LIVE EXECUTION VIEW */
            <div className="flex-1 flex flex-col gap-3 overflow-hidden">
              {/* Progress Bar & Current Status */}
              {isRunning && (
                <div className="p-3 bg-muted/20 border border-border/50 rounded-lg space-y-2 shrink-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Running Collection...</span>
                    </span>
                    <span className="font-mono text-muted-foreground">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-150"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    {currentStepText}
                  </p>
                </div>
              )}

              {/* Statistics Banner */}
              <div className="grid grid-cols-4 gap-2 text-xs shrink-0">
                <div className="p-2.5 rounded-lg border border-border/60 bg-card/40 flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Executed</span>
                  <span className="font-mono text-sm font-bold text-foreground">{results.length}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-border/60 bg-card/40 flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Passed Tests</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">{totalTestsPassed}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-border/60 bg-card/40 flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Failed Tests</span>
                  <span className="font-mono text-sm font-bold text-rose-400">{totalTestsFailed}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-border/60 bg-card/40 flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Avg Latency</span>
                  <span className="font-mono text-sm font-bold text-foreground">{avgDurationMs} ms</span>
                </div>
              </div>

              {/* Execution Results List */}
              <div className="flex-1 border border-border/60 rounded-lg overflow-y-auto p-2 space-y-1 bg-card/30">
                {results.map((r, idx) => {
                  const isExpanded = expandedResultIdx === idx;
                  const testCount = r.testResults.length;
                  const passedTests = r.testResults.filter((t) => t.passed).length;
                  const allTestsPassed = testCount > 0 && passedTests === testCount;

                  return (
                    <div
                      key={idx}
                      className="border border-border/50 rounded-md overflow-hidden bg-background text-xs"
                    >
                      <div
                        onClick={() => setExpandedResultIdx(isExpanded ? null : idx)}
                        className="flex items-center justify-between p-2 hover:bg-muted/30 cursor-pointer select-none transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <ChevronRight
                            className={cn(
                              'size-3 text-muted-foreground shrink-0 transition-transform duration-150',
                              isExpanded && 'rotate-90'
                            )}
                          />
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight border shrink-0',
                              getMethodColor(r.method)
                            )}
                          >
                            {r.method}
                          </span>
                          <span className="font-medium truncate">{r.name}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {testCount > 0 && (
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight',
                                allTestsPassed
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                              )}
                            >
                              {passedTests}/{testCount} Tests
                            </span>
                          )}

                          <span
                            className={cn(
                              'font-mono text-[11px] font-semibold',
                              r.status >= 200 && r.status < 300
                                ? 'text-emerald-400'
                                : r.status >= 400
                                ? 'text-rose-400'
                                : 'text-muted-foreground'
                            )}
                          >
                            {r.status || 'ERR'} {r.statusText}
                          </span>

                          <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="size-2.5" />
                            {r.durationMs}ms
                          </span>
                        </div>
                      </div>

                      {/* Expandable test results detail */}
                      {isExpanded && (
                        <div className="p-2.5 bg-muted/20 border-t border-border/40 space-y-1.5 text-xs">
                          <div className="font-mono text-[10.5px] text-muted-foreground pb-1">
                            URL: <span className="text-foreground">{r.url}</span>
                          </div>

                          {r.error && (
                            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[11px]">
                              {r.error}
                            </div>
                          )}

                          {r.testResults.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-start justify-between p-1.5 rounded bg-background border border-border/40 text-xs"
                            >
                              <div className="flex items-center gap-1.5">
                                {t.passed ? (
                                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle className="size-3.5 text-rose-400 shrink-0" />
                                )}
                                <span>{t.name}</span>
                              </div>
                              <span
                                className={cn(
                                  'text-[9px] font-mono font-bold tracking-tight uppercase',
                                  t.passed ? 'text-emerald-400' : 'text-rose-400'
                                )}
                              >
                                {t.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                          ))}

                          {r.testResults.length === 0 && !r.error && (
                            <p className="text-[11px] text-muted-foreground italic">
                              No test assertions defined for this request.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <DialogFooter className="px-4 py-3 border-t border-border/70 flex items-center justify-between shrink-0">
          {!hasRun ? (
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeRunnerModal}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleStartRun}
                disabled={selectedCount === 0}
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-xs"
              >
                <Play className="size-3.5 fill-current" />
                <span>Run {selectedCount} Request{selectedCount !== 1 ? 's' : ''}</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHasRun(false)}
                  disabled={isRunning}
                  className="text-xs h-8"
                >
                  Configure
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportResults}
                  disabled={isRunning || results.length === 0}
                  className="text-xs h-8 gap-1.5"
                >
                  <Download className="size-3" />
                  <span>Export JSON</span>
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                {isRunning ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleStopRun}
                    className="text-xs h-8 gap-1.5"
                  >
                    <StopCircle className="size-3.5" />
                    <span>Stop Run</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={closeRunnerModal}
                      className="text-xs h-8"
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleStartRun}
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Run Again</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
