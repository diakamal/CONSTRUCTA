import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', className, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-amber-500 text-slate-950 hover:bg-amber-400',
        variant === 'secondary' && 'border border-stone-300 bg-white text-slate-800 hover:bg-stone-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        variant === 'ghost' && 'text-slate-600 hover:bg-stone-200/60',
        className,
      )}
    />
  );
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold text-slate-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;

export function Badge({ tone = 'stone', children }: { tone?: 'green' | 'amber' | 'red' | 'stone' | 'blue'; children: ReactNode }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-900', red: 'bg-red-100 text-red-800',
    stone: 'bg-stone-100 text-stone-700', blue: 'bg-sky-100 text-sky-800',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all', value >= 85 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${value}%` }} />
    </div>
  );
}

export const ErrorText = ({ children }: { children: ReactNode }) =>
  children ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{children}</p> : null;

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
