import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface-muted p-5', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">{children}</h2>
}
