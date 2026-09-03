import { useState } from 'react';
import {
  Layers,
  Send,
  Loader2,
  FileCode2,
  Lock,
  Copy,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/ipc';
import { useEnvStore } from '@/stores/env-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { replaceVariables } from '@/lib/variable-replacer';
import { toast } from 'sonner';

interface GrpcClientProps {
  url: string;
  tabId: string;
}

interface ProtoServiceDef {
  serviceName: string;
  methods: Array<{
    name: string;
    requestType: string;
    responseType: string;
  }>;
}

export function GrpcClient({ url, tabId }: GrpcClientProps) {
  const { getActiveEnvironment } = useEnvStore();
  const { setTabResponse } = useWorkspaceStore();

  const [protoPath, setProtoPath] = useState('');
  const [services, setServices] = useState<ProtoServiceDef[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [useTls, setUseTls] = useState(false);
  const [metadataRows, setMetadataRows] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [requestJson, setRequestJson] = useState('{\n  "name": "World"\n}');

  const [isLoadingProto, setIsLoadingProto] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [grpcResponse, setGrpcResponse] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleLoadProto = async () => {
    if (!protoPath.trim()) {
      toast.error('Please enter the full path to your .proto file');
      return;
    }

    setIsLoadingProto(true);
    try {
      const parsedServices = await api.grpc.loadProto(protoPath.trim());
      if (!parsedServices || parsedServices.length === 0) {
        toast.error('No gRPC services found in proto file');
        setServices([]);
        return;
      }

      setServices(parsedServices);
      setSelectedService(parsedServices[0].serviceName);
      if (parsedServices[0].methods.length > 0) {
        setSelectedMethod(parsedServices[0].methods[0].name);
      }
      toast.success(`Loaded ${parsedServices.length} service(s) from proto`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to parse .proto file');
    } finally {
      setIsLoadingProto(false);
    }
  };

  const handleExecute = async () => {
    if (!url.trim()) {
      toast.error('Please enter gRPC server endpoint (e.g. localhost:50051)');
      return;
    }
    if (!protoPath.trim()) {
      toast.error('Please load a .proto file first');
      return;
    }
    if (!selectedService || !selectedMethod) {
      toast.error('Please select a service and method');
      return;
    }

    const env = getActiveEnvironment();
    const resolvedUrl = replaceVariables(url.trim(), env ? env.variables : []);
    const resolvedPayloadStr = replaceVariables(requestJson, env ? env.variables : []);

    let parsedPayload: any = {};
    try {
      if (resolvedPayloadStr.trim()) {
        parsedPayload = JSON.parse(resolvedPayloadStr);
      }
    } catch (err: any) {
      toast.error(`Invalid JSON payload: ${err.message}`);
      return;
    }

    const metadata: Record<string, string> = {};
    for (const row of metadataRows) {
      if (row.key.trim()) {
        metadata[row.key.trim()] = replaceVariables(row.value, env ? env.variables : []);
      }
    }

    setIsCalling(true);
    setGrpcResponse(null);

    try {
      const result = await api.grpc.execute({
        endpoint: resolvedUrl,
        protoPath: protoPath.trim(),
        serviceName: selectedService,
        methodName: selectedMethod,
        payload: parsedPayload,
        metadata,
        useTls,
      });

      setGrpcResponse(result);
      if (tabId) {
        setTabResponse(tabId, {
          status: result.status,
          statusText: result.statusText,
          durationMs: result.durationMs,
          sizeBytes: Buffer.byteLength(JSON.stringify(result.response || ''), 'utf-8'),
          body: result.response,
          headers: result.metadata || {},
          contentType: 'application/grpc',
          error: result.error,
        });
      }

      if (result.status === 0) {
        toast.success(`gRPC ${selectedMethod}: 0 OK (${result.durationMs}ms)`);
      } else {
        toast.error(`gRPC Error ${result.status}: ${result.statusText}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'RPC invocation failed');
      const errPayload = {
        status: 2,
        statusText: 'UNKNOWN',
        response: null,
        durationMs: 0,
        error: err.message,
      };
      setGrpcResponse(errPayload);
      if (tabId) {
        setTabResponse(tabId, {
          status: 2,
          statusText: 'UNKNOWN',
          durationMs: 0,
          sizeBytes: 0,
          body: null,
          headers: {},
          contentType: 'application/grpc',
          error: err.message,
        });
      }
    } finally {
      setIsCalling(false);
    }
  };

  const currentServiceDef = services.find((s) => s.serviceName === selectedService);

  const handleCopyResponse = () => {
    if (!grpcResponse) return;
    navigator.clipboard.writeText(JSON.stringify(grpcResponse.response, null, 2));
    setCopied(true);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Top Toolbar: Proto Loader & Method Selector */}
      <div className="p-3 border-b border-border/70 bg-muted/20 space-y-2.5 shrink-0">
        {/* Proto File Path */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <FileCode2 className="size-4 text-[#0275E2] shrink-0" />
            <Input
              value={protoPath}
              onChange={(e) => setProtoPath(e.target.value)}
              placeholder="Absolute path to .proto file (e.g. C:/protos/service.proto)"
              className="h-7 text-xs font-mono bg-background"
            />
          </div>

          <Button
            size="xs"
            onClick={handleLoadProto}
            disabled={isLoadingProto || !protoPath.trim()}
            className="h-7 text-xs bg-[#0275E2] hover:bg-[#0275E2]/90 text-white gap-1.5"
          >
            {isLoadingProto ? <Loader2 className="size-3 animate-spin" /> : <Layers className="size-3" />}
            Load Proto
          </Button>
        </div>

        {/* Service, Method & TLS Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Service Selector */}
          <div className="flex items-center gap-1.5 min-w-[200px] flex-1">
            <span className="text-[11px] text-muted-foreground font-mono">Service:</span>
            <Select
              value={selectedService}
              onValueChange={(val) => {
                setSelectedService(val);
                const s = services.find((srv) => srv.serviceName === val);
                if (s && s.methods.length > 0) {
                  setSelectedMethod(s.methods[0].name);
                }
              }}
              disabled={services.length === 0}
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue placeholder="Select Service..." />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.serviceName} value={s.serviceName} className="text-xs font-mono">
                    {s.serviceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Method Selector */}
          <div className="flex items-center gap-1.5 min-w-[180px] flex-1">
            <span className="text-[11px] text-muted-foreground font-mono">Method:</span>
            <Select
              value={selectedMethod}
              onValueChange={setSelectedMethod}
              disabled={!currentServiceDef || currentServiceDef.methods.length === 0}
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue placeholder="Select Method..." />
              </SelectTrigger>
              <SelectContent>
                {currentServiceDef?.methods.map((m) => (
                  <SelectItem key={m.name} value={m.name} className="text-xs font-mono">
                    {m.name} ({m.requestType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* TLS Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={useTls}
              onChange={(e) => setUseTls(e.target.checked)}
              className="rounded border-border accent-[#0275E2]"
            />
            <Lock className="size-3" />
            <span>TLS</span>
          </label>

          {/* Invoke Button */}
          <Button
            size="xs"
            onClick={handleExecute}
            disabled={isCalling || !selectedService || !selectedMethod}
            className="h-7 px-4 text-xs bg-[#0275E2] hover:bg-[#0275E2]/90 text-white gap-1.5 ml-auto"
          >
            {isCalling ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
            Invoke RPC
          </Button>
        </div>
      </div>

      {/* Main Split: Request Message & Response Viewer */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-border/70 overflow-hidden">
        {/* Left: Request Payload & Metadata */}
        <div className="flex flex-col h-full overflow-hidden p-3 space-y-3 bg-background">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground/80">Request Message (JSON)</span>
            <span className="text-[10px] text-muted-foreground font-mono">Ctrl+Enter to invoke</span>
          </div>

          <Textarea
            rows={10}
            value={requestJson}
            onChange={(e) => setRequestJson(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleExecute();
              }
            }}
            placeholder="{\n  &quot;field&quot;: &quot;value&quot;\n}"
            className="font-mono text-xs flex-1 resize-none bg-card/30 border-border/80 focus-visible:ring-[#0275E2]/40"
          />

          {/* gRPC Metadata */}
          <div className="space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">gRPC Metadata (Headers)</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  setMetadataRows((prev) => [...prev, { id: Math.random().toString(), key: '', value: '' }])
                }
                className="h-6 text-[10px] gap-1 text-[#0275E2]"
              >
                <Plus className="size-2.5" />
                Add Metadata
              </Button>
            </div>

            {metadataRows.map((row, idx) => (
              <div key={row.id} className="flex items-center gap-1.5">
                <Input
                  value={row.key}
                  onChange={(e) => {
                    const updated = [...metadataRows];
                    updated[idx].key = e.target.value;
                    setMetadataRows(updated);
                  }}
                  placeholder="authorization"
                  className="h-6 text-xs font-mono bg-background flex-1"
                />
                <Input
                  value={row.value}
                  onChange={(e) => {
                    const updated = [...metadataRows];
                    updated[idx].value = e.target.value;
                    setMetadataRows(updated);
                  }}
                  placeholder="Bearer token"
                  className="h-6 text-xs font-mono bg-background flex-1"
                />
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setMetadataRows((prev) => prev.filter((_, i) => i !== idx))}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Response Viewer */}
        <div className="flex flex-col h-full overflow-hidden p-3 bg-muted/10 space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground/80">Response</span>
              {grpcResponse && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    grpcResponse.status === 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}
                >
                  Status {grpcResponse.status}: {grpcResponse.statusText}
                </span>
              )}
            </div>

            {grpcResponse && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {grpcResponse.durationMs}ms
                </span>
                <button onClick={handleCopyResponse} className="hover:text-foreground">
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-background rounded-md border border-border/60 p-3 font-mono text-xs">
            {grpcResponse ? (
              grpcResponse.error ? (
                <div className="text-destructive whitespace-pre-wrap">
                  {grpcResponse.error}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap leading-relaxed select-text text-foreground">
                  {JSON.stringify(grpcResponse.response, null, 2)}
                </pre>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 text-xs">
                <Layers className="size-8 stroke-[1.2] mb-2 opacity-30 text-[#0275E2]" />
                <p className="font-semibold text-foreground/70">No gRPC Response</p>
                <p className="text-[11px] mt-0.5 max-w-[220px]">
                  Load a .proto file and click Invoke RPC to inspect response.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
