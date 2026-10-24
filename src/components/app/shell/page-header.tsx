// Page header (derived from Keystone's PageHeader): breadcrumb, title, and the "outside my workspace" banner when the
// screen is not in the profile's workspace (read-only: the page hides its actions).
import { Eye } from '@phosphor-icons/react/dist/ssr';
import type { ReactNode } from 'react';
import { SCREEN_BY_ID, canSee, type ScreenId } from '@/config/screens';
import { getI18n, getViewer } from '@/server/session';
import styles from './header.module.css';
import { LangToggle } from './lang-toggle';
import { NewActionAnyCapexButton, NewActionHeaderButton } from '@/features/actions/header-button';

export interface PageHeaderProps {
  screen: ScreenId;
  /** Title override, already translated or typed (a CAPEX title). */
  title?: string;
  /** Breadcrumb, EN source strings (translated) — the screen title is added last. */
  crumbs?: string[];
  /** Typed breadcrumb item shown as is (a CAPEX code). */
  crumbData?: string;
  primary?: ReactNode;
}

export async function PageHeader({ screen, title, crumbs = [], crumbData, primary }: PageHeaderProps) {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const def = SCREEN_BY_ID[screen];
  const outside = !canSee(viewer.role, screen);
  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <div className={styles.crumb}>
            <span>Arche</span>
            {crumbs.map((c) => (
              <span key={c} style={{ display: 'contents' }}>
                <span className={styles.sep}>/</span>
                <span>{t(c)}</span>
              </span>
            ))}
            {crumbData && (
              <>
                <span className={styles.sep}>/</span>
                <span>{crumbData}</span>
              </>
            )}
          </div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title ?? t(def.title)}</h1>
            {outside && (
              <span className={`tag tag-outline ${styles.roTag}`}>
                <Eye size={12} /> {t('Read-only')}
              </span>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          {!outside && primary}
          {!outside && (def.section === 'capex' && crumbData ? <NewActionHeaderButton screen={screen} code={crumbData} /> : def.section !== 'admin' && <NewActionAnyCapexButton />)}
          <LangToggle lang={lang} label={t('Language')} />
        </div>
      </header>
      {outside && (
        <div className="tag tag-outline" role="note" style={{ alignSelf: 'flex-start' }}>
          {t('Outside my workspace · Read-only')}
        </div>
      )}
    </>
  );
}
