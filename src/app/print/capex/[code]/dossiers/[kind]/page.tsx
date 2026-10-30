// Print view of a dossier version (docs/spec/04 §1): A4, black on white, the sections, the values as frozen, the Codex
// references and the fingerprint; "Download as PDF" writes the same document as a PDF on the server (AR-042). Same visibility
// as the dossier page (outside the viewer's scope: 404). The frozen and signed version is deposited in Codex from the dossier
// page (CX-03; frozen in Codex: CX-07).
import { notFound } from 'next/navigation';
import { isDossierKind } from '@/domain/dossiers';
import { loadCapexPage } from '@/features/capex/page-data';
import { dossierDoc } from '@/features/print/documents';
import { PrintDocView } from '@/features/print/print-view';

export default async function DossierPrintPage({ params, searchParams }: PageProps<'/print/capex/[code]/dossiers/[kind]'>) {
  const { kind } = await params;
  if (!isDossierKind(kind)) notFound();
  const ctx = await loadCapexPage(params);
  const sp = await searchParams;
  const n = typeof sp.v === 'string' ? Number(sp.v) : undefined;
  const doc = await dossierDoc(ctx, kind, n);
  if (!doc) notFound();
  const pdf = `/print/capex/${encodeURIComponent(ctx.c.code)}/dossiers/${kind}/pdf${n != null ? `?v=${n}` : ''}`;
  return <PrintDocView doc={doc} pdfHref={pdf} pdfLabel={ctx.t('Download as PDF')} />;
}
