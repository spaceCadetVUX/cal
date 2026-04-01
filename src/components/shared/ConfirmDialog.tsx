import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  confirmLabel?: string
  variant?: 'destructive' | 'default'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Xác nhận',
  variant = 'default',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-card-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Icon */}
          <div className={cn(
            'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            variant === 'destructive'
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-primary/10',
          )}>
            <AlertTriangle className={cn(
              'h-6 w-6',
              variant === 'destructive' ? 'text-red-600 dark:text-red-400' : 'text-primary',
            )} />
          </div>

          <Dialog.Title className="text-center text-base font-semibold text-foreground">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
            {description}
          </Dialog.Description>

          <div className="mt-6 flex gap-3">
            <Dialog.Close asChild>
              <button className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-theme hover:bg-muted active:scale-[0.98]">
                Huỷ
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              className={cn(
                'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.98]',
                variant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/25'
                  : 'bg-primary hover:opacity-90 shadow-sm shadow-primary/25',
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
