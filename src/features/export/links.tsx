// The export links of a page's header (AR-042): the page's table for Excel and as CSV (src/app/export/[dataset]/route.ts),
// with the page's filters. Client elements, so that the header counts them (src/components/app/shell/header-actions.tsx).
import { ActionLink } from '@/components/app/ActionForm';
import type { T } from '@/i18n/translate';
import type { Dataset } from '@/server/export/datasets';

export function exportLinks(t: T, dataset: Dataset, query: Record<string, string> = {}) {
  const href = (format: 'xlsx' | 'csv') => `/export/${dataset}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)), format })}`;
  return [
    <ActionLink key="xlsx" href={href('xlsx')} download icon="download" label={t('Export (Excel)')} />,
    <ActionLink key="csv" href={href('csv')} download icon="download" label={t('Export (CSV)')} />,
  ];
}
