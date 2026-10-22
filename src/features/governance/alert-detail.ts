// Display of an alert's detail (src/domain/alerts.ts): its " · " segments, dates and amounts formatted in the viewer's
// language, ratios with two decimals, Arche labels translated. Pure.
import type { Lang } from '@/i18n/translate';
import { fmtDate, fmtKeur, fmtRatio } from '@/lib/format';

export function alertDetail(detail: string | null, t: (s: string) => string, lang: Lang): string {
  if (!detail) return '';
  return detail
    .split(' · ')
    .map((seg) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) return fmtDate(seg, lang);
      if (/^\d+(\.\d+)?$/.test(seg)) return seg.includes('.') ? fmtRatio(Number(seg), lang) : seg;
      const m = /^(\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?) k€$/.exec(seg);
      if (m) return `${fmtKeur(Number(m[1]), lang)} / ${fmtKeur(Number(m[2]), lang)}`;
      return t(seg);
    })
    .join(' · ');
}
