// Page header: Norma 2.0's common header (norma/charte/COQUE.md § 3), in its fixed order — breadcrumb (section › … ›
// object, without the tool's name) and the page's <h1> · the page's actions (the main one rightmost, the "Actions" menu
// beyond three buttons) · the language / display pair, always the last element. When the screen is not in the profile's
// workspace the page is read-only: its actions are hidden and the "outside my workspace" banner follows the header.
import { Eye } from '@phosphor-icons/react/dist/ssr';
import type { ReactNode } from 'react';
import { PageHeader as CoqueHeader } from '@norma/charte/ds/PageHeader';
import { SCREEN_BY_ID, canSee, type ScreenId } from '@/config/screens';
import { getI18n, getTheme, getViewer } from '@/server/session';
import { ArchePrefs } from './prefs';
import { newActionAnyCapexButton, newActionHeaderButton } from '@/features/actions/header-button';

export interface PageHeaderProps {
  screen: ScreenId;
  /** Title override, already translated or typed (a CAPEX title). */
  title?: string;
  /** Breadcrumb, EN source strings (translated) — the screen title is added last. */
  crumbs?: string[];
  /** Typed breadcrumb item shown as is (a CAPEX code). */
  crumbData?: string;
  /** The page's main action (accent button, the rightmost one). */
  primary?: ReactNode;
  /**
   * The other actions the viewer may take on the page (owner's pilot feedback, 25 Oct 2026): Folded panels, ActionButtons,
   * ActionLinks — the page renders only those its viewer may take. Shown as buttons, or in the "Actions" list when many.
   */
  actions?: ReactNode;
  /** Tabs, views and filters of the page (`<FilterBar>`), right under the header. */
  toolbar?: ReactNode;
}

export async function PageHeader({ screen, title, crumbs = [], crumbData, primary, actions, toolbar }: PageHeaderProps) {
  const [{ t, lang }, viewer, theme] = await Promise.all([getI18n(), getViewer(), getTheme()]);
  const def = SCREEN_BY_ID[screen];
  const outside = !canSee(viewer.role, screen);
  const newAction = outside ? null : def.section === 'capex' && crumbData ? await newActionHeaderButton(screen, crumbData) : def.section !== 'admin' ? await newActionAnyCapexButton() : null;
  return (
    <CoqueHeader
      crumbs={[...crumbs.map((c) => t(c)), ...(crumbData ? [crumbData] : [])]}
      title={title ?? t(def.title)}
      titleAside={
        outside ? (
          <span className="tag tag-outline">
            <Eye size={12} aria-hidden /> {t('Read-only')}
          </span>
        ) : undefined
      }
      primary={primary}
      actions={
        <>
          {actions}
          {newAction}
        </>
      }
      prefs={<ArchePrefs lang={lang} theme={theme} />}
      outside={outside ? t('Outside my workspace · Read-only') : undefined}
      toolbar={toolbar}
    />
  );
}
