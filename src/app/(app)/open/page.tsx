// Open a CAPEX (owner, 24 Oct 2026; "Subsidiary portfolio" section, main action of Home and of the CAPEX register): the
// guided opening — every question of the opening and of the framing in one wizard, or the takeover of a CAPEX in progress
// (N-20). A sponsor or a project lead, in the subsidiaries they may create in; the subsidiary chosen in the sidebar first.
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app/shell/page-header';
import { creatableSubsidiaries, nextCapexCode } from '@/domain/capex';
import { GuidedOpen } from '@/features/capex/guided-form';
import { dataText } from '@/i18n/data-text';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { capex, subsidiaries as subsidiaryTable } from '@/server/db/schema';
import { siteOptions } from '@/server/dal/capex';
import { ideaById } from '@/server/dal/ideas';
import { ideaRef } from '@/domain/ideas';
import { teamCandidates } from '@/server/dal/cycle';
import { getI18n, getSubsidiaryCookie, getViewer } from '@/server/session';
import { inArray } from 'drizzle-orm';

export default async function OpenCapexPage({ searchParams }: PageProps<'/open'>) {
  const [{ lang }, viewer, today, cookie, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), getSubsidiaryCookie(), searchParams]);
  const creatable = creatableSubsidiaries(viewer.role, viewer.assignments, viewer.subsidiaryCode);
  if (!creatable.length || (viewer.role !== 'sponsor' && viewer.role !== 'project_lead')) notFound();
  const db = await getDb();
  const taken = (await db.select({ code: capex.code }).from(capex)).map((x) => x.code);
  const year = Number(today.slice(0, 4));
  const names = new Map((await db.select({ code: subsidiaryTable.code, name: subsidiaryTable.name }).from(subsidiaryTable).where(inArray(subsidiaryTable.code, creatable))).map((x) => [x.code, x.name]));
  const subs = creatable.map((c) => ({ code: c, name: dataText(names.get(c) ?? c, lang), nextCode: nextCapexCode(c, year, taken) }));
  const sites = (await Promise.all(creatable.map(async (sub) => (await siteOptions(sub)).map((o) => ({ ...o, label: dataText(o.label, lang), subsidiary: sub }))))).flat();
  // A retained idea of a subsidiary the viewer creates in (AR-051, `?idea=`).
  const found = typeof sp.idea === 'string' && /^[0-9a-f-]{36}$/.test(sp.idea) ? await ideaById(db, sp.idea) : null;
  const idea = found && found.status === 'retained' && creatable.includes(found.subsidiaryCode)
    ? { id: found.id, ref: ideaRef(found.subsidiaryCode, found.number), subsidiaryCode: found.subsidiaryCode, title: found.title, stake: found.stake, investmentType: found.investmentType }
    : null;
  const people = (await Promise.all(creatable.map(async (sub) => (await teamCandidates(db, sub)).map((u) => ({ value: u.id, label: u.name, subsidiary: sub }))))).flat();
  return (
    <>
      <PageHeader screen="capex-open" crumbs={['Subsidiary portfolio']} />
      <GuidedOpen
        role={viewer.role}
        today={today}
        subsidiaries={subs}
        initialSubsidiary={idea?.subsidiaryCode ?? (cookie && creatable.includes(cookie) ? cookie : creatable[0])}
        idea={idea}
        sites={sites}
        people={people}
      />
    </>
  );
}
