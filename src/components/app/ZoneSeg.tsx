'use client';
// Zone selector of the portfolio views (Keystone's zone bar): every zone or one, with the number of CAPEX of each; the
// choice is kept for the session's next views (cookie arche-zone).
import { useTransition } from 'react';
import { Segmented } from '@/components/ds/Segmented';
import { useI18n } from '@/i18n/client';
import { setZone } from '@/server/actions/preferences';

export interface ZoneOption {
  /** Zone code, null = every zone. */
  code: string | null;
  /** Displayed label (typed zone names shown as typed). */
  label: string;
  count: number;
}

export function ZoneSeg({ zone, options }: { zone: string | null; options: ZoneOption[] }) {
  const { t } = useI18n();
  const [, start] = useTransition();
  return (
    <Segmented<string>
      wrap
      label={t('Zone')}
      value={zone ?? 'all'}
      onChange={(v) => start(() => setZone(v === 'all' ? null : v))}
      options={options.map((o) => ({ value: o.code ?? 'all', label: o.label, count: o.count }))}
    />
  );
}
