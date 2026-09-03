import { useEffect } from "react";
import { Clock } from "lucide-react";
import { HistoryItem } from "@/types/db";
import { MethodBadge } from "@/components/ui/method-badge";
import {
  useWorkspaceStore,
  createDefaultRequest,
} from "@/stores/workspace-store";
import { cn } from "@/lib/utils";

import { useHistoryStore } from "@/stores/history-store";

interface HistoryListProps {
  onCountChange?: (count: number) => void;
  clearTrigger?: number;
}

export function HistoryList({
  onCountChange,
  clearTrigger,
}: HistoryListProps = {}) {
  const {
    items: historyItems,
    isLoading,
    loadHistory,
    clearHistory,
  } = useHistoryStore();
  const { openTab } = useWorkspaceStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    onCountChange?.(historyItems.length);
  }, [historyItems.length, onCountChange]);

  useEffect(() => {
    if (clearTrigger && clearTrigger > 0) {
      clearHistory();
    }
  }, [clearTrigger, clearHistory]);

  const handleRestore = (item: HistoryItem) => {
    const restored = createDefaultRequest({
      name: `${item.method} ${item.url.split("/").pop() || "Request"}`,
      method: item.method as any,
      protocol: item.protocol,
      url: item.url,
      headers: Object.entries(item.request_snapshot.headers || {}).map(
        ([k, v]) => ({
          id: Math.random().toString(),
          key: k,
          value: v,
          enabled: true,
        }),
      ),
      body: item.request_snapshot.body
        ? {
            type:
              typeof item.request_snapshot.body === "string" ? "raw" : "json",
            raw:
              typeof item.request_snapshot.body === "string"
                ? item.request_snapshot.body
                : JSON.stringify(item.request_snapshot.body, null, 2),
          }
        : { type: "none", raw: "" },
    });

    openTab(restored);
  };

  const getStatusColor = (status: number | null) => {
    if (!status) return "text-zinc-400 bg-zinc-500/10";
    if (status >= 200 && status < 300)
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (status >= 300 && status < 400)
      return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    if (status >= 400 && status < 500)
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* History Items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {historyItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleRestore(item)}
            className="group flex flex-col p-2 rounded-md border border-border/40 hover:border-border hover:bg-card/70 cursor-pointer select-none transition-all gap-1"
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 truncate">
                <MethodBadge
                  method={item.method}
                  protocol={item.protocol}
                  size="sm"
                />
                <span className="text-xs font-mono truncate text-foreground/90">
                  {item.url}
                </span>
              </div>
              {item.status && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold",
                    getStatusColor(item.status),
                  )}
                >
                  {item.status}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <div className="flex items-center gap-2">
                {item.duration_ms !== null && (
                  <span className="text-foreground/70">
                    {item.duration_ms} ms
                  </span>
                )}
                {item.size_bytes !== null && (
                  <span>{formatSize(item.size_bytes)}</span>
                )}
              </div>
              <span>{formatTime(item.executed_at)}</span>
            </div>
          </div>
        ))}

        {historyItems.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground/60 text-xs text-center px-4">
            <Clock className="size-8 stroke-[1.2] mb-2 opacity-30" />
            <p className="font-medium text-foreground/70">
              No execution history yet
            </p>
            <p className="text-[11px] mt-0.5">
              Sent requests and responses will be logged here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
