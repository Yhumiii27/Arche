// "New action" in the header of every CAPEX page (owner's pilot feedback, 24 Oct 2026): shown when the viewer may open an
// action on the CAPEX (right `actions`), its source set from the page. Server Component.
import type { ScreenId } from '@/config/screens';
import { SOURCE_OF_SCREEN } from '@/domain/actions';
import { canDo } from '@/domain/capex';
import { getDb } from '@/server/db/client';
import { actionPeople } from '@/server/dal/actions';
import { capexForViewer } from '@/server/dal/capex';
import { getViewer } from '@/server/session';
import { ActionFormPanel } from './forms';

export async function NewActionHeaderButton({ screen, code }: { screen: ScreenId; code: string }) {
  const viewer = await getViewer();
  const c = await capexForViewer(viewer, code);
  if (!c || !canDo('actions', viewer.role, viewer.assignments, c)) return null;
  const people = await actionPeople(await getDb(), c);
  return <ActionFormPanel code={c.code} people={people} source={SOURCE_OF_SCREEN[screen] ?? 'general'} primary />;
}
