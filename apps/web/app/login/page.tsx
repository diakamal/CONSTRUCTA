'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ErrorText, Field, Input } from '@/components/ui';
import { errorMessage, rpcPublic, setSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSession(await rpcPublic('loginManager', email, password));
      router.replace('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[0.2em] text-slate-900">CONSTRUCTA</h1>
          <p className="mt-1 text-sm text-slate-500">כניסה למנהל העבודה</p>
        </div>
        <Field label="אימייל">
          <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </Field>
        <Field label="סיסמה">
          <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full py-3">{busy ? 'מתחבר…' : 'כניסה'}</Button>
        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          מצב דמו: פרטי ההתחברות של המנהל לדוגמה נמצאים ב-README.
        </p>
        <section aria-labelledby="contact-heading" className="border-t border-slate-200 pt-4 text-sm text-slate-600">
          <h2 id="contact-heading" className="font-bold text-slate-900">צור קשר</h2>
          <p className="mt-1">יש שאלה או צריך עזרה? נשמח לעזור.</p>
          <ul className="mt-2 space-y-1">
            <li>
              אימייל:{' '}
              <a href="mailto:contact@constructa.test" dir="ltr" className="font-medium text-slate-900 underline">
                contact@constructa.test
              </a>
            </li>
            <li>
              טלפון:{' '}
              <a href="tel:+97230000000" dir="ltr" className="font-medium text-slate-900 underline">
                03-0000000
              </a>
            </li>
          </ul>
        </section>
      </form>
    </main>
  );
}
