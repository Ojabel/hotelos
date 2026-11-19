import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <Icon className="h-8 w-8 text-champagne" aria-hidden />
      <h3 className="mt-3 text-card font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-body text-slate">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
