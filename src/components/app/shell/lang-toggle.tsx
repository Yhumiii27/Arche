'use client';
// Language toggle of the page header, top right (Keystone's LangToggle, header-islands.tsx): FR | EN, kept in a cookie.
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Segmented } from '@/components/ds/Segmented';
import type { Lang } from '@/i18n/translate';
import { setLang } from '@/server/actions/preferences';

export function LangToggle({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <Segmented
      label={label}
      value={lang}
      onChange={(v) =>
        startTransition(async () => {
          await setLang(v);
          router.refresh();
        })
      }
      options={[
        { value: 'fr' as Lang, label: 'FR' },
        { value: 'en' as Lang, label: 'EN' },
      ]}
    />
  );
}
