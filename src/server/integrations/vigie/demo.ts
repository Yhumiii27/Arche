// Vigie's process safety studies of the demonstration data set (AR-033), as vigie.pub_etudes_securite would publish them: the
// milestones the group HSE declared in the demo seed (src/server/db/seed/demo.ts), now held in Vigie with their recommendations
// — the HazOp of the tomato plant with one recommendation late. Used only on the demonstration data set.
const VIGIE = process.env.NEXT_PUBLIC_VIGIE_URL?.replace(/\/+$/, '') || 'http://localhost:3200';
const link = (ref: string) => `${VIGIE}/securite-procedes?etude=${encodeURIComponent(ref)}`;

type Row = Record<string, unknown>;
const study = (ref: string, capex: string, jalon: string, type: string, statut: string, o: Partial<Row> = {}): Row => ({
  etude_ref: ref, capex_code: capex, projet_code: null, jalon, type, statut, seance_le: null, conclue_le: null, conclusion: null, animateur: 'Hélène Marchal',
  rapport_ref: null, recommandations: 0, recommandations_ouvertes: 0, recommandations_en_retard: 0, reserves_bloquantes: 0, lien: link(ref), maj_le: '2026-10-22T08:00:00Z', ...o,
});

export function demoStudies(): Row[] {
  return [
    // CPX-APM-2025-01, ageing oven: in ramp-up, every study validated.
    study('ESP-APM-0007', 'CPX-APM-2025-01', 'HS2', 'hazid', 'validee', { seance_le: '2025-04-24', conclue_le: '2025-05-02', conclusion: 'favorable', rapport_ref: 'NOT-CPX-APM-2025-01-001', recommandations: 6 }),
    study('ESP-APM-0011', 'CPX-APM-2025-01', 'HS3', 'hazop', 'validee', { seance_le: '2025-08-12', conclue_le: '2025-08-28', conclusion: 'reserves', rapport_ref: 'NOT-CPX-APM-2025-01-004', recommandations: 14, recommandations_ouvertes: 1 }),
    study('ESP-APM-0019', 'CPX-APM-2025-01', 'HS4', 'controle_chantier', 'validee', { seance_le: '2026-05-28', conclue_le: '2026-06-02', conclusion: 'favorable', rapport_ref: 'NOT-CPX-APM-2025-01-007', recommandations: 3 }),
    study('ESP-APM-0022', 'CPX-APM-2025-01', 'PSSR', 'pssr', 'validee', { seance_le: '2026-06-24', conclue_le: '2026-06-26', conclusion: 'favorable', rapport_ref: 'NOT-CPX-APM-2025-01-009', recommandations: 5 }),
    // CPX-APM-2026-01, extrusion line: HazID validated, HazOp planned.
    study('ESP-APM-0031', 'CPX-APM-2026-01', 'HS2', 'hazid', 'validee', { seance_le: '2026-04-28', conclue_le: '2026-05-05', conclusion: 'favorable', rapport_ref: 'NOT-CPX-APM-2026-01-002', recommandations: 8, recommandations_ouvertes: 2 }),
    study('ESP-APM-0036', 'CPX-APM-2026-01', 'HS3', 'hazop', 'planifiee', { seance_le: '2026-11-17' }),
    // CPX-SAI-2026-01, tomato plant: HazID and HazOp validated (one HazOp recommendation late), site inspections under way.
    study('ESP-SAI-0004', 'CPX-SAI-2026-01', 'HS2', 'hazid', 'validee', { seance_le: '2026-01-08', conclue_le: '2026-01-12', conclusion: 'favorable', rapport_ref: 'NOT-CPX-SAI-2026-01-004', recommandations: 7 }),
    study('ESP-SAI-0009', 'CPX-SAI-2026-01', 'HS3', 'hazop', 'validee', { seance_le: '2026-06-09', conclue_le: '2026-06-20', conclusion: 'reserves', rapport_ref: 'NOT-CPX-SAI-2026-01-009', recommandations: 19, recommandations_ouvertes: 4, recommandations_en_retard: 1 }),
    study('ESP-SAI-0010', 'CPX-SAI-2026-01', 'HS3', 'amdec', 'validee', { seance_le: '2026-06-16', conclue_le: '2026-06-20', conclusion: 'favorable', rapport_ref: 'NOT-CPX-SAI-2026-01-010', recommandations: 9, recommandations_ouvertes: 1 }),
    study('ESP-SAI-0015', 'CPX-SAI-2026-01', 'HS4', 'controle_chantier', 'realisee', { seance_le: '2026-10-07', recommandations: 2, recommandations_ouvertes: 2 }),
  ];
}
