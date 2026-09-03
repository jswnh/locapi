import { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Send,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, WsStreamEvent } from '@/lib/ipc';
import { useEnvStore } from '@/stores/env-store';
import { replaceVariables } from '@/lib/variable-replacer';
import { toast } from 'sonner';

interface WsMessage {
  id: string;
  direction: 'in' | 'out';
  payload: string;
  timestamp: string;
}

interface WsClientProps {
  url: string;
  tabId: string;
}

export function WsClient({ url, tabId }: WsClientProps) {
  const { getActiveEnvironment } = useEnvStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [outgoingText, setOutgoingText] = useState('{"type": "ping", "timestamp": ' + Date.now() + '}');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to WebSocket events from Electron Main process
  useEffect(() => {
    const unsubscribe = api.ws.onEvent((event: WsStreamEvent) => {
      if (event.connectionId !== tabId) return;

      if (event.type === 'open') {
        setConnectionStatus('connected');
        toast.success('WebSocket Connected');
      } else if (event.type === 'message' && event.payload !== undefined) {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            direction: event.direction || 'in',
            payload: event.payload!,
            timestamp: event.timestamp || new Date().toISOString(),
          },
        ]);
      } else if (event.type === 'error') {
        toast.error(event.error || 'WebSocket Error');
      } else if (event.type === 'close') {
        setConnectionStatus('disconnected');
        toast.info(`WebSocket Disconnected: ${event.reason || 'Closed'}`);
      }
    });

    return () => {
      unsubscribe();
      api.ws.disconnect(tabId);
    };
  }, [tabId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = async () => {
    if (!url.trim()) {
      toast.error('Please enter a WebSocket URL');
      return;
    }

    const env = getActiveEnvironment();
    const resolvedUrl = replaceVariables(url.trim(), env ? env.variables : []);

    setConnectionStatus('connecting');
    try {
      await api.ws.connect({
        connectionId: tabId,
        url: resolvedUrl,
      });
    } catch (err: any) {
      setConnectionStatus('disconnected');
      toast.error(err.message || 'Failed to initiate WebSocket');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.ws.disconnect(tabId);
      setConnectionStatus('disconnected');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!outgoingText.trim()) return;
    if (connectionStatus !== 'connected') {
      toast.error('Connect to WebSocket before sending messages');
      return;
    }

    const env = getActiveEnvironment();
    const resolvedMessage = replaceVariables(outgoingText, env ? env.variables : []);

    try {
      await api.ws.send({
        connectionId: tabId,
        message: resolvedMessage,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Message copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        '.' +
        String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* WS Toolbar */}
      <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between bg-muted/20 select-none shrink-0">
        <div className="flex items-center gap-3">
          {/* Connection Status Badge */}
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

          <span className="text-[11px] text-muted-foreground font-mono">
            {messages.length} messages
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
              title="Clear messages"
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Split view: Message Stream on Top, Composer on Bottom */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/50">
          {messages.map((msg) => {
            const isOut = msg.direction === 'out';
            return (
              <div
                key={msg.id}
                className={`flex flex-col p-2.5 rounded-lg border text-xs font-mono transition-colors ${
                  isOut
                    ? 'bg-[#0275E2]/10 border-[#0275E2]/30 ml-8'
                    : 'bg-muted/30 border-border/50 mr-8'
                }`}
              >
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/30 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {isOut ? (
                      <span className="flex items-center gap-1 text-[#0275E2] font-semibold">
                        <ArrowUpRight className="size-3" />
                        SENT
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <ArrowDownLeft className="size-3" />
                        RECEIVED
                      </span>
                    )}
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>

                  <button
                    onClick={() => handleCopyMessage(msg.id, msg.payload)}
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
                  {msg.payload}
                </pre>
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 text-xs py-12">
              <Radio className="size-8 stroke-[1.2] mb-2 opacity-30 text-indigo-400" />
              <p className="font-semibold text-foreground/70">WebSocket Message Stream</p>
              <p className="text-[11px] mt-0.5 max-w-[260px]">
                Click Connect to establish socket stream. Sent and received frames will appear live.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer Bar */}
        <div className="p-3 border-t border-border/70 bg-card/40 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Message Payload</span>
            <span className="text-[10px] font-mono">Press Ctrl+Enter to send</span>
          </div>

          <div className="flex gap-2">
            <Textarea
              rows={3}
              value={outgoingText}
              onChange={(e) => setOutgoingText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Enter message (JSON or text)..."
              className="font-mono text-xs resize-none bg-background border-border/80 focus-visible:ring-[#0275E2]/40"
            />

            <Button
              onClick={handleSend}
              disabled={connectionStatus !== 'connected' || !outgoingText.trim()}
              className="h-auto px-4 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white flex flex-col items-center justify-center gap-1"
            >
              <Send className="size-4 fill-white" />
              <span className="text-[10px]">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
