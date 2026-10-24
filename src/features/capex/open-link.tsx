// "Open a CAPEX" (owner, 24 Oct 2026): the main action of Home and of the CAPEX register — the guided opening, for the viewer
// who may create a CAPEX (a sponsor or a project lead, in their subsidiary). Server Component.
import { PlusCircle } from '@phosphor-icons/react/dist/ssr';
import { ButtonLink } from '@/components/ds/Button';
import { screenHref } from '@/config/screens';
import { creatableSubsidiaries } from '@/domain/capex';
import { getI18n } from '@/server/session';
import type { Viewer } from '@/server/viewer';

export async function OpenGuidedLink({ viewer }: { viewer: Viewer }) {
  if (!creatableSubsidiaries(viewer.role, viewer.assignments, viewer.subsidiaryCode).length) return null;
  const { t } = await getI18n();
  return <ButtonLink href={screenHref('capex-open')} variant="primary" icon={PlusCircle}>{t('Open a CAPEX')}</ButtonLink>;
}
