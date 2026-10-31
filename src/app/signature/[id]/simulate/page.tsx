// Simulation of the signature provider (AR-037, ARCHE_SIGNATURE_PROVIDER=simulation): what the signer sees at Yousign — the
// document, its SHA-256, the statement — with "Sign" or "Decline"; then back to Arche as from the provider. Only the signer of
// a simulated request under way sees it.
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { SectionCard } from '@/components/app/SectionCard';
import { SimulatedSignForm } from '@/features/gates/signature-forms';
import { getDb } from '@/server/db/client';
import { signatureRequests } from '@/server/db/schema';
import { getI18n, getViewer } from '@/server/session';
import { whereOf } from '@/server/signature/advanced';

export default async function SimulatedSignaturePage({ params }: PageProps<'/signature/[id]/simulate'>) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ t }, viewer, db] = await Promise.all([getI18n(), getViewer(), getDb()]);
  const [req] = await db.select().from(signatureRequests).where(eq(signatureRequests.id, id));
  if (!req || req.provider !== 'simulation' || req.signerUserId !== viewer.userId || req.status !== 'pending') notFound();
  const where = await whereOf(db, req);
  if (!where) notFound();
  return (
    <main style={{ maxWidth: 760, margin: '48px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <SectionCard title={t('Advanced signature (simulation)')} hint={t('Stands for the signature provider (Yousign) in the demonstration: no legal value')}>
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          <div><span className="text-muted">{t('Signer')} · </span>{req.signerName}</div>
          <div><span className="text-muted">{t('Document')} · </span><a href={`/print/capex/${encodeURIComponent(where.code)}/dossiers/investment/pdf${where.versionNumber ? `?v=${where.versionNumber}` : ''}`}>{`${where.code} — G2 / AFE (PDF)`}</a></div>
          {req.contentHash && <div><span className="text-muted">SHA-256 · </span><code>{req.contentHash}</code></div>}
          <div><span className="text-muted">{t('I sign:')} </span>{req.statement}</div>
        </div>
        <SimulatedSignForm requestId={req.id} />
      </SectionCard>
    </main>
  );
}
