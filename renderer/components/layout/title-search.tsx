import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Clock, X, Trash2, ArrowRight } from 'lucide-react';
import { useSearchStore } from '@/stores/search-store';
import { useCollections } from '@/hooks/use-collections';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ApiRequest } from '@/types/db';

export function TitleSearch() {
  const {
    query,
    history,
    isOpen,
    setQuery,
    addToHistory,
    removeFromHistory,
    clearHistory,
    setIsOpen,
  } = useSearchStore();

  const { collections } = useCollections();
  const { openTab, setSearchQuery } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  // Flatten all requests across collections and folders
  const allRequests = useMemo(() => {
    const list: { request: ApiRequest; collectionName: string }[] = [];
    for (const col of collections) {
      for (const req of col.requests || []) {
        list.push({ request: req, collectionName: col.name });
      }
      for (const folder of col.folders || []) {
        for (const req of folder.requests || []) {
          list.push({ request: req, collectionName: `${col.name} / ${folder.name}` });
        }
      }
    }
    return list;
  }, [collections]);

  // Filter requests based on query
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return allRequests.filter(
      (item) =>
        item.request.name.toLowerCase().includes(q) ||
        item.request.url.toLowerCase().includes(q) ||
        item.request.method.toLowerCase().includes(q) ||
        item.collectionName.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [allRequests, query]);

  const handleSelectRequest = (req: ApiRequest) => {
    if (query.trim()) {
      addToHistory(query.trim());
    }
    openTab(req);
    setIsOpen(false);
  };

  const handleSelectHistoryItem = (term: string) => {
    setQuery(term);
    addToHistory(term);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        searchResults.length > 0 ? (prev + 1) % searchResults.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        searchResults.length > 0 ? (prev - 1 + searchResults.length) % searchResults.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        handleSelectRequest(searchResults[selectedIndex].request);
      } else if (query.trim()) {
        addToHistory(query.trim());
      }
    }
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'GET':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'POST':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'PUT':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'PATCH':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default:
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="relative w-72 sm:w-80 md:w-96"
    >
      {/* Search Input in Center of Title Bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 size-3 text-muted-foreground/70 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search requests, history... (Ctrl+K)"
          className="h-6.5 w-full pl-8 pr-14 text-[11px] font-mono rounded-md bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/60 focus:border-[#0275E2]/60 focus:outline-none focus:ring-1 focus:ring-[#0275E2]/40 text-foreground placeholder:text-muted-foreground/50 transition-all"
        />

        {query ? (
          <button
            onClick={() => {
              setQuery('');
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5"
            title="Clear search"
          >
            <X className="size-3" />
          </button>
        ) : (
          <kbd className="absolute right-2 text-[9px] font-mono px-1 py-0.2 rounded bg-background/80 text-muted-foreground/60 border border-border/50 pointer-events-none">
            Ctrl+K
          </kbd>
        )}
      </div>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card/95 backdrop-blur-md border border-border/80 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-100 max-h-[380px] flex flex-col">
          {/* SEARCH HISTORY VIEW (When query is empty) */}
          {!query.trim() && (
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3 text-[#0275E2]" />
                  Recent Searches
                </span>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="hover:text-destructive flex items-center gap-1 text-[10px] normal-case text-muted-foreground/70"
                    title="Clear search history"
                  >
                    <Trash2 className="size-2.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {history.length > 0 ? (
                <div className="space-y-0.5">
                  {history.map((term, idx) => (
                    <div
                      key={idx}
                      className="group flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors"
                      onClick={() => handleSelectHistoryItem(term)}
                    >
                      <span className="flex items-center gap-2 font-mono text-[11px] text-foreground/80 group-hover:text-foreground">
                        <Clock className="size-3 text-muted-foreground/60 group-hover:text-[#0275E2]" />
                        <span className="truncate max-w-[260px]">{term}</span>
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(term);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                        title="Remove from history"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground/60 italic">
                  No recent searches. Type a query to find requests.
                </div>
              )}
            </div>
          )}

          {/* ACTIVE SEARCH RESULTS (When query has text) */}
          {query.trim() && (
            <div className="overflow-y-auto p-1.5 space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Matching Requests ({searchResults.length})
              </div>

              {searchResults.length > 0 ? (
                searchResults.map((item, idx) => (
                  <div
                    key={item.request.id || idx}
                    onClick={() => handleSelectRequest(item.request)}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-xs ${
                      selectedIndex === idx
                        ? 'bg-[#0275E2]/15 border border-[#0275E2]/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase border ${getMethodBadgeClass(
                          item.request.method
                        )}`}
                      >
                        {item.request.method}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate text-xs">
                          {item.request.name}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
                          {item.collectionName} &bull; {item.request.url}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-3 text-muted-foreground/40 shrink-0 ml-2" />
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground/60 italic">
                  No requests matching &quot;{query}&quot;
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
