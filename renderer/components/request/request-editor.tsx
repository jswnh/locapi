import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  Bookmark,
  Sparkles,
  Cookie as CookieIcon,
  Upload,
  Code2,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCookieStore } from '@/stores/cookie-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useCollections } from '@/hooks/use-collections';
import { useRequestRunner } from '@/hooks/use-request-runner';
import { HttpMethod, KeyValueItem, FormDataItem } from '@/types/db';
import { api } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { VariableInput } from '@/components/ui/variable-input';
import { CodeEditor } from '@/components/editor/code-editor';
import { CodeSnippetDialog } from '@/components/modals/code-snippet-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { buildUrlWithParams, parseParamsFromUrl } from '@/lib/url';
import { isCurlCommand, parseCurlCommand } from '@/lib/curl-parser';
import { WsClient } from './ws-client';
import { SocketIoClient } from './socketio-client';
import { MqttClient } from './mqtt-client';
import { GrpcClient } from './grpc-client';

export function RequestEditor() {
  const {
    tabs,
    activeTabId,
    updateActiveRequest,
    markTabSaved,
    setSaveRequestModalOpen,
  } = useWorkspaceStore();
  const { openCookieModal } = useCookieStore();
  const { updateRequest } = useCollections();
  const { execute } = useRequestRunner();
  const enableScripts = useSettingsStore((s) => s.settings.enableScripts ?? true);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [activeSubTab, setActiveSubTab] = useState<string>('params');
  const [graphqlTab, setGraphqlTab] = useState<'query' | 'variables'>('query');
  const [codeSnippetOpen, setCodeSnippetOpen] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState<'preRequest' | 'test'>('preRequest');

  // If scripts disabled in settings, fall back to params subtab
  useEffect(() => {
    if (!enableScripts && activeSubTab === 'scripts') {
      setActiveSubTab('params');
    }
  }, [enableScripts, activeSubTab]);

  // Save handler
  const handleSave = async () => {
    if (!activeTab) return;
    const req = activeTab.request;

    if (!req.collection_id) {
      setSaveRequestModalOpen(true);
      return;
    }

    try {
      const saved = await updateRequest(req.id, req);
      if (saved) {
        markTabSaved(activeTab.id, saved);
        toast.success('Request saved to collection');
      }
    } catch (err) {
      console.error('Failed to save request:', err);
      toast.error('Failed to save request');
    }
  };

  // Keyboard shortcuts: Ctrl+S to save, Ctrl+Enter to execute
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeTab?.request.protocol !== 'WS') {
          execute();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
        No open requests. Open or create a request to begin.
      </div>
    );
  }

  const req = activeTab.request;

  // Handlers for Request changes
  const setMethod = (method: HttpMethod) => {
    updateActiveRequest((prev) => ({ ...prev, method }));
  };

  const setUrl = (newUrl: string) => {
    if (isCurlCommand(newUrl)) {
      const parsed = parseCurlCommand(newUrl);
      if (parsed) {
        updateActiveRequest((prev) => ({
          ...prev,
          url: parsed.url,
          method: parsed.method,
          headers: parsed.headers.length > 0 ? parsed.headers : prev.headers,
          params: parsed.params.length > 0 ? parsed.params : prev.params,
          body: {
            ...prev.body,
            type: parsed.body.type !== 'none' ? parsed.body.type : prev.body.type,
            raw: parsed.body.raw !== undefined ? parsed.body.raw : prev.body.raw,
            formData: parsed.body.formData || prev.body.formData,
            urlEncoded: parsed.body.urlEncoded || prev.body.urlEncoded,
          },
          auth: parsed.auth.type !== 'none' ? parsed.auth : prev.auth,
        }));
        toast.success(`Imported cURL command (${parsed.method} ${parsed.url})`);
        return;
      }
    }

    const { params } = parseParamsFromUrl(newUrl);
    updateActiveRequest((prev) => ({
      ...prev,
      url: newUrl,
      params: params.length > 0 ? params : prev.params,
    }));
  };

  const setName = (name: string) => {
    updateActiveRequest((prev) => ({ ...prev, name }));
  };

  // Query Params with live URL synchronization
  const addParam = () => {
    updateActiveRequest((prev) => {
      const nextParams = [...prev.params, { id: uuidv4(), key: '', value: '', enabled: true }];
      const nextUrl = buildUrlWithParams(prev.url, nextParams);
      return { ...prev, params: nextParams, url: nextUrl };
    });
  };

  const updateParam = (index: number, patch: Partial<KeyValueItem>) => {
    updateActiveRequest((prev) => {
      const nextParams = [...prev.params];
      nextParams[index] = { ...nextParams[index], ...patch };
      const nextUrl = buildUrlWithParams(prev.url, nextParams);
      return { ...prev, params: nextParams, url: nextUrl };
    });
  };

  const deleteParam = (index: number) => {
    updateActiveRequest((prev) => {
      const nextParams = prev.params.filter((_, i) => i !== index);
      const nextUrl = buildUrlWithParams(prev.url, nextParams);
      return { ...prev, params: nextParams, url: nextUrl };
    });
  };

  // Headers
  const addHeader = () => {
    updateActiveRequest((prev) => ({
      ...prev,
      headers: [...prev.headers, { id: uuidv4(), key: '', value: '', enabled: true }],
    }));
  };

  const updateHeader = (index: number, patch: Partial<KeyValueItem>) => {
    updateActiveRequest((prev) => {
      const next = [...prev.headers];
      next[index] = { ...next[index], ...patch };
      return { ...prev, headers: next };
    });
  };

  const deleteHeader = (index: number) => {
    updateActiveRequest((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }));
  };

  // Form Data Helpers
  const addFormDataItem = () => {
    updateActiveRequest((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        formData: [
          ...(prev.body.formData || []),
          { id: uuidv4(), key: '', value: '', type: 'text', enabled: true },
        ],
      },
    }));
  };

  const updateFormDataItem = (index: number, patch: Partial<FormDataItem>) => {
    updateActiveRequest((prev) => {
      const next = [...(prev.body.formData || [])];
      next[index] = { ...next[index], ...patch };
      return {
        ...prev,
        body: {
          ...prev.body,
          formData: next,
        },
      };
    });
  };

  const deleteFormDataItem = (index: number) => {
    updateActiveRequest((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        formData: (prev.body.formData || []).filter((_, i) => i !== index),
      },
    }));
  };

  const handleSelectFile = async (index: number) => {
    try {
      const res = await api.data.selectFile();
      if (res && res.filePath) {
        updateFormDataItem(index, {
          value: res.filePath,
          fileName: res.fileName,
        });
      }
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  };

  // URL-Encoded Helpers
  const addUrlEncodedItem = () => {
    updateActiveRequest((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        urlEncoded: [
          ...(prev.body.urlEncoded || []),
          { id: uuidv4(), key: '', value: '', enabled: true },
        ],
      },
    }));
  };

  const updateUrlEncodedItem = (index: number, patch: Partial<KeyValueItem>) => {
    updateActiveRequest((prev) => {
      const next = [...(prev.body.urlEncoded || [])];
      next[index] = { ...next[index], ...patch };
      return {
        ...prev,
        body: {
          ...prev.body,
          urlEncoded: next,
        },
      };
    });
  };

  const deleteUrlEncodedItem = (index: number) => {
    updateActiveRequest((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        urlEncoded: (prev.body.urlEncoded || []).filter((_, i) => i !== index),
      },
    }));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Request Title and Save Button bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 gap-2 shrink-0">
        <input
          value={req.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Request Name"
          className="text-xs font-medium bg-transparent border-none outline-none text-foreground flex-1 hover:bg-muted/30 focus:bg-muted/40 px-1.5 py-0.5 rounded transition-colors"
        />

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setCodeSnippetOpen(true)}
            className="h-6 px-2.5 text-[11px] gap-1.5 border-border/80 hover:border-[#0275E2]/50 hover:text-[#0275E2]"
            title="Generate Code Snippet (cURL, Fetch, Python...)"
          >
            <Code2 className="size-3 text-[#0275E2]" />
            <span>Code</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              try {
                const urlToParse = req.url.startsWith('http') ? req.url : `https://${req.url}`;
                const domain = new URL(urlToParse).hostname;
                openCookieModal(domain);
              } catch {
                openCookieModal();
              }
            }}
            className="h-6 px-2.5 text-[11px] gap-1.5 border-border/80 hover:border-[#0275E2]/50 hover:text-[#0275E2]"
            title="Manage Cookies (Cookie Jar)"
          >
            <CookieIcon className="size-3 text-[#0275E2]" />
            <span>Cookies</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={handleSave}
            className="h-6 px-2.5 text-[11px] gap-1.5 border-border/80 hover:border-[#0275E2]/50 hover:text-[#0275E2]"
            title="Save to database (Ctrl+S)"
          >
            {req.collection_id ? (
              <Save className="size-3" />
            ) : (
              <Bookmark className="size-3 text-[#0275E2]" />
            )}
            <span>{req.collection_id ? 'Save' : 'Save to Collection'}</span>
          </Button>
        </div>
      </div>

      {/* Main Request URL Bar */}
      <div className="p-3 border-b border-border/60 flex items-center gap-2 shrink-0">
        {/* Method Selector (HTTP methods only) or Protocol Badge */}
        {req.protocol === 'REST' || req.protocol === 'GRAPHQL' || req.protocol === 'SOAP' ? (
          <Select value={req.method} onValueChange={(val: HttpMethod) => setMethod(val)}>
            <SelectTrigger className="w-24 h-9 text-xs font-mono font-bold bg-card border-border px-2.5 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-28">
              <SelectItem value="GET" className="font-mono text-emerald-400 font-bold">GET</SelectItem>
              <SelectItem value="POST" className="font-mono text-sky-400 font-bold">POST</SelectItem>
              <SelectItem value="PUT" className="font-mono text-amber-400 font-bold">PUT</SelectItem>
              <SelectItem value="DELETE" className="font-mono text-rose-400 font-bold">DELETE</SelectItem>
              <SelectItem value="PATCH" className="font-mono text-purple-400 font-bold">PATCH</SelectItem>
              <SelectItem value="HEAD" className="font-mono text-zinc-400 font-bold">HEAD</SelectItem>
              <SelectItem value="OPTIONS" className="font-mono text-zinc-400 font-bold">OPTIONS</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="h-9 px-3 rounded-md bg-muted/40 border border-border flex items-center justify-center font-mono text-xs font-bold text-[#0275E2] shrink-0">
            {req.protocol === 'WS' && 'WS'}
            {req.protocol === 'SOCKETIO' && 'SIO'}
            {req.protocol === 'MQTT' && 'MQTT'}
            {req.protocol === 'GRPC' && 'gRPC'}
          </div>
        )}

        {/* URL Input with Variable Autocomplete & Resolution Preview */}
        <div className="flex-1">
          <VariableInput
            value={req.url}
            onChange={(val) => setUrl(val)}
            showPreview={true}
            placeholder={
              req.protocol === 'WS'
                ? 'wss://echo.websocket.org'
                : req.protocol === 'SOCKETIO'
                ? 'http://localhost:3000'
                : req.protocol === 'MQTT'
                ? 'mqtt://broker.hivemq.com:1883'
                : req.protocol === 'GRPC'
                ? 'localhost:50051'
                : 'https://api.example.com/v1/endpoint or {{baseUrl}}/users'
            }
            inputClassName="h-9"
          />
        </div>

        {/* Send Button (for HTTP protocols) */}
        {(req.protocol === 'REST' || req.protocol === 'GRAPHQL' || req.protocol === 'SOAP') && (
          <Button
            size="sm"
            onClick={() => execute()}
            disabled={activeTab.isLoading || !req.url.trim()}
            className="h-9 px-5 text-xs font-semibold bg-[#0275E2] hover:bg-[#0275E2]/90 text-white shadow-xs"
            title="Send Request (Ctrl+Enter)"
          >
            {activeTab.isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Sending...</span>
              </span>
            ) : (
              <span>Send</span>
            )}
          </Button>
        )}
      </div>

      {/* Specialized Protocol Views */}
      {req.protocol === 'WS' && <WsClient url={req.url} tabId={activeTab.id} />}
      {req.protocol === 'SOCKETIO' && <SocketIoClient url={req.url} tabId={activeTab.id} />}
      {req.protocol === 'MQTT' && <MqttClient url={req.url} tabId={activeTab.id} />}
      {req.protocol === 'GRPC' && <GrpcClient url={req.url} tabId={activeTab.id} />}

      {/* Sub-tabs for HTTP protocols: Params, Headers, Body, Auth */}
      {(req.protocol === 'REST' || req.protocol === 'GRAPHQL' || req.protocol === 'SOAP') && (
      <Tabs
        value={activeSubTab}
        onValueChange={setActiveSubTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 border-b border-border/50 bg-muted/10 shrink-0">
          <TabsList className="h-8 bg-transparent p-0 gap-1.5">
            <TabsTrigger
              value="params"
              className="text-xs h-7 px-2.5 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
            >
              <span>Params</span>
              {req.params.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-muted/80 text-foreground/80 border border-border/40">
                  {req.params.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="headers"
              className="text-xs h-7 px-2.5 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
            >
              <span>Headers</span>
              {req.headers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-muted/80 text-foreground/80 border border-border/40">
                  {req.headers.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="body"
              className="text-xs h-7 px-2.5 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
            >
              <span>Body</span>
              {req.protocol === 'GRAPHQL' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-pink-500/15 text-pink-400 border border-pink-500/20">
                  GRAPHQL
                </span>
              ) : req.protocol === 'SOAP' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  XML
                </span>
              ) : req.body.type === 'formData' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-[#0275E2]/15 text-[#0275E2] border border-[#0275E2]/30">
                  form-data
                </span>
              ) : req.body.type === 'x-www-form-urlencoded' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-sky-500/15 text-sky-400 border border-sky-500/20">
                  urlencoded
                </span>
              ) : req.body.type === 'json' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  JSON
                </span>
              ) : req.body.type === 'javascript' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  JS
                </span>
              ) : req.body.type === 'xml' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  XML
                </span>
              ) : req.body.type === 'raw' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
                  raw
                </span>
              ) : null}
            </TabsTrigger>

            <TabsTrigger
              value="auth"
              className="text-xs h-7 px-2.5 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
            >
              <span>Auth</span>
              {req.auth.type !== 'none' && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 uppercase">
                  {req.auth.type === 'apiKey' ? 'API Key' : req.auth.type}
                </span>
              )}
            </TabsTrigger>

            {enableScripts && (
              <TabsTrigger
                value="scripts"
                className="text-xs h-7 px-2.5 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
              >
                <span>Scripts &amp; Tests</span>
                {Boolean(req.scripts?.preRequest?.trim() || req.scripts?.test?.trim()) && (
                  <span className="size-1.5 rounded-full bg-[#0275E2]" />
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Params Tab Content */}
        <TabsContent value="params" className="flex-1 p-3 overflow-y-auto m-0 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
            <span className="font-medium text-foreground/80">Query Parameters</span>
            <Button
              variant="outline"
              size="xs"
              onClick={addParam}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Plus className="size-3" />
              Add Param
            </Button>
          </div>

          <div className="space-y-1.5">
            {req.params.map((param, index) => (
              <div key={param.id || index} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={param.enabled}
                  onChange={(e) => updateParam(index, { enabled: e.target.checked })}
                  className="rounded border-border accent-[#0275E2]"
                />
                <VariableInput
                  value={param.key}
                  onChange={(val) => updateParam(index, { key: val })}
                  placeholder="Key"
                  className="w-44"
                  inputClassName="h-7"
                />
                <VariableInput
                  value={param.value}
                  onChange={(val) => updateParam(index, { value: val })}
                  placeholder="Value"
                  className="flex-1"
                  inputClassName="h-7"
                />
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => deleteParam(index)}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}

            {req.params.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic py-4 text-center">
                No query parameters. Click &quot;Add Param&quot; to append URL parameters.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Headers Tab Content */}
        <TabsContent value="headers" className="flex-1 p-3 overflow-y-auto m-0 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
            <span className="font-medium text-foreground/80">Request Headers</span>
            <Button
              variant="outline"
              size="xs"
              onClick={addHeader}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Plus className="size-3" />
              Add Header
            </Button>
          </div>

          <div className="space-y-1.5">
            {req.headers.map((header, index) => (
              <div key={header.id || index} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={header.enabled}
                  onChange={(e) => updateHeader(index, { enabled: e.target.checked })}
                  className="rounded border-border accent-[#0275E2]"
                />
                <VariableInput
                  value={header.key}
                  onChange={(val) => updateHeader(index, { key: val })}
                  placeholder="Header (e.g. Content-Type)"
                  className="w-48"
                  inputClassName="h-7"
                />
                <VariableInput
                  value={header.value}
                  onChange={(val) => updateHeader(index, { value: val })}
                  placeholder="Value"
                  className="flex-1"
                  inputClassName="h-7"
                />
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => deleteHeader(index)}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}

            {req.headers.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic py-4 text-center">
                No custom headers configured.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Body Tab Content (with Protocol-Specific Editors) */}
        <TabsContent value="body" className="flex-1 p-3 flex flex-col m-0 gap-2 overflow-hidden">
          {/* GraphQL Protocol View */}
          {req.protocol === 'GRAPHQL' ? (
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGraphqlTab('query')}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                      graphqlTab === 'query'
                        ? 'bg-[#0275E2] text-white'
                        : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Query
                  </button>
                  <button
                    onClick={() => setGraphqlTab('variables')}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                      graphqlTab === 'variables'
                        ? 'bg-[#0275E2] text-white'
                        : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Variables (JSON)
                  </button>
                </div>

                <span className="text-[10px] text-muted-foreground font-mono">
                  Content-Type: application/json
                </span>
              </div>

              {graphqlTab === 'query' ? (
                <CodeEditor
                  value={req.body.graphql?.query || req.body.raw || ''}
                  language="graphql"
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      body: {
                        ...prev.body,
                        graphql: {
                          query: val,
                          variables: prev.body.graphql?.variables || '',
                        },
                      },
                    }))
                  }
                  className="flex-1"
                />
              ) : (
                <CodeEditor
                  value={req.body.graphql?.variables || ''}
                  language="json"
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      body: {
                        ...prev.body,
                        graphql: {
                          query: prev.body.graphql?.query || prev.body.raw || '',
                          variables: val,
                        },
                      },
                    }))
                  }
                  className="flex-1"
                />
              )}
            </div>
          ) : req.protocol === 'SOAP' ? (
            /* SOAP (XML) Protocol View */
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  SOAP XML Envelope Payload
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      body: {
                        type: 'xml',
                        raw: `<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <GetQuote xmlns="http://tempuri.org/">\n      <symbol>GOOG</symbol>\n    </GetQuote>\n  </soap:Body>\n</soap:Envelope>`,
                      },
                    }))
                  }
                  className="h-6 text-[10px] gap-1"
                >
                  <Sparkles className="size-3 text-amber-400" />
                  Insert Template
                </Button>
              </div>

              <CodeEditor
                value={req.body.raw || ''}
                language="xml"
                onChange={(val) =>
                  updateActiveRequest((prev) => ({
                    ...prev,
                    body: { ...prev.body, type: 'xml', raw: val },
                  }))
                }
                className="flex-1"
              />
            </div>
          ) : (
            /* Standard REST Body View */
            <>
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                <span className="text-[11px] text-muted-foreground font-medium">Body Type:</span>
                <Select
                  value={req.body.type || 'none'}
                  onValueChange={(val: any) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      body: { ...prev.body, type: val },
                    }))
                  }
                >
                  <SelectTrigger className="w-36 h-6 px-2 text-[11px] font-mono bg-card border-border/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-44 text-xs">
                    <SelectItem value="none" className="text-xs">none</SelectItem>
                    <SelectItem value="formData" className="text-xs font-semibold text-[#0275E2]">form-data</SelectItem>
                    <SelectItem value="x-www-form-urlencoded" className="text-xs font-semibold text-sky-400">x-www-form-urlencoded</SelectItem>
                    <SelectItem value="json" className="text-xs font-semibold text-emerald-400">raw (JSON)</SelectItem>
                    <SelectItem value="javascript" className="text-xs font-semibold text-amber-400">raw (JavaScript)</SelectItem>
                    <SelectItem value="xml" className="text-xs font-semibold text-amber-400">raw (XML)</SelectItem>
                    <SelectItem value="raw" className="text-xs font-semibold text-zinc-400">raw (Text)</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-[10px] font-mono text-muted-foreground/70 ml-auto hidden sm:inline">
                  {req.body.type === 'formData' && 'multipart/form-data'}
                  {req.body.type === 'x-www-form-urlencoded' && 'application/x-www-form-urlencoded'}
                  {req.body.type === 'json' && 'application/json'}
                  {req.body.type === 'javascript' && 'application/javascript'}
                  {req.body.type === 'xml' && 'application/xml'}
                  {req.body.type === 'raw' && 'text/plain'}
                  {req.body.type === 'none' && 'No Body'}
                </span>
              </div>

              {/* Form Data Table */}
              {req.body.type === 'formData' ? (
                <div className="flex-1 flex flex-col gap-2 overflow-hidden pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/40">
                    <span className="font-medium text-foreground/80">Multipart Form Data (files & fields)</span>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={addFormDataItem}
                      className="h-6 px-2 text-[11px] gap-1 border-border/80 hover:border-[#0275E2]"
                    >
                      <Plus className="size-3 text-[#0275E2]" />
                      Add Field
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {(req.body.formData || []).map((item, index) => (
                      <div key={item.id || index} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => updateFormDataItem(index, { enabled: e.target.checked })}
                          className="rounded border-border accent-[#0275E2]"
                        />
                        <VariableInput
                          value={item.key}
                          onChange={(val) => updateFormDataItem(index, { key: val })}
                          placeholder="Key (e.g. avatar, userId)"
                          className="w-44"
                          inputClassName="h-7 bg-card/60"
                        />
                        <Select
                          value={item.type || 'text'}
                          onValueChange={(val: 'text' | 'file') => updateFormDataItem(index, { type: val })}
                        >
                          <SelectTrigger className="w-20 h-7 text-[11px] font-mono bg-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text" className="text-xs">Text</SelectItem>
                            <SelectItem value="file" className="text-xs font-semibold text-[#0275E2]">File</SelectItem>
                          </SelectContent>
                        </Select>

                        {item.type === 'file' ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => handleSelectFile(index)}
                              className="h-7 text-[11px] font-mono gap-1.5 flex-1 justify-start truncate bg-card/60 border-border hover:border-[#0275E2]"
                            >
                              <Upload className="size-3 text-[#0275E2] shrink-0" />
                              <span className="truncate">{item.fileName || item.value || 'Choose File...'}</span>
                            </Button>
                          </div>
                        ) : (
                          <VariableInput
                            value={item.value}
                            onChange={(val) => updateFormDataItem(index, { value: val })}
                            placeholder="Value or {{var}}"
                            className="flex-1"
                            inputClassName="h-7 bg-card/60"
                          />
                        )}

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => deleteFormDataItem(index)}
                          className="size-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}

                    {(!req.body.formData || req.body.formData.length === 0) && (
                      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 py-8 text-xs">
                        <Upload className="size-6 stroke-[1.2] mb-2 opacity-30 text-[#0275E2]" />
                        <p className="font-semibold text-foreground/70">No Form Data Fields</p>
                        <p className="text-[11px] mt-0.5 max-w-[280px]">
                          Add key-value fields or upload local files as multipart form data.
                        </p>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={addFormDataItem}
                          className="mt-3 h-6 text-xs gap-1"
                        >
                          <Plus className="size-3" />
                          Add First Field
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : req.body.type === 'x-www-form-urlencoded' ? (
                /* URL Encoded Table */
                <div className="flex-1 flex flex-col gap-2 overflow-hidden pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/40">
                    <span className="font-medium text-foreground/80">URL-Encoded Form Parameters</span>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={addUrlEncodedItem}
                      className="h-6 px-2 text-[11px] gap-1 border-border/80 hover:border-[#0275E2]"
                    >
                      <Plus className="size-3 text-[#0275E2]" />
                      Add Parameter
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {(req.body.urlEncoded || []).map((item, index) => (
                      <div key={item.id || index} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => updateUrlEncodedItem(index, { enabled: e.target.checked })}
                          className="rounded border-border accent-[#0275E2]"
                        />
                        <VariableInput
                          value={item.key}
                          onChange={(val) => updateUrlEncodedItem(index, { key: val })}
                          placeholder="Key"
                          className="w-44"
                          inputClassName="h-7 bg-card/60"
                        />
                        <VariableInput
                          value={item.value}
                          onChange={(val) => updateUrlEncodedItem(index, { value: val })}
                          placeholder="Value or {{var}}"
                          className="flex-1"
                          inputClassName="h-7 bg-card/60"
                        />
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => deleteUrlEncodedItem(index)}
                          className="size-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}

                    {(!req.body.urlEncoded || req.body.urlEncoded.length === 0) && (
                      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 py-8 text-xs">
                        <p className="font-semibold text-foreground/70">No URL-Encoded Parameters</p>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={addUrlEncodedItem}
                          className="mt-3 h-6 text-xs gap-1"
                        >
                          <Plus className="size-3" />
                          Add First Parameter
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : req.body.type !== 'none' ? (
                /* Raw text, JSON, JavaScript, XML using Monaco Editor */
                <CodeEditor
                  value={req.body.raw || ''}
                  language={req.body.type}
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      body: { ...prev.body, raw: val },
                    }))
                  }
                  className="flex-1"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/60 italic">
                  This request does not have a body payload.
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Auth Tab Content */}
        <TabsContent value="auth" className="flex-1 p-3 overflow-y-auto m-0 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Auth Type:</span>
            {(['none', 'bearer', 'basic', 'apiKey'] as const).map((type) => (
              <button
                key={type}
                onClick={() =>
                  updateActiveRequest((prev) => ({
                    ...prev,
                    auth: { ...prev.auth, type },
                  }))
                }
                className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  req.auth.type === type
                    ? 'bg-[#0275E2]/15 text-[#0275E2] border-[#0275E2]/40 font-bold'
                    : 'text-muted-foreground border-transparent hover:bg-muted/40'
                }`}
              >
                {type === 'none' ? 'NO AUTH' : type === 'apiKey' ? 'API KEY' : type.toUpperCase()}
              </button>
            ))}
          </div>

          {req.auth.type === 'bearer' && (
            <div className="space-y-1.5 max-w-md pt-2">
              <span className="text-xs font-medium">Bearer Token</span>
              <VariableInput
                value={req.auth.bearer?.token || ''}
                onChange={(val) =>
                  updateActiveRequest((prev) => ({
                    ...prev,
                    auth: { ...prev.auth, bearer: { token: val } },
                  }))
                }
                placeholder="Token or {{token}}"
                inputClassName="h-8"
              />
            </div>
          )}

          {req.auth.type === 'basic' && (
            <div className="space-y-2 max-w-md pt-2">
              <div className="space-y-1">
                <span className="text-xs font-medium">Username</span>
                <VariableInput
                  value={req.auth.basic?.username || ''}
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      auth: {
                        ...prev.auth,
                        basic: {
                          username: val,
                          password: prev.auth.basic?.password || '',
                        },
                      },
                    }))
                  }
                  placeholder="Username or {{username}}"
                  inputClassName="h-8"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium">Password</span>
                <VariableInput
                  type="password"
                  value={req.auth.basic?.password || ''}
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      auth: {
                        ...prev.auth,
                        basic: {
                          username: prev.auth.basic?.username || '',
                          password: val,
                        },
                      },
                    }))
                  }
                  placeholder="Password or {{password}}"
                  inputClassName="h-8"
                />
              </div>
            </div>
          )}

          {req.auth.type === 'apiKey' && (
            <div className="space-y-2 max-w-md pt-2">
              <div className="space-y-1">
                <span className="text-xs font-medium">Key Name</span>
                <VariableInput
                  value={req.auth.apiKey?.key || ''}
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      auth: {
                        ...prev.auth,
                        apiKey: {
                          key: val,
                          value: prev.auth.apiKey?.value || '',
                          addTo: prev.auth.apiKey?.addTo || 'header',
                        },
                      },
                    }))
                  }
                  placeholder="e.g. X-API-Key or {{keyName}}"
                  inputClassName="h-8"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium">Value</span>
                <VariableInput
                  value={req.auth.apiKey?.value || ''}
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      auth: {
                        ...prev.auth,
                        apiKey: {
                          key: prev.auth.apiKey?.key || '',
                          value: val,
                          addTo: prev.auth.apiKey?.addTo || 'header',
                        },
                      },
                    }))
                  }
                  placeholder="API Key value or {{apiKey}}"
                  inputClassName="h-8"
                />
              </div>
            </div>
          )}

          {req.auth.type === 'none' && (
            <p className="text-xs text-muted-foreground/60 italic pt-4">
              This request will not send any authentication credentials.
            </p>
          )}
        </TabsContent>

        {/* Scripts Tab Content (Pre-request & Tests) */}
        <TabsContent value="scripts" className="flex-1 flex flex-col p-3 overflow-hidden m-0 gap-2">
          {/* Top Subtab Switcher */}
          <div className="flex items-center justify-between pb-1 shrink-0">
            <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-md border border-border/50">
              <button
                type="button"
                onClick={() => setActiveScriptTab('preRequest')}
                className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                  activeScriptTab === 'preRequest'
                    ? 'bg-background text-[#0275E2] font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Pre-request Script</span>
                {Boolean(req.scripts?.preRequest?.trim()) && (
                  <span className="size-1.5 rounded-full bg-[#0275E2]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveScriptTab('test')}
                className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                  activeScriptTab === 'test'
                    ? 'bg-background text-[#0275E2] font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Tests (Post-response)</span>
                {Boolean(req.scripts?.test?.trim()) && (
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground font-sans">
              {activeScriptTab === 'preRequest'
                ? 'Executed in sandbox before sending request'
                : 'Executed in sandbox after response arrives'}
            </span>
          </div>

          {/* Body based on active subtab */}
          {activeScriptTab === 'preRequest' ? (
            <div className="flex-1 flex flex-col overflow-hidden gap-2">
              {/* Pre-request script editor is ABOVE */}
              <div className="flex-1 overflow-hidden rounded-md border border-border/70 bg-card/10">
                <CodeEditor
                  value={req.scripts?.preRequest || ''}
                  language="javascript"
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      scripts: { ...prev.scripts, preRequest: val },
                    }))
                  }
                  className="h-full border-none rounded-none"
                />
              </div>

              {/* Options are BELOW the pre-request script */}
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-md border border-border/50 shrink-0 text-xs">
                <span className="text-[11px] font-semibold text-muted-foreground shrink-0 pl-1">
                  Quick Snippets:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const current = req.scripts?.preRequest || '';
                      const snippet = `pm.environment.set("timestamp", Math.floor(Date.now() / 1000));\n`;
                      updateActiveRequest((prev) => ({
                        ...prev,
                        scripts: {
                          ...prev.scripts,
                          preRequest: current ? `${current.trimEnd()}\n${snippet}` : snippet,
                        },
                      }));
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-[#0275E2] hover:border-[#0275E2]/40 bg-card/60"
                  >
                    + Timestamp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const current = req.scripts?.preRequest || '';
                      const snippet = `const val = pm.environment.get("variableName");\n`;
                      updateActiveRequest((prev) => ({
                        ...prev,
                        scripts: {
                          ...prev.scripts,
                          preRequest: current ? `${current.trimEnd()}\n${snippet}` : snippet,
                        },
                      }));
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-[#0275E2] hover:border-[#0275E2]/40 bg-card/60"
                  >
                    + Get Variable
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const current = req.scripts?.preRequest || '';
                      const snippet = `pm.environment.set("variableName", "value");\n`;
                      updateActiveRequest((prev) => ({
                        ...prev,
                        scripts: {
                          ...prev.scripts,
                          preRequest: current ? `${current.trimEnd()}\n${snippet}` : snippet,
                        },
                      }));
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-[#0275E2] hover:border-[#0275E2]/40 bg-card/60"
                  >
                    + Set Variable
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden gap-2">
              {/* Test post response script editor is ABOVE */}
              <div className="flex-1 overflow-hidden rounded-md border border-border/70 bg-card/10">
                <CodeEditor
                  value={req.scripts?.test || ''}
                  language="javascript"
                  onChange={(val) =>
                    updateActiveRequest((prev) => ({
                      ...prev,
                      scripts: { ...prev.scripts, test: val },
                    }))
                  }
                  className="h-full border-none rounded-none"
                />
              </div>

              {/* Its 3 options are BELOW the test post response script */}
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-md border border-border/50 shrink-0 text-xs">
                <span className="text-[11px] font-semibold text-muted-foreground shrink-0 pl-1">
                  Quick Snippets:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const current = req.scripts?.test || '';
                      const snippet = `pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});\n`;
                      updateActiveRequest((prev) => ({
                        ...prev,
                        scripts: {
                          ...prev.scripts,
                          test: current ? `${current.trimEnd()}\n${snippet}` : snippet,
                        },
                      }));
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40 bg-card/60"
                  >
                    + Status 200
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const current = req.scripts?.test || '';
                      const snippet = `pm.test("Response time is less than 500ms", function () {\n  pm.expect(pm.response.responseTime).to.be.below(500);\n});\n`;
                      updateActiveRequest((prev) => ({
                        ...prev,
                        scripts: {
                          ...prev.scripts,
                          test: current ? `${current.trimEnd()}\n${snippet}` : snippet,
                        },
                      }));
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-sky-400 hover:border-sky-500/40 bg-card/60"
                  >
                    + Response &lt; 500ms
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const current = req.scripts?.test || '';
                      const snippet = `pm.test("Response is JSON", function () {\n  const jsonData = pm.response.json();\n  pm.expect(jsonData).to.be.an("object");\n});\n`;
                      updateActiveRequest((prev) => ({
                        ...prev,
                        scripts: {
                          ...prev.scripts,
                          test: current ? `${current.trimEnd()}\n${snippet}` : snippet,
                        },
                      }));
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-amber-400 hover:border-amber-500/40 bg-card/60"
                  >
                    + JSON Check
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      )}

      {/* Code Snippet Modal */}
      <CodeSnippetDialog
        open={codeSnippetOpen}
        onOpenChange={setCodeSnippetOpen}
        request={req}
      />
    </div>
  );
}
