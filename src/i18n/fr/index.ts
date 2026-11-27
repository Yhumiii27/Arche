// French dictionaries, one file per area of the application (English source string → French). One French translation per
// key across the files (src/i18n/completeness.test.ts checks it).
import { TACHES_FR } from '@norma/charte/ds/taches-fr';
import admin from './admin.json';
import auth from './auth.json';
import capex from './capex.json';
import cycle from './cycle.json';
import delivery from './delivery.json';
import demo from './demo.json';
import dossiers from './dossiers.json';
import governance from './governance.json';
import needs from './needs.json';
import pilot from './pilot.json';
import shell from './shell.json';
import startup from './startup.json';
import ui from './ui.json';

const OWN: Record<string, Record<string, string>> = { admin, auth, capex, cycle, delivery, demo, dossiers, governance, needs, pilot, shell, startup, ui };

// `norma`: the French of Norma's common menu, « My tasks » and « My approvals » (Norma 2.4, charte/ds/taches-fr.ts) for the
// strings Arche does not translate itself (Arche's own French wins; a string the same in French is on same-in-french.json).
const ownKeys = new Set(Object.values(OWN).flatMap((f) => Object.keys(f)));
const norma = Object.fromEntries(Object.entries(TACHES_FR).filter(([en, fr]) => !ownKeys.has(en) && fr !== en));
const FILES: Record<string, Record<string, string>> = { ...OWN, norma };

export const FR_FILES = FILES;
export const FR_DICT: Record<string, string> = Object.assign({}, ...Object.values(FILES));
