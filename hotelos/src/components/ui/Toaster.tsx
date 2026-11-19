import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/utils/cn';

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'danger' ? XCircle : Info;
        return (
          <div key={t.id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-white p-3 shadow-pop">
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', t.tone === 'success' ? 'text-success' : t.tone === 'danger' ? 'text-danger' : 'text-info')} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium">{t.title}</p>
              {t.description && <p className="text-meta text-slate">{t.description}</p>}
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="rounded p-1 text-slate hover:bg-ivory">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
