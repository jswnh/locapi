import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Braces,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Zap,
  Sparkles,
  Plus,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useEnvStore } from '@/stores/env-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import {
  BUILT_IN_VARIABLES,
  getVariableResolutionStatus,
} from '@/lib/variable-replacer';
import { api } from '@/lib/ipc';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export interface VariableInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  showPreview?: boolean;
  inputClassName?: string;
}

export function VariableInput({
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
  disabled = false,
  showPreview = false,
  ...props
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Quick Add variable state
  const [quickKey, setQuickKey] = useState('');
  const [quickValue, setQuickValue] = useState('');
  const [isAddingQuick, setIsAddingQuick] = useState(false);

  const { environments, activeEnvironmentId, loadEnvironments } = useEnvStore();
  const { setEnvModalOpen } = useWorkspaceStore();

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
  const currentVariables = useMemo(() => {
    return activeEnv ? activeEnv.variables.filter((v) => v.enabled && v.key.trim()) : [];
  }, [activeEnv]);

  // All variable suggestions (active environment + dynamic built-ins)
  const allSuggestions = useMemo(() => {
    const list: Array<{
      key: string;
      value: string;
      isBuiltIn?: boolean;
      description?: string;
    }> = [];

    for (const v of currentVariables) {
      list.push({
        key: v.key,
        value: v.value,
        description: activeEnv ? activeEnv.name : 'Environment',
      });
    }

    for (const b of BUILT_IN_VARIABLES) {
      list.push({
        key: b.key,
        value: b.example,
        isBuiltIn: true,
        description: b.description,
      });
    }

    return list;
  }, [currentVariables, activeEnv]);

  const status = useMemo(() => {
    return getVariableResolutionStatus(value, currentVariables);
  }, [value, currentVariables]);

  // Detect if typing after "{{"
  const autocompleteQuery = useMemo(() => {
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastOpenBraces = textBeforeCursor.lastIndexOf('{{');
    if (lastOpenBraces === -1) return null;
    const lastCloseBraces = textBeforeCursor.lastIndexOf('}}');
    if (lastCloseBraces > lastOpenBraces) return null;
    return textBeforeCursor.slice(lastOpenBraces + 2).trim().toLowerCase();
  }, [value, cursorPos]);

  const filteredSuggestions = useMemo(() => {
    if (autocompleteQuery === null) return [];
    if (!autocompleteQuery) return allSuggestions;
    return allSuggestions.filter(
      (s) =>
        s.key.toLowerCase().includes(autocompleteQuery) ||
        (s.value && s.value.toLowerCase().includes(autocompleteQuery))
    );
  }, [allSuggestions, autocompleteQuery]);

  useEffect(() => {
    if (autocompleteQuery !== null && filteredSuggestions.length > 0) {
      setShowAutocomplete(true);
      setSelectedIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }, [autocompleteQuery, filteredSuggestions.length]);

  const handleSelectSuggestion = (suggestionKey: string) => {
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const lastOpenBraces = textBeforeCursor.lastIndexOf('{{');

    if (lastOpenBraces !== -1) {
      const prefix = textBeforeCursor.slice(0, lastOpenBraces);
      const hasClosing = textAfterCursor.startsWith('}}');
      const suffix = hasClosing ? textAfterCursor.slice(2) : textAfterCursor;

      const newValue = `${prefix}{{${suggestionKey}}}${suffix}`;
      onChange(newValue);

      setShowAutocomplete(false);
      setTimeout(() => {
        if (inputRef.current) {
          const newPos = prefix.length + suggestionKey.length + 4;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 10);
    } else {
      // Append variable at cursor or end
      const newValue = `${textBeforeCursor}{{${suggestionKey}}}${textAfterCursor}`;
      onChange(newValue);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = quickKey.trim().replace(/[{}]/g, '');
    if (!cleanKey) return;

    try {
      const newVar = {
        id: uuidv4(),
        key: cleanKey,
        value: quickValue.trim(),
        enabled: true,
      };

      if (activeEnv) {
        const updatedVars = [...activeEnv.variables, newVar];
        await api.environments.update(activeEnv.id, { variables: updatedVars });
        await loadEnvironments();
        toast.success(`Added {{${cleanKey}}} to ${activeEnv.name}`);
      } else {
        const created = await api.environments.create('Development', [newVar]);
        await api.environments.setActive(created.id);
        await loadEnvironments();
        toast.success(`Created "Development" environment with {{${cleanKey}}}`);
      }

      handleSelectSuggestion(cleanKey);
      setQuickKey('');
      setQuickValue('');
      setIsAddingQuick(false);
    } catch (err) {
      console.error('Failed to quick-add variable:', err);
      toast.error('Failed to add variable');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = filteredSuggestions[selectedIndex];
      if (selected) {
        handleSelectSuggestion(selected.key);
      }
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  return (
    <div className={`relative flex flex-col group ${className}`}>
      <div className="relative flex items-center w-full">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursorPos(e.target.selectionStart || 0);
          }}
          onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
          onClick={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-8 pr-6 text-xs font-mono bg-card/60 border-border focus-visible:ring-[#0275E2]/40 ${
            status.hasVariables && status.unresolvedVariables.length > 0
              ? 'border-amber-500/50 focus-visible:ring-amber-500/40'
              : ''
          } ${inputClassName}`}
          {...props}
        />

        {/* Quick Variable Picker Popover Button */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute right-1 text-muted-foreground/40 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#0275E2] p-1 rounded transition-all"
              title="Insert Variable (or type '{{' anywhere)"
            >
              <Braces className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2 text-xs font-sans z-50">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <Braces className="size-3 text-[#0275E2]" />
                <span>Insert Variable</span>
              </span>
              <Button
                variant="link"
                size="xs"
                onClick={() => setEnvModalOpen(true)}
                className="h-5 px-1 text-[10px] text-[#0275E2] gap-1"
              >
                <span>Manage</span>
                <ExternalLink className="size-2.5" />
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto pt-1 space-y-1 scrollbar-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">
                {activeEnv ? `${activeEnv.name}` : 'No Active Environment'}
              </div>

              {currentVariables.length > 0 ? (
                currentVariables.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectSuggestion(v.key)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-md text-left hover:bg-muted/50 transition-colors group"
                  >
                    <span className="font-mono text-xs text-[#0275E2] font-medium">
                      {`{{${v.key}}}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px] font-mono">
                      {v.value}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-1 text-[11px] text-muted-foreground italic">
                  No active environment variables.
                </div>
              )}

              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1.5 border-t border-border/40">
                Dynamic Variables
              </div>
              {BUILT_IN_VARIABLES.map((b) => (
                <button
                  key={b.key}
                  onClick={() => handleSelectSuggestion(b.key)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded-md text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1 font-mono text-xs text-amber-500 font-medium">
                    <Sparkles className="size-2.5 shrink-0" />
                    <span>{`{{${b.key}}}`}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                    {b.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Add Variable Form */}
            <div className="pt-1.5 mt-1 border-t border-border/50">
              {!isAddingQuick ? (
                <button
                  type="button"
                  onClick={() => setIsAddingQuick(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1 rounded text-[10.5px] font-medium text-[#0275E2] hover:bg-[#0275E2]/10 transition-colors"
                >
                  <Plus className="size-3" />
                  <span>Quick Add Variable</span>
                </button>
              ) : (
                <form onSubmit={handleQuickAdd} className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-1">
                    <Input
                      value={quickKey}
                      onChange={(e) => setQuickKey(e.target.value)}
                      placeholder="key (e.g. baseUrl)"
                      className="h-6 text-[10px] font-mono flex-1 px-1.5 bg-background"
                      autoFocus
                    />
                    <Input
                      value={quickValue}
                      onChange={(e) => setQuickValue(e.target.value)}
                      placeholder="value"
                      className="h-6 text-[10px] font-mono flex-1 px-1.5 bg-background"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setIsAddingQuick(false)}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="xs"
                      disabled={!quickKey.trim()}
                      className="h-5 px-2 text-[10px] bg-[#0275E2] text-white hover:bg-[#0275E2]/90"
                    >
                      Save & Insert
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Autocomplete Dropdown popup when typing "{{" */}
      {showAutocomplete && filteredSuggestions.length > 0 && (
        <div className="absolute top-9 left-0 z-50 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
          <div className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 flex items-center justify-between">
            <span>Variables</span>
            <span className="text-[8px] font-normal">↑↓ select, Enter confirm</span>
          </div>
          <div className="max-h-40 overflow-y-auto py-1 scrollbar-none space-y-0.5">
            {filteredSuggestions.map((s, idx) => (
              <div
                key={s.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(s.key);
                }}
                className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors ${
                  idx === selectedIndex
                    ? 'bg-[#0275E2] text-white font-medium'
                    : 'text-foreground hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {s.isBuiltIn ? (
                    <Sparkles className="size-2.5 shrink-0 text-amber-400" />
                  ) : (
                    <Zap className="size-2.5 shrink-0 text-[#0275E2]" />
                  )}
                  <span className="font-mono text-[11px]">{`{{${s.key}}}`}</span>
                </div>
                <span
                  className={`text-[9.5px] truncate max-w-[90px] font-mono ${
                    idx === selectedIndex ? 'text-white/80' : 'text-muted-foreground'
                  }`}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional Live Variable Preview Bar (e.g. for URL) */}
      {showPreview && status.hasVariables && (
        <div className="mt-1 flex items-center gap-2 text-[11px] px-1 select-none flex-wrap">
          {status.unresolvedVariables.length > 0 ? (
            <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-sm">
              <AlertCircle className="size-3 shrink-0" />
              <span>
                Unresolved variable: <strong>{status.unresolvedVariables.map((v) => `{{${v}}}`).join(', ')}</strong>
              </span>
              <button
                type="button"
                onClick={() => setEnvModalOpen(true)}
                className="underline hover:text-amber-400 ml-1 font-semibold"
              >
                Set in Environment
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/30 border border-border/40 px-2 py-0.5 rounded-sm max-w-full truncate font-mono text-[10.5px]">
              <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
              <span className="text-muted-foreground/70 shrink-0 font-sans">Resolved:</span>
              <span className="truncate text-foreground/85">{status.resolvedText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
