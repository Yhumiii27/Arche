import 'server-only';
// The tables the viewer can export (AR-042), each the content of a page, through the visibility filter: the CAPEX register (the
// subsidiary of the sidebar and the page's filters), the group or subsidiary portfolio (indicators of each CAPEX), the alerts of
// the CAPEX the viewer follows, and the monthly committed / spent / physical progress of one CAPEX's lots. Arche's vocabulary is
// translated, typed text is written as typed.
import { STATUS_LABEL, PHASE_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { alertDetail } from '@/features/governance/alert-detail';
import { dataText } from '@/i18n/data-text';
import type { Lang, T } from '@/i18n/translate';
import type { ExportTable } from '@/lib/export/table';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { capexForViewer } from '@/server/dal/capex';
import { executionOf } from '@/server/dal/execution';
import { canSee } from '@/config/screens';
import { alertsForViewer, followedBy, portfolioDashboard } from '@/server/dal/governance';
import { portfolioOf, subsidiaryChoice } from '@/server/dal/portfolio';
import type { Viewer } from '@/server/viewer';

export const DATASETS = ['register', 'portfolio-group', 'portfolio-subsidiary', 'alerts', 'execution'] as const;
export type Dataset = (typeof DATASETS)[number];
export const isDataset = (v: string): v is Dataset => (DATASETS as readonly string[]).includes(v);

export interface ExportCtx {
  viewer: Viewer;
  t: T;
  lang: Lang;
  /** The subsidiary of the sidebar and the zone of the session (cookies). */
  subsidiaryCookie: string | null;
  zone: string | null;
  query: URLSearchParams;
}

const round = (n: number | null | undefined, digits = 1) => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

export async function exportTable(d: Dataset, x: ExportCtx): Promise<ExportTable | null> {
  const { viewer, t, lang, query } = x;
  const text = (s: string | null | undefined) => dataText(s, lang) ?? '';
  switch (d) {
    case 'register': {
      const [all, subs] = await Promise.all([portfolioOf(viewer, null), subsidiaryChoice(viewer, x.subsidiaryCookie)]);
      const q = (query.get('q') ?? '').trim().toLowerCase();
      const status = query.get('status') ?? '';
      const phase = query.get('phase') ?? '';
      const rows = all.rows.filter((c) => (!subs.current || c.subsidiaryCode === subs.current)
        && (!q || `${c.code} ${text(c.title)} ${c.siteName ?? ''}`.toLowerCase().includes(q)) && (!status || c.status === status) && (!phase || (c.status !== 'draft' && c.phase === phase)));
      return {
        title: t('CAPEX register'),
        head: [t('Code'), t('Title'), t('Subsidiary'), t('Zone'), t('Site'), t('Status'), t('Phase'), t('Typology'), t('Project lead'), t('Validated budget (k€)'), t('Estimate class'), t('Next gate')],
        rows: rows.map((c) => [c.code, text(c.title), text(c.subsidiaryName), text(c.zoneName), text(c.siteName), t(labelOf(STATUS_LABEL, c.status)), c.status === 'draft' ? '' : t(labelOf(PHASE_LABEL, c.phase)), c.typology ? t(labelOf(TYPOLOGY_LABEL, c.typology)) : '', c.leadName ?? '', c.validatedKeur, c.validatedClass ?? '', c.nextGate ?? '']),
      };
    }
    case 'portfolio-group':
    case 'portfolio-subsidiary': {
      const choice = d === 'portfolio-subsidiary' ? await subsidiaryChoice(viewer, x.subsidiaryCookie) : null;
      const p = await portfolioDashboard(viewer, d === 'portfolio-group' ? x.zone : null, choice?.current ?? null);
      return {
        title: d === 'portfolio-group' ? t('Group portfolio') : t('Subsidiary portfolio'),
        head: [t('Code'), t('Title'), t('Subsidiary'), t('Status'), t('Phase'), t('Next gate'), t('Budget at completion (k€)'), t('G2 budget (k€)'), t('Earned value (k€)'), t('Actual cost (k€)'), t('EAC (k€)'), 'SPI', 'CPI', t('Weighted pack (%)'), t('Safety milestones passed'), t('Major risks'), t('Alerts'), t('Next review')],
        rows: p.rows.map((r) => [
          r.code, text(r.title), r.subsidiaryCode, t(labelOf(STATUS_LABEL, r.status)), r.status === 'draft' ? '' : t(labelOf(PHASE_LABEL, r.phase)), r.dash.nextGate ?? '',
          round(r.dash.indicators.bacKeur), round(r.dash.g2Keur), round(r.dash.indicators.evKeur), round(r.dash.indicators.acKeur), round(r.dash.indicators.eacKeur),
          round(r.dash.indicators.spi, 2), round(r.dash.indicators.cpi, 2), round(r.dash.pack.pct), `${r.dash.hs.passed} / ${r.dash.hs.total}`, r.dash.majorRisks, r.dash.alerts.length, r.dash.review.dueOn ?? '',
        ]),
      };
    }
    case 'alerts': {
      const { alerts } = canSee(viewer.role, 'capex-overview') ? await alertsForViewer(viewer, followedBy(viewer)) : { alerts: [] };
      return {
        title: t('Alerts'),
        head: [t('Level'), t('CAPEX'), t('Alert'), t('Detail')],
        rows: alerts.map((a) => [a.level === 'alert' ? t('Alert') : t('Watch'), a.capexCode, t(a.text), a.detail ? alertDetail(a.detail, t, lang) : '']),
      };
    }
    case 'execution': {
      const code = query.get('capex') ?? '';
      const c = code ? await capexForViewer(viewer, code) : null;
      if (!c) return null;
      const db = await getDb();
      const exec = await executionOf(db, c, await businessToday(db));
      const lots = new Map(exec.lots.map((l) => [l.id, l]));
      const rows = [...exec.rows].sort((a, b) => (lots.get(a.lotId)?.number ?? 0) - (lots.get(b.lotId)?.number ?? 0) || a.month.localeCompare(b.month));
      return {
        title: `${c.code} ${t('Committed and spent')}`,
        head: [t('Lot'), t('Title'), 'EPC2i', t('Budget (k€)'), t('Month'), t('Committed (k€)'), t('Spent (k€)'), t('Physical progress (%)')],
        rows: rows.map((r) => {
          const l = lots.get(r.lotId);
          return [l?.number ?? null, text(l?.title), l?.epc2i ? t('Yes') : t('No'), round(l?.budgetKeur), r.month, round(r.committedKeur), round(r.spentKeur), round(r.physicalPct)];
        }),
      };
    }
  }
}
