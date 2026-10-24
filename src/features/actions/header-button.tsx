// "New action" in the page header (owner's pilot feedback, 24 Oct 2026): on a CAPEX page, for that CAPEX with its source set
// from the page; on the other pages, with a choice among the CAPEX the viewer may open an action on (right `actions`), the
// last one used first (cookie arche-capex). Server Components.
import { cookies } from 'next/headers';
import type { ScreenId } from '@/config/screens';
import { SOURCE_OF_SCREEN } from '@/domain/actions';
import { canDo } from '@/domain/capex';
import { dataText } from '@/i18n/data-text';
import { getDb } from '@/server/db/client';
import { actionPeople } from '@/server/dal/actions';
import { capexForViewer, visibleCapex } from '@/server/dal/capex';
import { getI18n, getViewer } from '@/server/session';
import { ActionFormPanel, AnyCapexActionPanel } from './forms';

export async function NewActionHeaderButton({ screen, code }: { screen: ScreenId; code: string }) {
  const viewer = await getViewer();
  const c = await capexForViewer(viewer, code);
  if (!c || !canDo('actions', viewer.role, viewer.assignments, c)) return null;
  const people = await actionPeople(await getDb(), c);
  return <ActionFormPanel code={c.code} people={people} source={SOURCE_OF_SCREEN[screen] ?? 'general'} primary />;
}

export async function NewActionAnyCapexButton() {
  const [viewer, { lang }, jar] = await Promise.all([getViewer(), getI18n(), cookies()]);
  const mine = (await visibleCapex(viewer)).filter((c) => canDo('actions', viewer.role, viewer.assignments, c));
  if (!mine.length) return null;
  const db = await getDb();
  const capexes = await Promise.all(mine.map(async (c) => ({ code: c.code, label: `${c.code} · ${dataText(c.title, lang)}`, people: await actionPeople(db, c) })));
  const last = jar.get('arche-capex')?.value;
  return <AnyCapexActionPanel capexes={capexes} initial={capexes.some((c) => c.code === last) ? last! : capexes[0].code} />;
}
