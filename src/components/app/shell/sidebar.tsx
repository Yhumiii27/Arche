'use client';
// Sidebar (derived from Keystone's shell, docs/spec/08): brand, page search (⌘K), fixed entries, then the Steering, CAPEX and
// Administration sections — collapsible, their entries grouped by theme. The CAPEX section is always there with the CAPEX
// switcher (Keystone's project switcher: my CAPEX / my whole scope, search); its entries point at the CAPEX of the URL, else
// the last one used (cookie arche-capex). At the bottom the "View as" switcher (demo mode) or the account menu (Entra mode),
// then the language toggle.
import { CaretDown, CaretRight, CaretUpDown, Check, Eye, FolderOpen, MagnifyingGlass, Polygon, SignOut, Translate } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/components/ds/cx';
import { Segmented } from '@/components/ds/Segmented';
import { ROLE_LABEL, type RoleKey } from '@/config/roles';
import { SCREEN_ICONS } from '@/config/screen-icons';
import { AUTH_PATHS } from '@/domain/auth';
import { useI18n } from '@/i18n/client';
import { setLang, setViewAs, switchRole } from '@/server/actions/preferences';
import { buildNav, swapCapexInPath, type NavEntry } from './nav-model';
import picker from './header.module.css';
import styles from './sidebar.module.css';

export interface SidebarPersona {
  role: RoleKey;
  name: string;
  initials: string;
}

export interface SidebarAccount {
  name: string;
  initials: string;
  role: RoleKey;
  roles: RoleKey[];
}

/** A CAPEX of the switcher, labels already displayed (typed text shown as typed). */
export interface CapexOption {
  code: string;
  title: string;
  /** "APM · Kénitra plant". */
  sub: string;
  /** Translated phase or status. */
  phase: string;
  /** On the viewer's own CAPEX (named on it, sponsor or lead). */
  mine: boolean;
}

export interface SidebarProps {
  role: RoleKey;
  /** Demo mode: one persona per profile. */
  personas: SidebarPersona[];
  /** Entra mode: the signed-in user. */
  account: SidebarAccount | null;
  /** The CAPEX the viewer sees. */
  capex: CapexOption[];
  /** Last CAPEX used (cookie arche-capex), if still visible. */
  lastCapex: string | null;
  /** Sections folded by the viewer (cookie arche-nav). */
  folded: string[];
}

const YEAR = 60 * 60 * 24 * 365;
const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
};

/** Closes a popover on an outside click and on Escape. */
function useDismiss(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);
  return ref;
}

export function Sidebar({ role, personas, account, capex, lastCapex, folded: initialFolded }: SidebarProps) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const known = new Set(capex.map((c) => c.code));
  // Without a CAPEX in the URL: the last one used, else the viewer's first own CAPEX, else the first one they see.
  const fallback = (lastCapex && known.has(lastCapex) ? lastCapex : null) ?? capex.find((c) => c.mine)?.code ?? capex[0]?.code ?? null;
  const nav = buildNav(role, pathname, fallback);
  const [, startTransition] = useTransition();
  const [folded, setFolded] = useState<string[]>(initialFolded);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // The CAPEX of the URL becomes the last one used.
  useEffect(() => {
    if (nav.capex && known.has(nav.capex) && nav.capex !== lastCapex) setCookie('arche-capex', nav.capex);
  });

  // ⌘K / Ctrl+K focuses the page search.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (key: string) => {
    const next = folded.includes(key) ? folded.filter((k) => k !== key) : [...folded, key];
    setFolded(next);
    setCookie('arche-nav', next.join(','));
  };

  const all = useMemo(() => [...nav.fixed, ...nav.sections.flatMap((s) => s.groups.flatMap((g) => g.entries.map((e) => ({ ...e, section: s.label }))))], [nav]);
  const query = q.trim().toLowerCase();
  const hits = query ? all.filter((e) => e.href && (t(e.label).toLowerCase().includes(query) || e.label.toLowerCase().includes(query))).slice(0, 12) : [];
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setQ('');
    else if (e.key === 'Enter' && hits[0]?.href) {
      router.push(hits[0].href);
      setQ('');
    }
  };

  const entry = (n: NavEntry, item: boolean) => {
    const Icon = SCREEN_ICONS[n.id] ?? Eye;
    const inner = (
      <>
        <Icon size={16} className={styles.icon} />
        <span className={styles.label}>{t(n.label)}</span>
      </>
    );
    return n.href ? (
      <Link key={n.id} href={n.href} className={cx(styles.entry, item && styles.item, n.active && styles.active)} aria-current={n.active ? 'page' : undefined}>
        {inner}
      </Link>
    ) : (
      <span key={n.id} className={cx(styles.entry, item && styles.item, styles.disabled)} aria-disabled="true" title={t('Choose a CAPEX first')}>
        {inner}
      </span>
    );
  };

  return (
    <aside className={styles.aside} aria-label={t('Main menu')}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <Polygon size={15} />
        </div>
        <div className={styles.wordmark}>Arche</div>
      </div>
      <div className={styles.search}>
        <MagnifyingGlass size={13} className={styles.searchIcon} />
        <input
          ref={searchRef}
          className={cx('input', styles.searchInput)}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder={t('Go to a page…')}
          aria-label={t('Go to a page…')}
        />
        <span className={styles.kbd}>⌘K</span>
      </div>
      {query ? (
        <div className={styles.list}>
          {hits.map((n) => {
            const Icon = SCREEN_ICONS[n.id] ?? Eye;
            return (
              <Link key={n.id} href={n.href!} onClick={() => setQ('')} className={cx(styles.entry, styles.hit, n.active && styles.active)}>
                <Icon size={16} className={styles.icon} />
                <span className={styles.hitText}>
                  <span className={styles.hitLabel}>{t(n.label)}</span>
                  <span className={styles.hitSection}>{'section' in n ? t(n.section as string) : ''}</span>
                </span>
              </Link>
            );
          })}
          {!hits.length && <span className={styles.empty}>{t('No page matches')}</span>}
        </div>
      ) : (
        <>
          <div className={styles.list}>{nav.fixed.map((n) => entry(n, false))}</div>
          <div className={styles.sections}>
            {nav.sections.map((sec) => {
              const open = !folded.includes(sec.key) || sec.active;
              const Chev = open ? CaretDown : CaretRight;
              return (
                <div key={sec.key} className={styles.section}>
                  <button type="button" className={cx(styles.secHead, styles.bright)} onClick={() => toggle(sec.key)} aria-expanded={open}>
                    <Chev size={11} className={styles.icon} />
                    <span className={styles.label}>{t(sec.label)}</span>
                    {!open && <span className={styles.secCount}>{sec.groups.reduce((n, g) => n + g.entries.length, 0)}</span>}
                  </button>
                  {open && sec.key === 'capex' && <CapexSwitcher options={capex} current={nav.capex} />}
                  {open &&
                    sec.groups.map((g) => (
                      <div key={g.label ?? '-'} className={styles.groupBlock}>
                        {g.label && (
                          <div className={styles.group} role="presentation">
                            <span className={styles.groupLabel}>{t(g.label)}</span>
                            <span className={styles.rule} />
                          </div>
                        )}
                        {g.entries.map((n) => entry(n, true))}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </>
      )}
      <button
        type="button"
        className={cx(styles.entry)}
        onClick={() => startTransition(() => setLang(lang === 'fr' ? 'en' : 'fr'))}
        aria-label={t('Switch language')}
      >
        <Translate size={16} className={styles.icon} />
        <span className={styles.label}>{lang === 'fr' ? 'English' : 'Français'}</span>
      </button>
      {account ? <AccountMenu account={account} /> : <ViewAs role={role} personas={personas} />}
    </aside>
  );
}

/** CAPEX switcher (Keystone's project switcher): my CAPEX or my whole scope, search, the same page of the chosen CAPEX. */
function CapexSwitcher({ options, current }: { options: CapexOption[]; current: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mineCount = options.filter((o) => o.mine).length;
  const [scope, setScope] = useState<'mine' | 'all'>(mineCount ? 'mine' : 'all');
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});
  // The menu is wider than the sidebar: it opens in a layer of the page, next to the button.
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ position: 'fixed', top: r.bottom + 4, left: r.left, width: 440, maxHeight: `calc(100vh - ${Math.round(r.bottom) + 16}px)`, overflow: 'auto' });
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!ref.current?.contains(n) && !menuRef.current?.contains(n)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const cur = options.find((o) => o.code === current) ?? null;
  const query = q.trim().toLowerCase();
  const shown = options.filter((o) => (query ? `${o.code} ${o.title} ${o.sub}`.toLowerCase().includes(query) : scope === 'all' || o.mine));
  const pick = (code: string) => {
    setOpen(false);
    setQ('');
    if (code !== current) router.push(swapCapexInPath(pathname, code));
  };
  return (
    <div ref={ref} className={styles.capexPick}>
      <button type="button" className={styles.capexBtn} onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <FolderOpen size={14} className={picker.accentIcon} />
        <span className={styles.capexWho}>
          <span className={styles.capexCode}>{cur ? cur.code : t('Choose a CAPEX')}</span>
          {cur && <span className={styles.capexTitle}>{cur.title}</span>}
        </span>
        <CaretDown size={12} className={picker.mutedIcon} />
      </button>
      {open &&
        createPortal(
        <div ref={menuRef} className={cx('elev-md', picker.pickMenu, styles.capexMenu)} style={pos}>
          <div className={picker.menuHead}>{t('Switch CAPEX')}</div>
          {mineCount > 0 && (
            <Segmented
              className={picker.pickSeg}
              fullWidth
              value={scope}
              onChange={(v) => {
                setScope(v);
                setQ('');
              }}
              options={[
                { value: 'mine' as const, label: t('My CAPEX'), count: mineCount },
                { value: 'all' as const, label: t('My whole scope'), count: options.length },
              ]}
            />
          )}
          <div className={picker.pickSearch}>
            <MagnifyingGlass size={13} className={picker.pickSearchIcon} />
            <input className={cx('input', picker.pickInput)} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search a code or a title…')} aria-label={t('Search a code or a title…')} autoFocus />
          </div>
          {shown.map((o) => (
            <button key={o.code} type="button" aria-current={o.code === current ? 'true' : undefined} className={cx(picker.pickOpt, o.code === current && picker.pickOptOn)} onClick={() => pick(o.code)}>
              <span className={picker.stack}>
                <span className={picker.ellipsis}>{`${o.code} · ${o.title}`}</span>
                <span className={picker.optSub}>{o.sub}</span>
              </span>
              <span className={picker.optRight}>
                <span className="tag tag-neutral">{o.phase}</span>
              </span>
            </button>
          ))}
          {!shown.length && <span className={picker.menuEmpty}>{t('No CAPEX in this scope')}</span>}
        </div>,
          document.body,
        )}
    </div>
  );
}

/** "View as" profile switcher of the demo mode. */
function ViewAs({ role, personas }: { role: RoleKey; personas: SidebarPersona[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useDismiss(open, setOpen);
  const viewer = personas.find((p) => p.role === role) ?? personas[0];
  if (!viewer) return null;
  return (
    <div ref={ref} className={styles.viewAs}>
      {open && (
        <div className={cx('elev-md', styles.menu)} role="menu">
          <div className={styles.menuHead}>{t('View as')}</div>
          {personas.map((p) => (
            <button
              key={p.role}
              type="button"
              role="menuitemradio"
              aria-checked={p.role === role}
              className={cx(styles.persona, p.role === role && styles.personaOn)}
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  await setViewAs(p.role);
                });
              }}
            >
              <span className={styles.avatarSm}>{p.initials}</span>
              <span className={styles.who}>
                <span className={styles.whoName}>{p.name}</span>
                <span className={styles.whoRole}>{t(ROLE_LABEL[p.role])}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <div className={styles.avatar}>{viewer.initials}</div>
        <div className={styles.who}>
          <span className={styles.triggerName}>{viewer.name}</span>
          <span className={styles.whoRole}>{t(ROLE_LABEL[viewer.role])}</span>
        </div>
        <CaretUpDown className={styles.caret} />
      </button>
    </div>
  );
}

/** Account menu of the signed-in user: active role among the roles held, sign out. */
function AccountMenu({ account }: { account: SidebarAccount }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref} className={styles.viewAs}>
      {open && (
        <div className={cx('elev-md', styles.menu)} role="menu">
          {account.roles.length > 1 && <div className={styles.menuHead}>{t('Active role')}</div>}
          {account.roles.length > 1 &&
            account.roles.map((r) => (
              <button
                key={r}
                type="button"
                role="menuitemradio"
                aria-checked={r === account.role}
                className={cx(styles.persona, r === account.role && styles.personaOn)}
                onClick={() => {
                  setOpen(false);
                  startTransition(async () => {
                    await switchRole(r);
                  });
                }}
              >
                <span className={styles.who}>
                  <span className={styles.whoName}>{t(ROLE_LABEL[r])}</span>
                </span>
                {r === account.role && <Check size={14} className={styles.roleCheck} />}
              </button>
            ))}
          {account.roles.length > 1 && <div className={styles.menuSep} />}
          <form method="post" action={AUTH_PATHS.signOut} className={styles.signOutForm}>
            <button type="submit" className={styles.persona}>
              <SignOut size={14} />
              <span className={styles.whoName}>{t('Sign out')}</span>
            </button>
          </form>
        </div>
      )}
      <button type="button" className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <div className={styles.avatar}>{account.initials}</div>
        <div className={styles.who}>
          <span className={styles.triggerName}>{account.name}</span>
          <span className={styles.whoRole}>{t(ROLE_LABEL[account.role])}</span>
        </div>
        <CaretUpDown className={styles.caret} />
      </button>
    </div>
  );
}
