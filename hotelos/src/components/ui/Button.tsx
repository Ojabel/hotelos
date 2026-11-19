import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-forest text-white hover:bg-deep active:bg-forest disabled:bg-slate disabled:text-white',
  accent: 'bg-champagne text-forest hover:bg-champagne/90 active:bg-champagne disabled:bg-line disabled:text-forest',
  secondary: 'border border-line bg-ivory text-forest hover:bg-white active:bg-ivory disabled:bg-ivory disabled:text-slate',
  ghost: 'text-forest hover:bg-forest/5 active:bg-forest/10 disabled:text-slate',
  danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger disabled:bg-slate disabled:text-white',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-meta',
  md: 'h-10 px-4 text-body',
  lg: 'h-11 px-5 text-body',
  icon: 'h-10 w-10',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-button-variant={variant}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
