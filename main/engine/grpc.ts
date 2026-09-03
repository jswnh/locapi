import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { performance } from 'perf_hooks';
import { addHistory } from '../db/queries/history';

export interface ProtoMethodInfo {
  name: string;
  requestType: string;
  responseType: string;
  requestStream: boolean;
  responseStream: boolean;
}

export interface ProtoServiceInfo {
  serviceName: string;
  methods: ProtoMethodInfo[];
}

export interface GrpcExecuteResult {
  status: number;
  statusText: string;
  response: any;
  durationMs: number;
  metadata?: Record<string, string>;
  error?: string;
}

export function parseProtoFile(protoFilePath: string): ProtoServiceInfo[] {
  const packageDefinition = protoLoader.loadSync(protoFilePath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const services: ProtoServiceInfo[] = [];

  for (const [key, def] of Object.entries(packageDefinition)) {
    // Check if entry is a service definition (has method definition properties)
    const isService = (def as any).format === undefined && typeof def === 'object' && Object.keys(def).length > 0;
    if (isService) {
      const methods: ProtoMethodInfo[] = [];
      for (const [methodName, methodDef] of Object.entries(def as any)) {
        if (methodDef && (methodDef as any).path) {
          methods.push({
            name: methodName,
            requestType: (methodDef as any).requestType?.type?.name || 'Request',
            responseType: (methodDef as any).responseType?.type?.name || 'Response',
            requestStream: Boolean((methodDef as any).requestStream),
            responseStream: Boolean((methodDef as any).responseStream),
          });
        }
      }

      if (methods.length > 0) {
        services.push({
          serviceName: key,
          methods,
        });
      }
    }
  }

  return services;
}

export async function executeGrpcCall(options: {
  endpoint: string;
  protoPath: string;
  serviceName: string;
  methodName: string;
  payload: any;
  metadata?: Record<string, string>;
  useTls?: boolean;
}): Promise<GrpcExecuteResult> {
  const startTime = performance.now();

  try {
    const packageDefinition = protoLoader.loadSync(options.protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const grpcObject = grpc.loadPackageDefinition(packageDefinition);

    // Resolve service constructor from nested packages if dotted (e.g. 'helloworld.Greeter')
    const parts = options.serviceName.split('.');
    let ServiceConstructor: any = grpcObject;
    for (const part of parts) {
      if (ServiceConstructor && ServiceConstructor[part]) {
        ServiceConstructor = ServiceConstructor[part];
      }
    }

    if (typeof ServiceConstructor !== 'function') {
      return {
        status: grpc.status.INTERNAL,
        statusText: 'INTERNAL',
        response: null,
        durationMs: 0,
        error: `Could not resolve ServiceConstructor for "${options.serviceName}"`,
      };
    }

    const credentials = options.useTls
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    const client = new ServiceConstructor(options.endpoint.trim(), credentials);

    // Prepare Metadata
    const metadata = new grpc.Metadata();
    if (options.metadata) {
      for (const [k, v] of Object.entries(options.metadata)) {
        if (k && v) metadata.add(k, v);
      }
    }

    // Call method (Unary RPC)
    return new Promise((resolve) => {
      const methodFn = client[options.methodName];
      if (typeof methodFn !== 'function') {
        const duration = Math.round(performance.now() - startTime);
        client.close();
        return resolve({
          status: grpc.status.UNIMPLEMENTED,
          statusText: 'UNIMPLEMENTED',
          response: null,
          durationMs: duration,
          error: `Method "${options.methodName}" not found on service`,
        });
      }

      methodFn.call(
        client,
        options.payload || {},
        metadata,
        (err: grpc.ServiceError | null, response: any) => {
          const duration = Math.round(performance.now() - startTime);
          client.close();

          if (err) {
            const errResult: GrpcExecuteResult = {
              status: err.code || grpc.status.UNKNOWN,
              statusText: err.details || 'gRPC Error',
              response: null,
              durationMs: duration,
              error: err.message || err.details,
            };

            try {
              addHistory({
                method: options.methodName,
                protocol: 'GRPC',
                url: options.endpoint,
                status: errResult.status,
                status_text: errResult.statusText,
                duration_ms: duration,
                size_bytes: 0,
                request_snapshot: { method: options.methodName, url: options.endpoint, headers: options.metadata || {}, body: options.payload },
                response_snapshot: { status: errResult.status, statusText: errResult.statusText, error: errResult.error },
              });
            } catch (histErr) {
              console.error('[gRPC History] Failed to record error:', histErr);
            }

            return resolve(errResult);
          }

          const okResult: GrpcExecuteResult = {
            status: grpc.status.OK,
            statusText: 'OK',
            response,
            durationMs: duration,
          };

          try {
            addHistory({
              method: options.methodName,
              protocol: 'GRPC',
              url: options.endpoint,
              status: 0,
              status_text: 'OK',
              duration_ms: duration,
              size_bytes: Buffer.byteLength(JSON.stringify(response || ''), 'utf-8'),
              request_snapshot: { method: options.methodName, url: options.endpoint, headers: options.metadata || {}, body: options.payload },
              response_snapshot: { status: 0, statusText: 'OK', body: response },
            });
          } catch (histErr) {
            console.error('[gRPC History] Failed to record success:', histErr);
          }

          resolve(okResult);
        }
      );
    });
  } catch (err: any) {
    const duration = Math.round(performance.now() - startTime);
    const failResult: GrpcExecuteResult = {
      status: grpc.status.UNKNOWN,
      statusText: 'UNKNOWN',
      response: null,
      durationMs: duration,
      error: err.message || 'Failed to execute gRPC call',
    };

    try {
      addHistory({
        method: options.methodName || 'RPC',
        protocol: 'GRPC',
        url: options.endpoint,
        status: 2,
        status_text: 'UNKNOWN',
        duration_ms: duration,
        size_bytes: 0,
        request_snapshot: { method: options.methodName, url: options.endpoint, headers: options.metadata || {}, body: options.payload },
        response_snapshot: { status: 2, statusText: 'UNKNOWN', error: failResult.error },
      });
    } catch (histErr) {
      console.error('[gRPC History] Failed to record fail:', histErr);
    }

    return failResult;
  }
}
