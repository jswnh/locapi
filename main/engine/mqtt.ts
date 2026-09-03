import mqtt, { MqttClient } from 'mqtt';

export interface MqttEventMessage {
  type: 'connect' | 'disconnect' | 'message' | 'published' | 'subscribed' | 'error';
  connectionId: string;
  topic?: string;
  payload?: string;
  qos?: number;
  retain?: boolean;
  direction?: 'in' | 'out';
  error?: string;
  timestamp: string;
}

type EventCallback = (event: MqttEventMessage) => void;

class MqttManager {
  private clients = new Map<string, MqttClient>();

  public connect(
    connectionId: string,
    brokerUrl: string,
    options: {
      clientId?: string;
      username?: string;
      password?: string;
      clean?: boolean;
    } = {},
    onEvent: EventCallback
  ) {
    this.disconnect(connectionId);

    let targetUrl = brokerUrl.trim();
    if (
      !targetUrl.startsWith('mqtt://') &&
      !targetUrl.startsWith('mqtts://') &&
      !targetUrl.startsWith('ws://') &&
      !targetUrl.startsWith('wss://') &&
      !targetUrl.startsWith('tcp://')
    ) {
      targetUrl = `mqtt://${targetUrl}`;
    }

    try {
      const client = mqtt.connect(targetUrl, {
        clientId: options.clientId || `locapi_${Math.random().toString(16).substring(2, 10)}`,
        username: options.username || undefined,
        password: options.password || undefined,
        clean: options.clean !== false,
        reconnectPeriod: 0, // Manual reconnect only
        connectTimeout: 10000,
      });

      this.clients.set(connectionId, client);

      client.on('connect', () => {
        onEvent({
          type: 'connect',
          connectionId,
          timestamp: new Date().toISOString(),
        });
      });

      client.on('message', (topic, message, packet) => {
        onEvent({
          type: 'message',
          connectionId,
          topic,
          payload: message.toString('utf-8'),
          qos: packet.qos,
          retain: packet.retain,
          direction: 'in',
          timestamp: new Date().toISOString(),
        });
      });

      client.on('error', (err) => {
        onEvent({
          type: 'error',
          connectionId,
          error: err.message || 'MQTT broker error',
          timestamp: new Date().toISOString(),
        });
      });

      client.on('close', () => {
        onEvent({
          type: 'disconnect',
          connectionId,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err: any) {
      onEvent({
        type: 'error',
        connectionId,
        error: err.message || 'Failed to connect to MQTT broker',
        timestamp: new Date().toISOString(),
      });
    }
  }

  public subscribe(
    connectionId: string,
    topic: string,
    qos: 0 | 1 | 2 = 0,
    onEvent: EventCallback
  ): boolean {
    const client = this.clients.get(connectionId);
    if (!client || !client.connected) return false;

    client.subscribe(topic, { qos }, (err) => {
      if (err) {
        onEvent({
          type: 'error',
          connectionId,
          error: `Subscribe failed: ${err.message}`,
          timestamp: new Date().toISOString(),
        });
      } else {
        onEvent({
          type: 'subscribed',
          connectionId,
          topic,
          qos,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return true;
  }

  public unsubscribe(connectionId: string, topic: string): boolean {
    const client = this.clients.get(connectionId);
    if (!client || !client.connected) return false;

    client.unsubscribe(topic);
    return true;
  }

  public publish(
    connectionId: string,
    topic: string,
    message: string,
    options: { qos?: 0 | 1 | 2; retain?: boolean } = {},
    onEvent: EventCallback
  ): boolean {
    const client = this.clients.get(connectionId);
    if (!client || !client.connected) return false;

    const qos = options.qos || 0;
    const retain = Boolean(options.retain);

    client.publish(topic, message, { qos, retain }, (err) => {
      if (err) {
        onEvent({
          type: 'error',
          connectionId,
          error: `Publish failed: ${err.message}`,
          timestamp: new Date().toISOString(),
        });
      } else {
        onEvent({
          type: 'published',
          connectionId,
          topic,
          payload: message,
          qos,
          retain,
          direction: 'out',
          timestamp: new Date().toISOString(),
        });
      }
    });

    return true;
  }

  public disconnect(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (client) {
      try {
        client.end(true);
      } catch {
        // Ignored
      }
      this.clients.delete(connectionId);
    }
  }

  public disconnectAll() {
    for (const [id] of this.clients) {
      this.disconnect(id);
    }
  }
}

export const mqttManager = new MqttManager();
