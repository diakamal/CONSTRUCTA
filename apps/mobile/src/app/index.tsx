// Entry gate: first launch → choose language → sign in → my day.
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { loadSession } from '@/lib/api';
import { hasChosenLanguage } from '@/lib/i18n';

export default function Index() {
  const [target, setTarget] = useState<'/language' | '/login' | '/today' | null>(null);

  useEffect(() => {
    (async () => {
      if (!(await hasChosenLanguage())) return setTarget('/language');
      setTarget((await loadSession()) ? '/today' : '/login');
    })();
  }, []);

  return target ? <Redirect href={target} /> : null;
}
