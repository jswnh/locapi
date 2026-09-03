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
  Plus,
  X,
  Share2,
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
import { api, MqttStreamEvent } from '@/lib/ipc';
import { useEnvStore } from '@/stores/env-store';
import { replaceVariables } from '@/lib/variable-replacer';
import { toast } from 'sonner';

interface MqttMessage {
  id: string;
  direction: 'in' | 'out';
  topic: string;
  payload: string;
  qos?: number;
  retain?: boolean;
  timestamp: string;
}

interface MqttClientProps {
  url: string;
  tabId: string;
}

export function MqttClient({ url, tabId }: MqttClientProps) {
  const { getActiveEnvironment } = useEnvStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [subTopic, setSubTopic] = useState('#');
  const [subQos, setSubQos] = useState<'0' | '1' | '2'>('0');

  const [pubTopic, setPubTopic] = useState('sensors/temp');
  const [pubPayload, setPubPayload] = useState('{\n  "temperature": 24.5,\n  "unit": "celsius"\n}');
  const [pubQos, setPubQos] = useState<'0' | '1' | '2'>('0');
  const [pubRetain, setPubRetain] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = api.mqtt.onEvent((event: MqttStreamEvent) => {
      if (event.connectionId !== tabId) return;

      if (event.type === 'connect') {
        setConnectionStatus('connected');
        toast.success('Connected to MQTT Broker');
      } else if (event.type === 'disconnect') {
        setConnectionStatus('disconnected');
        setSubscriptions([]);
        toast.info('Disconnected from MQTT Broker');
      } else if (event.type === 'error') {
        setConnectionStatus('disconnected');
        toast.error(event.error || 'MQTT broker error');
      } else if (event.type === 'subscribed') {
        if (event.topic && !subscriptions.includes(event.topic)) {
          setSubscriptions((prev) => [...prev, event.topic!]);
        }
        toast.success(`Subscribed to "${event.topic}"`);
      } else if (event.type === 'message' || event.type === 'published') {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            direction: event.direction || (event.type === 'published' ? 'out' : 'in'),
            topic: event.topic || 'unknown',
            payload: event.payload || '',
            qos: event.qos,
            retain: event.retain,
            timestamp: event.timestamp || new Date().toISOString(),
          },
        ]);
      }
    });

    return () => {
      unsubscribe();
      api.mqtt.disconnect(tabId);
    };
  }, [tabId, subscriptions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = async () => {
    if (!url.trim()) {
      toast.error('Please enter an MQTT Broker URL (e.g. mqtt://broker.hivemq.com:1883)');
      return;
    }

    const env = getActiveEnvironment();
    const resolvedUrl = replaceVariables(url.trim(), env ? env.variables : []);

    setConnectionStatus('connecting');
    try {
      await api.mqtt.connect({
        connectionId: tabId,
        brokerUrl: resolvedUrl,
      });
    } catch (err: any) {
      setConnectionStatus('disconnected');
      toast.error(err.message || 'Failed to connect to broker');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.mqtt.disconnect(tabId);
      setConnectionStatus('disconnected');
      setSubscriptions([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubscribe = async () => {
    if (!subTopic.trim()) return;
    if (connectionStatus !== 'connected') {
      toast.error('Connect to broker before subscribing');
      return;
    }

    try {
      await api.mqtt.subscribe({
        connectionId: tabId,
        topic: subTopic.trim(),
        qos: Number(subQos) as 0 | 1 | 2,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to subscribe');
    }
  };

  const handleUnsubscribe = async (topic: string) => {
    try {
      await api.mqtt.unsubscribe({ connectionId: tabId, topic });
      setSubscriptions((prev) => prev.filter((t) => t !== topic));
      toast.info(`Unsubscribed from "${topic}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to unsubscribe');
    }
  };

  const handlePublish = async () => {
    if (!pubTopic.trim()) {
      toast.error('Please enter a topic to publish to');
      return;
    }
    if (connectionStatus !== 'connected') {
      toast.error('Connect to broker before publishing');
      return;
    }

    const env = getActiveEnvironment();
    const resolvedPayload = replaceVariables(pubPayload, env ? env.variables : []);

    try {
      await api.mqtt.publish({
        connectionId: tabId,
        topic: pubTopic.trim(),
        message: resolvedPayload,
        options: {
          qos: Number(pubQos) as 0 | 1 | 2,
          retain: pubRetain,
        },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish');
    }
  };

  const handleCopy = (id: string, text: string) => {
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
      {/* MQTT Status Toolbar */}
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

          <span className="text-[11px] text-muted-foreground font-mono">
            {subscriptions.length} subscriptions • {messages.length} messages
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

      {/* Subscription Bar */}
      <div className="px-3 py-2 border-b border-border/70 bg-card/20 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Share2 className="size-3 text-[#0275E2]" />
          <Input
            value={subTopic}
            onChange={(e) => setSubTopic(e.target.value)}
            placeholder="Subscribe topic (e.g. sensor/#)"
            className="h-7 text-xs font-mono bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">QoS:</span>
          <Select value={subQos} onValueChange={(v: any) => setSubQos(v)}>
            <SelectTrigger className="h-7 w-16 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0" className="text-xs">0</SelectItem>
              <SelectItem value="1" className="text-xs">1</SelectItem>
              <SelectItem value="2" className="text-xs">2</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="xs"
            variant="outline"
            onClick={handleSubscribe}
            disabled={connectionStatus !== 'connected' || !subTopic.trim()}
            className="h-7 text-xs gap-1 border-border/80 hover:border-[#0275E2]"
          >
            <Plus className="size-3 text-[#0275E2]" />
            Subscribe
          </Button>
        </div>

        {/* Active Subscriptions Pills */}
        {subscriptions.length > 0 && (
          <div className="flex items-center gap-1.5 w-full pt-1">
            <span className="text-[10px] text-muted-foreground">Active:</span>
            <div className="flex flex-wrap gap-1">
              {subscriptions.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0275E2]/10 border border-[#0275E2]/30 text-[10px] text-[#0275E2] font-mono"
                >
                  {t}
                  <button
                    onClick={() => handleUnsubscribe(t)}
                    className="hover:text-destructive"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Split: Pub/Sub Feed & Publisher Composer */}
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
                    ? 'bg-[#0275E2]/10 border-[#0275E2]/30 ml-6'
                    : 'bg-muted/30 border-border/50 mr-6'
                }`}
              >
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/30 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {isOut ? (
                      <span className="flex items-center gap-1 text-[#0275E2] font-semibold">
                        <ArrowUpRight className="size-3" />
                        PUB
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <ArrowDownLeft className="size-3" />
                        SUB
                      </span>
                    )}

                    <span className="px-1.5 py-0.2 rounded bg-background border border-border/60 text-foreground font-bold">
                      {msg.topic}
                    </span>

                    {msg.qos !== undefined && (
                      <span className="px-1 py-0.2 rounded bg-muted/50 text-muted-foreground text-[9px]">
                        QoS {msg.qos}
                      </span>
                    )}

                    {msg.retain && (
                      <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px]">
                        Retain
                      </span>
                    )}

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
                  {msg.payload}
                </pre>
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 text-xs py-12">
              <Radio className="size-8 stroke-[1.2] mb-2 opacity-30 text-[#0275E2]" />
              <p className="font-semibold text-foreground/70">MQTT Message Stream</p>
              <p className="text-[11px] mt-0.5 max-w-[280px]">
                Subscribe to topics like <code className="text-[#0275E2]">#</code> or publish payloads below.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Publisher Composer */}
        <div className="p-3 border-t border-border/70 bg-card/40 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-muted-foreground font-mono">Topic:</span>
              <Input
                value={pubTopic}
                onChange={(e) => setPubTopic(e.target.value)}
                placeholder="Publish Topic (e.g. sensors/temperature)"
                className="h-7 text-xs font-mono bg-background flex-1"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground font-mono">QoS:</span>
                <Select value={pubQos} onValueChange={(v: any) => setPubQos(v)}>
                  <SelectTrigger className="h-7 w-16 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" className="text-xs">0</SelectItem>
                    <SelectItem value="1" className="text-xs">1</SelectItem>
                    <SelectItem value="2" className="text-xs">2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={pubRetain}
                  onChange={(e) => setPubRetain(e.target.checked)}
                  className="rounded border-border accent-[#0275E2]"
                />
                <span>Retain</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Textarea
              rows={3}
              value={pubPayload}
              onChange={(e) => setPubPayload(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handlePublish();
                }
              }}
              placeholder="Message payload (JSON, string, binary)..."
              className="font-mono text-xs resize-none bg-background border-border/80 focus-visible:ring-[#0275E2]/40"
            />

            <Button
              onClick={handlePublish}
              disabled={connectionStatus !== 'connected' || !pubTopic.trim()}
              className="h-auto px-4 bg-[#0275E2] hover:bg-[#0275E2]/90 text-white flex flex-col items-center justify-center gap-1"
            >
              <Send className="size-4 fill-white" />
              <span className="text-[10px]">Publish</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
