import { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Send,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  Power,
  PowerOff,
  Loader2,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api, SocketIoStreamEvent } from '@/lib/ipc';
import { useEnvStore } from '@/stores/env-store';
import { replaceVariables } from '@/lib/variable-replacer';
import { toast } from 'sonner';

interface SocketIoMessage {
  id: string;
  direction: 'in' | 'out';
  eventName: string;
  payload: any;
  timestamp: string;
}

interface SocketIoClientProps {
  url: string;
  tabId: string;
}

export function SocketIoClient({ url, tabId }: SocketIoClientProps) {
  const { getActiveEnvironment } = useEnvStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [socketId, setSocketId] = useState<string>('');
  const [messages, setMessages] = useState<SocketIoMessage[]>([]);
  const [eventName, setEventName] = useState('message');
  const [payloadText, setPayloadText] = useState('{\n  "hello": "world"\n}');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = api.socketio.onEvent((event: SocketIoStreamEvent) => {
      if (event.connectionId !== tabId) return;

      if (event.type === 'connect') {
        setConnectionStatus('connected');
        setSocketId(event.payload?.socketId || '');
        toast.success(`Socket.IO Connected (ID: ${event.payload?.socketId || 'active'})`);
      } else if (event.type === 'disconnect') {
        setConnectionStatus('disconnected');
        setSocketId('');
        toast.info('Socket.IO Disconnected');
      } else if (event.type === 'error') {
        setConnectionStatus('disconnected');
        toast.error(event.error || 'Socket.IO connection error');
      } else if (event.type === 'event' || event.type === 'emitted') {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            direction: event.direction || (event.type === 'emitted' ? 'out' : 'in'),
            eventName: event.eventName || 'message',
            payload: event.payload,
            timestamp: event.timestamp || new Date().toISOString(),
          },
        ]);
      }
    });

    return () => {
      unsubscribe();
      api.socketio.disconnect(tabId);
    };
  }, [tabId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = async () => {
    if (!url.trim()) {
      toast.error('Please enter a Socket.IO Server URL');
      return;
    }

    const env = getActiveEnvironment();
    const resolvedUrl = replaceVariables(url.trim(), env ? env.variables : []);

    setConnectionStatus('connecting');
    try {
      await api.socketio.connect({
        connectionId: tabId,
        url: resolvedUrl,
      });
    } catch (err: any) {
      setConnectionStatus('disconnected');
      toast.error(err.message || 'Failed to initiate Socket.IO connection');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.socketio.disconnect(tabId);
      setConnectionStatus('disconnected');
      setSocketId('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleEmit = async () => {
    if (!eventName.trim()) {
      toast.error('Please provide an event name');
      return;
    }
    if (connectionStatus !== 'connected') {
      toast.error('Connect to Socket.IO server before emitting events');
      return;
    }

    const env = getActiveEnvironment();
    const resolvedPayload = replaceVariables(payloadText, env ? env.variables : []);

    let parsedData: any = resolvedPayload;
    try {
      parsedData = JSON.parse(resolvedPayload);
    } catch {
      parsedData = resolvedPayload;
    }

    try {
      await api.socketio.emit({
        connectionId: tabId,
        eventName: eventName.trim(),
        data: parsedData,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to emit event');
    }
  };

  const handleCopy = (id: string, data: any) => {
    const text = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return (
        d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        '.' +
        String(d.getMilliseconds()).padStart(3, '0')
      );
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Socket.IO Toolbar */}
      <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between bg-muted/20 select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span
              className={`size-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-500 animate-spin'
                  : 'bg-zinc-500'
              }`}
            />
            <span
              className={`font-semibold capitalize ${
                connectionStatus === 'connected'
                  ? 'text-emerald-400'
                  : connectionStatus === 'connecting'
                  ? 'text-amber-400'
                  : 'text-muted-foreground'
              }`}
            >
              {connectionStatus}
            </span>
          </div>

          {socketId && (
            <span className="text-[10px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
              id: {socketId}
            </span>
          )}

          <span className="text-[11px] text-muted-foreground font-mono">
            {messages.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Button
              size="xs"
              variant="outline"
              onClick={handleDisconnect}
              className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
            >
              <PowerOff className="size-3" />
              Disconnect
            </Button>
          ) : (
            <Button
              size="xs"
              onClick={handleConnect}
              disabled={connectionStatus === 'connecting' || !url.trim()}
              className="h-7 text-xs bg-[#0275E2] hover:bg-[#0275E2]/90 text-white gap-1.5"
            >
              {connectionStatus === 'connecting' ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Power className="size-3" />
              )}
              Connect
            </Button>
          )}

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setMessages([])}
              className="h-7 px-2 text-muted-foreground hover:text-destructive"
              title="Clear event log"
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Split: Event Stream & Emitter Composer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Event Log */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/50">
          {messages.map((msg) => {
            const isOut = msg.direction === 'out';
            return (
              <div
                key={msg.id}
                className={`flex flex-col p-2.5 rounded-lg border text-xs font-mono transition-colors ${
                  isOut
                    ? 'bg-[#0275E2]/10 border-[#0275E2]/30 ml-6'
                    : 'bg-muted/30 border-border/50 mr-6'
                }`}
              >
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/30 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {isOut ? (
                      <span className="flex items-center gap-1 text-[#0275E2] font-semibold">
                        <ArrowUpRight className="size-3" />
                        EMIT
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <ArrowDownLeft className="size-3" />
                        EVENT
                      </span>
                    )}
                    <span className="px-1.5 py-0.2 rounded bg-background border border-border/60 text-foreground font-bold">
                      {msg.eventName}
                    </span>
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>

                  <button
                    onClick={() => handleCopy(msg.id, msg.payload)}
                    className="hover:text-foreground p-0.5"
                  >
                    {copiedId === msg.id ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>

                <pre className="whitespace-pre-wrap leading-relaxed select-text text-foreground">
                  {typeof msg.payload === 'object'
                    ? JSON.stringify(msg.payload, null, 2)
                    : String(msg.payload)}
                </pre>
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 text-xs py-12">
              <Zap className="size-8 stroke-[1.2] mb-2 opacity-30 text-amber-400" />
              <p className="font-semibold text-foreground/70">Socket.IO Event Stream</p>
              <p className="text-[11px] mt-0.5 max-w-[260px]">
                Connect to inspect live bidirectional events, or emit custom events below.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Emitter Composer */}
        <div className="p-3 border-t border-border/70 bg-card/40 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 w-48 shrink-0">
              <Tag className="size-3 text-[#0275E2]" />
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Event Name (e.g. chat)"
                className="h-7 text-xs font-mono bg-background"
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Press Ctrl+Enter to emit
            </span>
          </div>

          <div className="flex gap-2">
            <Textarea
              rows={3}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleEmit();
                }
              }}
              placeholder="JSON or string payload..."
              className="font-mono text-xs resize-none bg-background border-border/80 focus-visible:ring-[#0275E2]/40"
            />

            <Button
              onClick={handleEmit}
              disabled={connectionStatus !== 'connected' || !eventName.trim()}
              className="h-auto px-4 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white flex flex-col items-center justify-center gap-1"
            >
              <Send className="size-4 fill-white" />
              <span className="text-[10px]">Emit</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
