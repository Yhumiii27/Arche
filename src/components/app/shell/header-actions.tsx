'use client';
// The actions of a page, in its header (owner's pilot feedback, 25 Oct 2026): one button per action the viewer may take on
// the page; beyond MAX_BUTTONS, the main action stays a button and the others go in an "Actions" drop-down list. The list
// stays mounted while closed, so that the side panel an action opened (a portal) keeps its state.
import { CaretDown, DotsThreeVertical } from '@phosphor-icons/react/dist/ssr';
import { Children, Fragment, isValidElement, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@/components/ds/Button';
import { useOverlay } from '@/components/ds/overlay';
import pop from '@/components/ds/Popover.module.css';
import { cx } from '@/components/ds/cx';
import { MenuModeCtx } from '@/components/app/menu-mode';
import { useI18n } from '@/i18n/client';
import styles from './header.module.css';

/** Buttons shown in the header before the drop-down list takes over. */
export const MAX_BUTTONS = 3;

/** The actions as a flat list (fragments opened, empty ones dropped). Pages pass client elements only, so a count is exact. */
function flat(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((c) => (isValidElement<{ children?: ReactNode }>(c) && c.type === Fragment ? flat(c.props.children) : [c]));
}

export function HeaderActions({ children }: { children: ReactNode }) {
  const items = flat(children);
  if (items.length <= MAX_BUTTONS) return <>{items}</>;
  const [main, ...rest] = items;
  return (
    <>
      {main}
      <ActionsMenu>{rest}</ActionsMenu>
    </>
  );
}

function ActionsMenu({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  useOverlay({ active: open, onEscape: () => setOpen(false), outsideRef: anchorRef, onOutside: () => setOpen(false) });
  return (
    <div ref={anchorRef} className={pop.anchor}>
      <Button variant="secondary" icon={DotsThreeVertical} iconRight={CaretDown} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        {t('Actions')}
      </Button>
      <div role="menu" hidden={!open} className={cx('elev-md', pop.panel, pop.below, pop.end, styles.actionsMenu)} style={{ '--pop-min-w': '280px', '--pop-z': 30 } as CSSProperties}>
        <MenuModeCtx.Provider value={{ close: () => setOpen(false) }}>{children}</MenuModeCtx.Provider>
      </div>
    </div>
  );
}
