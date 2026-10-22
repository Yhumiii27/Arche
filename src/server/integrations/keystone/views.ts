// The Keystone share views Arche reads (docs/CONTRATS.md §2.1–2.2), each copied into the mirror (arche.keystone_mirror) with
// its key and the codes Arche looks rows up by. A row is kept as Keystone publishes it (French column names, dates as ISO
// strings). EPC2i's part of the engineering pack (pub_pack_ingenierie) came with delivery 5; the installed base
// (pub_parc_machines) comes with delivery 6.
export type KeystoneRow = Record<string, unknown>;

export interface KeystoneView {
  view: string;
  /** Unique key of a row within the view. */
  key: (r: KeystoneRow) => string;
  capex?: (r: KeystoneRow) => string | null;
  project?: (r: KeystoneRow) => string | null;
  need?: (r: KeystoneRow) => string | null;
}

const s = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

export const KEYSTONE_VIEWS = [
  { view: 'pub_catalogue_machines', key: (r) => `${r.code}@${r.version}` },
  { view: 'pub_reponses_besoins', key: (r) => `${r.besoin_ref}#${r.numero}`, capex: (r) => s(r.capex_code), project: (r) => s(r.projet_code), need: (r) => s(r.besoin_ref) },
  { view: 'pub_projets', key: (r) => String(r.code), capex: (r) => s(r.capex_code), project: (r) => s(r.code), need: (r) => s(r.besoin_ref) },
  { view: 'pub_jalons_projets', key: (r) => `${r.projet_code}/${r.jalon_code}`, project: (r) => s(r.projet_code) },
  { view: 'pub_avancement_projets', key: (r) => String(r.projet_code), project: (r) => s(r.projet_code) },
  { view: 'pub_avenants', key: (r) => `${r.projet_code}/${r.numero}`, project: (r) => s(r.projet_code) },
  { view: 'pub_reserves', key: (r) => `${r.projet_code}/${r.numero}`, project: (r) => s(r.projet_code) },
  { view: 'pub_livrables', key: (r) => `${r.project_code}/${r.number}`, project: (r) => s(r.project_code) },
  { view: 'pub_pack_ingenierie', key: (r) => `${r.projet_code}/${r.famille}`, project: (r) => s(r.projet_code) },
] as const satisfies readonly KeystoneView[];

export type KeystoneViewName = (typeof KEYSTONE_VIEWS)[number]['view'];
export const KEYSTONE_VIEW_NAMES = KEYSTONE_VIEWS.map((v) => v.view) as KeystoneViewName[];
