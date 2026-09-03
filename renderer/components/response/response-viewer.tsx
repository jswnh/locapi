import { useState } from 'react';
import {
  Copy,
  Check,
  Terminal,
  Clock,
  HardDrive,
  AlertCircle,
  Cookie as CookieIcon,
  Lock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Radio,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCookieStore } from '@/stores/cookie-store';
import { useSettingsStore } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CodeEditor } from '@/components/editor/code-editor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function getDetectedLanguage(headers?: Record<string, string>, bodyStr: string = ''): string {
  if (headers) {
    const ct = Object.entries(headers).find(
      ([k]) => k.toLowerCase() === 'content-type'
    )?.[1] || '';
    if (ct.includes('json')) return 'json';
    if (ct.includes('xml')) return 'xml';
    if (ct.includes('html')) return 'html';
    if (ct.includes('javascript')) return 'javascript';
  }
  if (bodyStr.trim().startsWith('{') || bodyStr.trim().startsWith('[')) return 'json';
  if (bodyStr.trim().startsWith('<')) return 'xml';
  return 'plaintext';
}

export function ResponseViewer() {
  const { tabs, activeTabId } = useWorkspaceStore();
  const { openCookieModal } = useCookieStore();
  const disableCookies = useSettingsStore((s) => s.settings.disableCookies);
  const enableScripts = useSettingsStore((s) => s.settings.enableScripts ?? true);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [copied, setCopied] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState<'body' | 'headers' | 'cookies' | 'raw' | 'tests'>('body');

  if (activeTab?.request?.protocol && ['WS', 'SOCKETIO', 'MQTT'].includes(activeTab.request.protocol)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground select-none bg-background/50 h-full">
        <Radio className="size-10 stroke-[1.2] mb-3 opacity-20 text-[#0275E2] animate-pulse" />
        <p className="text-xs font-semibold text-foreground/70">{activeTab.request.protocol} Stream Active</p>
        <p className="text-[11px] text-muted-foreground/60 max-w-[260px] mt-1">
          Real-time events and streaming messages are monitored in the live client log on the left.
        </p>
      </div>
    );
  }

  if (activeTab?.request?.protocol === 'GRPC' && !activeTab.response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground select-none bg-background/50 h-full">
        <Terminal className="size-10 stroke-[1.2] mb-3 opacity-20 text-[#0275E2]" />
        <p className="text-xs font-semibold text-foreground/70">gRPC Response will appear here</p>
        <p className="text-[11px] text-muted-foreground/60 max-w-[240px] mt-1">
          Load a .proto file and click Invoke RPC to inspect the response.
        </p>
      </div>
    );
  }

  if (!activeTab || !activeTab.response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground select-none bg-background/50 h-full">
        <Terminal className="size-10 stroke-[1.2] mb-3 opacity-20 text-[#0275E2]" />
        <p className="text-xs font-semibold text-foreground/70">Response will appear here</p>
        <p className="text-[11px] text-muted-foreground/60 max-w-[240px] mt-1">
          Click Send or press <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px]">Ctrl+Enter</code> to execute the request.
        </p>
      </div>
    );
  }

  const { response } = activeTab;
  const cookiesList = response.cookies || [];
  const testResults = response.testResults || [];
  const scriptLogs = response.scriptLogs || [];
  const passedCount = testResults.filter((t) => t.passed).length;
  const totalTests = testResults.length;
  const allPassed = totalTests > 0 && passedCount === totalTests;

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    if (status >= 200 && status < 300)
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status >= 300 && status < 400)
      return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    if (status >= 400 && status < 500)
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const formattedBody = () => {
    if (response.body === undefined || response.body === null) return '';
    if (typeof response.body === 'string') return response.body;
    try {
      return JSON.stringify(response.body, null, 2);
    } catch {
      return String(response.body);
    }
  };

  const detectedLanguage = getDetectedLanguage(response.headers, formattedBody());

  const handleCopy = () => {
    const text = formattedBody();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes && bytes !== 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Response Header & Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/70 bg-muted/15 select-none shrink-0">
        {/* Status Code */}
        <div className="flex items-center gap-3">
          {response.status ? (
            <span
              className={cn(
                'text-xs font-mono font-bold px-2 py-0.5 rounded border',
                getStatusColor(response.status)
              )}
            >
              {response.status} {response.statusText}
            </span>
          ) : response.error ? (
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded border text-destructive bg-destructive/10 border-destructive/30 flex items-center gap-1.5">
              <AlertCircle className="size-3" />
              {response.error}
            </span>
          ) : null}

          {/* Time & Size metrics */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            {response.durationMs !== undefined && (
              <div className="flex items-center gap-1">
                <Clock className="size-3 text-muted-foreground/70" />
                <span className="text-foreground/80 font-medium">{response.durationMs} ms</span>
              </div>
            )}
            {response.sizeBytes !== undefined && (
              <div className="flex items-center gap-1">
                <HardDrive className="size-3 text-muted-foreground/70" />
                <span>{formatSize(response.sizeBytes)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons: Cookie Jar + Copy */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => openCookieModal()}
            className="h-6 px-2 text-[11px] gap-1 border-border/80 hover:border-[#0275E2]/50 hover:text-[#0275E2]"
            title="Open Cookie Jar"
          >
            <CookieIcon className="size-3 text-[#0275E2]" />
            <span>Cookies</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={handleCopy}
            className="h-6 px-2 text-[11px] gap-1 border-border/80 hover:border-[#0275E2]/50 hover:text-[#0275E2]"
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </div>

      {/* Response Sub-tabs: Body, Headers, Cookies, Raw */}
      <Tabs
        value={activeTabSub}
        onValueChange={(v: any) => setActiveTabSub(v)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 border-b border-border/50 bg-muted/10 shrink-0">
          <TabsList className="h-8 bg-transparent p-0 gap-1">
            <TabsTrigger
              value="body"
              className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
            >
              Response Body
            </TabsTrigger>
            <TabsTrigger
              value="headers"
              className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
            >
              Headers {response.headers && `(${Object.keys(response.headers).length})`}
            </TabsTrigger>
            <TabsTrigger
              value="cookies"
              className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm gap-1.5"
            >
              <span>Cookies</span>
              {disableCookies ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-amber-500/15 text-amber-500 border border-amber-500/30 uppercase">
                  Disabled
                </span>
              ) : (
                cookiesList.length > 0 && <span>({cookiesList.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm"
            >
              Raw
            </TabsTrigger>
            {enableScripts && (
              <TabsTrigger
                value="tests"
                className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:text-[#0275E2] data-[state=active]:shadow-xs rounded-sm gap-1.5"
              >
                <span>Test Results</span>
                {totalTests > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold',
                      allPassed
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                    )}
                  >
                    {passedCount}/{totalTests}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Formatted Body via Monaco */}
        <TabsContent value="body" className="flex-1 p-2 overflow-hidden m-0">
          <CodeEditor
            value={formattedBody()}
            readOnly={true}
            language={detectedLanguage}
            className="border-none rounded-none"
          />
        </TabsContent>

        {/* Headers Table */}
        <TabsContent value="headers" className="flex-1 p-3 overflow-y-auto m-0 space-y-1">
          {response.headers &&
            Object.entries(response.headers).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between py-1 px-2 border-b border-border/30 text-xs font-mono"
              >
                <span className="font-semibold text-foreground/80">{key}:</span>
                <span className="text-muted-foreground select-text">{val}</span>
              </div>
            ))}
        </TabsContent>

        {/* Cookies Table */}
        <TabsContent value="cookies" className="flex-1 p-3 overflow-y-auto m-0 space-y-2">
          {cookiesList.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/40">
                <span>{cookiesList.length} cookie(s) received from response and stored in jar:</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => openCookieModal()}
                  className="h-6 text-[10px] text-[#0275E2] gap-1"
                >
                  <CookieIcon className="size-2.5" />
                  Manage All Cookies
                </Button>
              </div>

              {cookiesList.map((c) => (
                <div
                  key={c.id || c.name}
                  className="p-2 rounded-lg border border-border/70 bg-card/40 font-mono text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">{c.domain}</span>
                      {c.http_only && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[9px] border border-amber-500/20">
                          <Lock className="size-2.5" />
                          HttpOnly
                        </span>
                      )}
                      {c.secure && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/20">
                          <ShieldCheck className="size-2.5" />
                          Secure
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.value);
                        toast.success(`Copied ${c.name}`);
                      }}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                      title="Copy value"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>

                  <div className="text-[11px] text-foreground/90 break-all select-text bg-background/50 p-1.5 rounded border border-border/40">
                    {c.value}
                  </div>

                  {c.expires && (
                    <div className="text-[10px] text-muted-foreground">
                      Expires: {new Date(c.expires).toUTCString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 py-12 text-xs">
              <CookieIcon className={`size-8 stroke-[1.2] mb-2 opacity-30 ${disableCookies ? 'text-amber-500' : 'text-[#0275E2]'}`} />
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="font-semibold text-foreground/70">
                  {disableCookies ? 'Cookie Store is Disabled' : 'No Cookies in this Response'}
                </p>
                {disableCookies && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight bg-amber-500/15 text-amber-500 border border-amber-500/30 uppercase">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-0.5 max-w-[280px]">
                {disableCookies
                  ? 'Cookies are currently disabled in Settings. Locapi does not capture or save Set-Cookie headers while disabled.'
                  : 'This response did not send any Set-Cookie headers.'}
              </p>
              <Button
                variant="outline"
                size="xs"
                onClick={() => openCookieModal()}
                className="mt-3 h-7 text-xs gap-1.5"
              >
                <CookieIcon className="size-3 text-[#0275E2]" />
                View Stored Cookies
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Raw View via Monaco */}
        <TabsContent value="raw" className="flex-1 p-2 overflow-hidden m-0">
          <CodeEditor
            value={formattedBody()}
            readOnly={true}
            language="plaintext"
            className="border-none rounded-none"
          />
        </TabsContent>

        {/* Test Results View */}
        <TabsContent value="tests" className="flex-1 p-3 overflow-y-auto m-0 space-y-3">
          {totalTests > 0 ? (
            <div className="space-y-3">
              {/* Summary card */}
              <div
                className={cn(
                  'p-3 rounded-lg border flex items-center justify-between',
                  allPassed
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                )}
              >
                <div className="flex items-center gap-2">
                  <FlaskConical className="size-4" />
                  <span className="font-semibold text-xs">
                    {allPassed ? 'All Tests Passed' : `${totalTests - passedCount} of ${totalTests} Tests Failed`}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold">
                  {passedCount} / {totalTests} Passed
                </span>
              </div>

              {/* Individual Tests */}
              <div className="space-y-1.5">
                {testResults.map((test) => (
                  <div
                    key={test.id}
                    className="p-2.5 rounded-md border border-border/60 bg-card/40 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {test.passed ? (
                          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="size-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-medium text-foreground">{test.name}</span>
                      </div>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-tight uppercase',
                          test.passed
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                        )}
                      >
                        {test.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    {test.error && (
                      <div className="pl-6 text-[11px] font-mono text-rose-400 bg-rose-500/5 p-1.5 rounded border border-rose-500/20">
                        {test.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Script Console Logs */}
              {scriptLogs.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Console Logs ({scriptLogs.length})
                  </span>
                  <div className="p-2 rounded bg-black/40 border border-border font-mono text-[11px] text-foreground/80 max-h-40 overflow-y-auto space-y-0.5">
                    {scriptLogs.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap leading-relaxed">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 py-12 text-xs">
              <FlaskConical className="size-8 stroke-[1.2] mb-2 opacity-30 text-[#0275E2]" />
              <p className="font-semibold text-foreground/70">No Tests Run</p>
              <p className="text-[11px] mt-0.5 max-w-[280px]">
                Add test assertions in the request&apos;s &quot;Scripts &amp; Tests&quot; tab to validate response status, data, and latency.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
