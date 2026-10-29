// Copil report of a CAPEX (docs/spec/06 §2): printable page prepared for a project review — summary, gates, budget and
// S-curve figures, main risks, changes, decisions to take and alerts; "Download as PDF" writes the same document as a PDF on
// the server (AR-042). Same visibility as the CAPEX (outside the scope: 404). The report is filed in Codex by the user (Arche
// stores no file).
import { loadCapexPage } from '@/features/capex/page-data';
import { copilReportDoc } from '@/features/print/documents';
import { PrintDocView } from '@/features/print/print-view';

export default async function CopilReportPage({ params }: PageProps<'/print/capex/[code]/report'>) {
  const ctx = await loadCapexPage(params);
  const doc = await copilReportDoc(ctx);
  return <PrintDocView doc={doc} pdfHref={`/print/capex/${encodeURIComponent(ctx.c.code)}/report/pdf`} pdfLabel={ctx.t('Download as PDF')} />;
}
