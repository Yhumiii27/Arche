// App shell: Norma 2.0's common shell (norma/charte/COQUE.md): 232 px sidebar | main, and up to 1024 px a top bar (menu
// button, tool name, language / display pair) opening the sidebar as a drawer. Demo mode: "View as" at the bottom of the
// sidebar; Entra mode: the signed-in user's account menu instead.
import { ClockProvider } from '@/components/app/clock';
import { Sidebar } from '@/components/app/shell/sidebar';
import { AppShell } from '@norma/charte/ds/AppShell';
import { ArcheTopBar } from '@/components/app/shell/topbar';
import { ArchePrefs } from '@/components/app/shell/prefs';
import { ToastProvider } from '@norma/charte/ds/Toast';
import { isRoleKey } from '@/config/roles';
import { authMode } from '@/server/auth/config';
import { businessToday } from '@/server/clock';
import { cookies } from 'next/headers';
import { PHASE_LABEL, STATUS_LABEL, labelOf } from '@/domain/capex-labels';
import { dataText } from '@/i18n/data-text';
import { isMine, visibleCapex } from '@/server/dal/capex';
import { subsidiaryChoice } from '@/server/dal/portfolio';
import { initialsOf } from '@/server/viewer';
import { DEMO_PERSONAS, getI18n, getSubsidiaryCookie, getTheme, getViewer } from '@/server/session';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const [viewer, today, jar, { t, lang }] = await Promise.all([getViewer(), businessToday(), cookies(), getI18n()]);
  const theme = await getTheme();
  const capex = (await visibleCapex(viewer)).map((c) => ({
    code: c.code,
    title: dataText(c.title, lang),
    sub: [c.subsidiaryCode, dataText(c.siteName, lang)].filter(Boolean).join(' · '),
    phase: c.status === 'active' ? t(labelOf(PHASE_LABEL, c.phase)) : t(labelOf(STATUS_LABEL, c.status)),
    mine: isMine(viewer, c),
  }));
  const folded = (jar.get('arche-nav')?.value ?? '').split(',').filter(Boolean);
  const subs = await subsidiaryChoice(viewer, await getSubsidiaryCookie());
  const entra = authMode() === 'entra';
  const personas = entra ? [] : DEMO_PERSONAS.filter((p) => isRoleKey(p.key)).map((p) => ({ role: p.key as never, name: p.name, initials: initialsOf(p.name) }));
  return (
    <ClockProvider today={today}>
      <ToastProvider>
        <AppShell
          topbar={<ArcheTopBar prefs={<ArchePrefs lang={lang} theme={theme} />} />}
          sidebar={
          <Sidebar
            role={viewer.role}
            personas={personas}
            account={entra ? { name: viewer.name, initials: viewer.initials, role: viewer.role, roles: viewer.roles } : null}
            capex={capex}
            lastCapex={jar.get('arche-capex')?.value ?? null}
            folded={folded}
            subsidiaries={subs.options.map((o) => ({ code: o.code, name: dataText(o.name, lang) }))}
            subsidiary={subs.current}
          />
          }
        >
          {children}
        </AppShell>
      </ToastProvider>
    </ClockProvider>
  );
}
