import 'server-only';
// Props of the "New CAPEX" dialog (register and map): the subsidiaries the viewer may create in with the next code of each,
// their sites and, for a sponsor, the people who may be named project lead. Null when the viewer creates nowhere.
import { creatableSubsidiaries, nextCapexCode } from '@/domain/capex';
import type { Lang } from '@/i18n/translate';
import { dataText } from '@/i18n/data-text';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { capex } from '@/server/db/schema';
import { siteOptions } from '@/server/dal/capex';
import { teamCandidates } from '@/server/dal/cycle';
import type { Viewer } from '@/server/viewer';

export async function newCapexProps(viewer: Viewer, lang: Lang) {
  const creatable = creatableSubsidiaries(viewer.role, viewer.assignments, viewer.subsidiaryCode);
  if (!creatable.length) return null;
  const db = await getDb();
  const year = Number((await businessToday()).slice(0, 4));
  const taken = (await db.select({ code: capex.code }).from(capex)).map((x) => x.code);
  const sites = (await Promise.all(creatable.map(async (sub) => (await siteOptions(sub)).map((o) => ({ ...o, label: dataText(o.label, lang), subsidiary: sub }))))).flat();
  const leads = viewer.role === 'sponsor' ? (await Promise.all(creatable.map(async (sub) => (await teamCandidates(db, sub)).map((u) => ({ value: u.id, label: u.name, subsidiary: sub }))))).flat() : [];
  return { subsidiaries: creatable.map((c) => ({ value: c, label: c, nextCode: nextCapexCode(c, year, taken) })), sites, leads };
}
