import { Separator } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  className?: string;
  id?: string;
  direction?: 'horizontal' | 'vertical';
}

export function ResizeHandle({ className, id, direction = 'horizontal' }: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <Separator
      id={id}
      className={cn(
        'relative flex items-center justify-center transition-colors group select-none',
        isHorizontal
          ? 'w-1.5 cursor-col-resize hover:bg-[#0275E2]/40 active:bg-[#0275E2]'
          : 'h-1.5 cursor-row-resize hover:bg-[#0275E2]/40 active:bg-[#0275E2]',
        'bg-border/40 hover:bg-[#0275E2]/60',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full bg-muted-foreground/30 group-hover:bg-[#0275E2] transition-colors',
          isHorizontal ? 'h-8 w-0.5' : 'w-8 h-0.5'
        )}
      />
    </Separator>
  );
}
