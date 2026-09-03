import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import { executeHttpRequest } from '../engine/http';
import { wsManager, WsEventMessage } from '../engine/websocket';
import { socketIoManager, SocketIoEventMessage } from '../engine/socketio';
import { mqttManager, MqttEventMessage } from '../engine/mqtt';
import { parseProtoFile, executeGrpcCall } from '../engine/grpc';
import { ApiRequest } from '../types/db';

export function registerEngineHandlers() {
  // 1. HTTP / REST / GraphQL / SOAP Execution
  ipcMain.handle(IPC_CHANNELS.ENGINE_EXECUTE, async (_event, request: ApiRequest) => {
    return executeHttpRequest(request);
  });

  // 2. Raw WebSocket Engine
  ipcMain.handle(
    IPC_CHANNELS.WS_CONNECT,
    async (
      event,
      payload: { connectionId: string; url: string; headers?: Record<string, string> }
    ) => {
      wsManager.connect(
        payload.connectionId,
        payload.url,
        payload.headers || {},
        (wsEvent: WsEventMessage) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.WS_EVENT, wsEvent);
          }
        }
      );
      return true;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.WS_SEND,
    async (event, payload: { connectionId: string; message: string }) => {
      return wsManager.send(payload.connectionId, payload.message, (wsEvent: WsEventMessage) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.WS_EVENT, wsEvent);
        }
      });
    }
  );

  ipcMain.handle(IPC_CHANNELS.WS_DISCONNECT, async (_event, connectionId: string) => {
    wsManager.disconnect(connectionId);
    return true;
  });

  // 3. Socket.IO Engine
  ipcMain.handle(
    IPC_CHANNELS.SOCKETIO_CONNECT,
    async (
      event,
      payload: {
        connectionId: string;
        url: string;
        options?: { path?: string; auth?: Record<string, any> };
      }
    ) => {
      socketIoManager.connect(
        payload.connectionId,
        payload.url,
        payload.options || {},
        (sioEvent: SocketIoEventMessage) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.SOCKETIO_EVENT, sioEvent);
          }
        }
      );
      return true;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SOCKETIO_EMIT,
    async (
      event,
      payload: { connectionId: string; eventName: string; data: any }
    ) => {
      return socketIoManager.emit(
        payload.connectionId,
        payload.eventName,
        payload.data,
        (sioEvent: SocketIoEventMessage) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.SOCKETIO_EVENT, sioEvent);
          }
        }
      );
    }
  );

  ipcMain.handle(IPC_CHANNELS.SOCKETIO_DISCONNECT, async (_event, connectionId: string) => {
    socketIoManager.disconnect(connectionId);
    return true;
  });

  // 4. MQTT Engine
  ipcMain.handle(
    IPC_CHANNELS.MQTT_CONNECT,
    async (
      event,
      payload: {
        connectionId: string;
        brokerUrl: string;
        options?: {
          clientId?: string;
          username?: string;
          password?: string;
          clean?: boolean;
        };
      }
    ) => {
      mqttManager.connect(
        payload.connectionId,
        payload.brokerUrl,
        payload.options || {},
        (mqttEvent: MqttEventMessage) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.MQTT_EVENT, mqttEvent);
          }
        }
      );
      return true;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MQTT_SUBSCRIBE,
    async (
      event,
      payload: { connectionId: string; topic: string; qos?: 0 | 1 | 2 }
    ) => {
      return mqttManager.subscribe(
        payload.connectionId,
        payload.topic,
        payload.qos || 0,
        (mqttEvent: MqttEventMessage) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.MQTT_EVENT, mqttEvent);
          }
        }
      );
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MQTT_UNSUBSCRIBE,
    async (_event, payload: { connectionId: string; topic: string }) => {
      return mqttManager.unsubscribe(payload.connectionId, payload.topic);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MQTT_PUBLISH,
    async (
      event,
      payload: {
        connectionId: string;
        topic: string;
        message: string;
        options?: { qos?: 0 | 1 | 2; retain?: boolean };
      }
    ) => {
      return mqttManager.publish(
        payload.connectionId,
        payload.topic,
        payload.message,
        payload.options || {},
        (mqttEvent: MqttEventMessage) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.MQTT_EVENT, mqttEvent);
          }
        }
      );
    }
  );

  ipcMain.handle(IPC_CHANNELS.MQTT_DISCONNECT, async (_event, connectionId: string) => {
    mqttManager.disconnect(connectionId);
    return true;
  });

  // 5. gRPC Engine
  ipcMain.handle(IPC_CHANNELS.GRPC_LOAD_PROTO, async (_event, protoFilePath: string) => {
    return parseProtoFile(protoFilePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.GRPC_EXECUTE,
    async (
      _event,
      payload: {
        endpoint: string;
        protoPath: string;
        serviceName: string;
        methodName: string;
        payload: any;
        metadata?: Record<string, string>;
        useTls?: boolean;
      }
    ) => {
      return executeGrpcCall(payload);
    }
  );

  console.log('[IPC] Registered all protocol engines (REST, GraphQL, SOAP, WS, Socket.IO, MQTT, gRPC)');
}
