import { io, Socket } from 'socket.io-client';

export interface SocketIoEventMessage {
  type: 'connect' | 'disconnect' | 'event' | 'emitted' | 'error';
  connectionId: string;
  eventName?: string;
  payload?: any;
  direction?: 'in' | 'out';
  error?: string;
  timestamp: string;
}

type EventCallback = (event: SocketIoEventMessage) => void;

class SocketIOManager {
  private sockets = new Map<string, Socket>();
  private activeListeners = new Map<string, Set<string>>(); // connectionId -> Set<eventName>

  public connect(
    connectionId: string,
    url: string,
    options: { path?: string; auth?: Record<string, any> } = {},
    onEvent: EventCallback
  ) {
    this.disconnect(connectionId);

    try {
      const socket = io(url.trim(), {
        path: options.path || '/socket.io',
        auth: options.auth || {},
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 10000,
      });

      this.sockets.set(connectionId, socket);
      this.activeListeners.set(connectionId, new Set());

      socket.on('connect', () => {
        onEvent({
          type: 'connect',
          connectionId,
          payload: { socketId: socket.id },
          timestamp: new Date().toISOString(),
        });
      });

      socket.on('connect_error', (err) => {
        onEvent({
          type: 'error',
          connectionId,
          error: err.message || 'Socket.IO connection failed',
          timestamp: new Date().toISOString(),
        });
      });

      socket.on('disconnect', (reason) => {
        onEvent({
          type: 'disconnect',
          connectionId,
          payload: { reason },
          timestamp: new Date().toISOString(),
        });
      });

      // Catch-all listener for incoming events
      socket.onAny((eventName, ...args) => {
        onEvent({
          type: 'event',
          connectionId,
          eventName,
          payload: args.length === 1 ? args[0] : args,
          direction: 'in',
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err: any) {
      onEvent({
        type: 'error',
        connectionId,
        error: err.message || 'Failed to initialize Socket.IO client',
        timestamp: new Date().toISOString(),
      });
    }
  }

  public emit(
    connectionId: string,
    eventName: string,
    payload: any,
    onEvent: EventCallback
  ): boolean {
    const socket = this.sockets.get(connectionId);
    if (!socket || !socket.connected) {
      return false;
    }

    socket.emit(eventName, payload);

    onEvent({
      type: 'emitted',
      connectionId,
      eventName,
      payload,
      direction: 'out',
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  public listen(connectionId: string, eventName: string) {
    const socket = this.sockets.get(connectionId);
    if (!socket) return;

    const listeners = this.activeListeners.get(connectionId) || new Set();
    listeners.add(eventName);
    this.activeListeners.set(connectionId, listeners);
  }

  public disconnect(connectionId: string) {
    const socket = this.sockets.get(connectionId);
    if (socket) {
      try {
        socket.disconnect();
      } catch {
        // Ignored
      }
      this.sockets.delete(connectionId);
      this.activeListeners.delete(connectionId);
    }
  }

  public disconnectAll() {
    for (const [id] of this.sockets) {
      this.disconnect(id);
    }
  }
}

export const socketIoManager = new SocketIOManager();
