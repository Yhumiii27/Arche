// "Open a CAPEX" (owner, 24 Oct 2026): the main action of Home and of the CAPEX register — the guided opening, for the viewer
// who may create a CAPEX (a sponsor or a project lead, in their subsidiary). Server helper.
import { ActionLink } from '@/components/app/ActionForm';
import { screenHref } from '@/config/screens';
import { creatableSubsidiaries } from '@/domain/capex';
import { getI18n } from '@/server/session';
import type { Viewer } from '@/server/viewer';

/** The element, or null: called (not rendered as a component) so that the page header counts its actions exactly. */
export async function openGuidedLink(viewer: Viewer) {
  if (!creatableSubsidiaries(viewer.role, viewer.assignments, viewer.subsidiaryCode).length) return null;
  const { t } = await getI18n();
  return <ActionLink href={screenHref('capex-open')} variant="primary" icon="plus-circle" label={t('Open a CAPEX')} />;
}
