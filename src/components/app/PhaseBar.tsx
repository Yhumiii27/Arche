// The DIG-PRODI cycle of a CAPEX at a glance: four bars (phases 1 to 4), passed, current or to come; a draft shows none lit.
import { PHASES } from '@/domain/lifecycle';
import { cx } from '@/components/ds/cx';
import s from './PhaseBar.module.css';

export function PhaseBar({ status, phase, label }: { status: string; phase: string; label: string }) {
  const n = status === 'draft' ? 0 : PHASES.indexOf(phase as (typeof PHASES)[number]) + 1;
  const closed = status === 'closed';
  return (
    <span className={s.bar}>
      {PHASES.map((p, i) => (
        <span key={p} aria-hidden className={cx(s.step, (closed || i + 1 < n) && s.done, !closed && i + 1 === n && s.now)} />
      ))}
      <span className={s.label}>{label}</span>
    </span>
  );
}
