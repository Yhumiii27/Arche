'use client';
// Client islands of the Server Functions: a form, a button and a "reason" form, each showing the translated result. The
// Server Functions do every check again; these only collect the input. A form placed in a panel (`Folded`: a button that
// opens a side panel) closes it once its Server Function succeeds.
import { NotePencil, Plus } from '@phosphor-icons/react/dist/ssr';
import { createContext, useActionState, useContext, useEffect, useState, useTransition, type ReactNode } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ds/Button';
import { Drawer } from '@/components/ds/Drawer';
import { showToast } from '@/components/ds/Toast';
import { useI18n } from '@/i18n/client';
import s from './ActionForm.module.css';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type FormAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export function Result({ state, done }: { state: ActionResult | null; done: string }) {
  const { t } = useI18n();
  if (!state) return null;
  return state.ok ? <span className={s.done} role="status">{t(done)}</span> : <span className={s.error} role="alert">{t(state.error)}</span>;
}

/** A form submitted to its Server Function (React resets its uncontrolled fields after a submit). */
export function ActionForm({ action, submit, done, children, inline, variant = 'primary' }: {
  action: FormAction; submit: string; done: string; children?: ReactNode; inline?: boolean; variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState(action, null);
  const closePanel = useContext(PanelCtx);
  useEffect(() => {
    if (!state?.ok || !closePanel) return;
    closePanel();
    showToast(t(done));
  }, [state, closePanel, t, done]);
  return (
    <form action={run} className={inline ? s.inline : s.form}>
      {children}
      <div className={s.actions}>
        <Button type="submit" variant={variant} size={inline ? 'sm' : undefined} disabled={pending}>
          {t(submit)}
        </Button>
        <Result state={state} done={done} />
      </div>
    </form>
  );
}

/** A button calling a Server Function without input. */
export function ActionButton({ run, label, done, variant = 'secondary' }: { run: () => Promise<ActionResult>; label: string; done: string; variant?: 'primary' | 'secondary' | 'ghost' }) {
  const { t } = useI18n();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className={s.inline}>
      <Button variant={variant} size="sm" disabled={pending} onClick={() => start(async () => setState(await run()))}>
        {t(label)}
      </Button>
      <Result state={state} done={done} />
    </span>
  );
}

const PanelCtx = createContext<(() => void) | null>(null);

const CREATE = /^(Add|New|Enter|Record|Name|Attach|Create)\b/;

/**
 * An action that opens a side panel: the button (labelled `summary`, a creation gets a "+") and, once clicked, the panel
 * holding the form; the form closes it when its Server Function succeeds. `variant="primary"` for a page's main action.
 */
export function Folded({ summary, children, open, variant = 'secondary', size = 'sm', title }: {
  summary: string; children: ReactNode; open?: boolean; variant?: ButtonVariant; size?: ButtonSize;
  /** Panel title (EN source string), when it differs from the button. */
  title?: string;
}) {
  const { t } = useI18n();
  const [isOpen, setOpen] = useState(!!open);
  const icon = CREATE.test(summary) ? Plus : /^Edit\b/.test(summary) ? NotePencil : undefined;
  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {t(summary)}
      </Button>
      <Drawer open={isOpen} onClose={() => setOpen(false)} title={t(title ?? summary)}>
        <PanelCtx.Provider value={() => setOpen(false)}>{children}</PanelCtx.Provider>
      </Drawer>
    </>
  );
}
