import { cn } from '@/lib/utils';
import { HttpMethod, ApiProtocol } from '@/types/db';

interface MethodBadgeProps {
  method: HttpMethod | string;
  protocol?: ApiProtocol;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function MethodBadge({ method, protocol, className, size = 'default' }: MethodBadgeProps) {
  const isWs = protocol === 'WS' || method === 'WS';
  const isSocketIo = protocol === 'SOCKETIO' || method === 'SOCKETIO';
  const isMqtt = protocol === 'MQTT' || method === 'MQTT';
  const isGrpc = protocol === 'GRPC' || method === 'GRPC';

  const getColorClasses = () => {
    if (isWs) {
      return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }
    if (isSocketIo) {
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
    if (isMqtt) {
      return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
    }
    if (isGrpc) {
      return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
    }

    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'POST':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'PUT':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'PATCH':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'HEAD':
      case 'OPTIONS':
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
      default:
        return 'text-[#0275E2] bg-[#0275E2]/10 border-[#0275E2]/20';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-[10px] px-1 py-0.2 font-semibold tracking-wide';
      case 'lg':
        return 'text-xs px-2.5 py-1 font-bold tracking-wider';
      default:
        return 'text-[11px] px-1.5 py-0.5 font-bold tracking-wider';
    }
  };

  const getDisplayText = () => {
    if (isWs) return 'WS';
    if (isSocketIo) return 'SIO';
    if (isMqtt) return 'MQTT';
    if (isGrpc) return 'gRPC';
    return method.toUpperCase();
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded border font-mono select-none',
        getColorClasses(),
        getSizeClasses(),
        className
      )}
    >
      {getDisplayText()}
    </span>
  );
}
