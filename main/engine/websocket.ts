import WebSocket from 'ws';

export interface WsEventMessage {
  type: 'open' | 'message' | 'error' | 'close';
  connectionId: string;
  payload?: string;
  direction?: 'in' | 'out';
  error?: string;
  code?: number;
  reason?: string;
  timestamp: string;
}

type EventCallback = (event: WsEventMessage) => void;

class WebSocketManager {
  private sockets = new Map<string, WebSocket>();

  public connect(
    connectionId: string,
    url: string,
    headers: Record<string, string> = {},
    onEvent: EventCallback
  ) {
    this.disconnect(connectionId);

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('ws://') && !targetUrl.startsWith('wss://')) {
      targetUrl = `wss://${targetUrl}`;
    }

    try {
      const ws = new WebSocket(targetUrl, {
        headers,
      });

      this.sockets.set(connectionId, ws);

      ws.on('open', () => {
        onEvent({
          type: 'open',
          connectionId,
          timestamp: new Date().toISOString(),
        });
      });

      ws.on('message', (data, isBinary) => {
        const payload = isBinary
          ? `[Binary data: ${data.toString()}]`
          : data.toString('utf-8');

        onEvent({
          type: 'message',
          connectionId,
          payload,
          direction: 'in',
          timestamp: new Date().toISOString(),
        });
      });

      ws.on('error', (err) => {
        onEvent({
          type: 'error',
          connectionId,
          error: err.message || 'WebSocket connection error',
          timestamp: new Date().toISOString(),
        });
      });

      ws.on('close', (code, reason) => {
        this.sockets.delete(connectionId);
        onEvent({
          type: 'close',
          connectionId,
          code,
          reason: reason.toString() || 'Connection closed',
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err: any) {
      onEvent({
        type: 'error',
        connectionId,
        error: err.message || 'Failed to initialize WebSocket',
        timestamp: new Date().toISOString(),
      });
    }
  }

  public send(connectionId: string, message: string, onEvent: EventCallback): boolean {
    const ws = this.sockets.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    ws.send(message);

    onEvent({
      type: 'message',
      connectionId,
      payload: message,
      direction: 'out',
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  public disconnect(connectionId: string) {
    const ws = this.sockets.get(connectionId);
    if (ws) {
      try {
        ws.close();
      } catch {
        // Ignored
      }
      this.sockets.delete(connectionId);
    }
  }

  public disconnectAll() {
    for (const [id] of this.sockets) {
      this.disconnect(id);
    }
  }
}

export const wsManager = new WebSocketManager();
