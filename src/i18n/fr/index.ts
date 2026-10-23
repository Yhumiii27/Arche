// French dictionaries, one file per area of the application (English source string → French). One French translation per
// key across the files (src/i18n/completeness.test.ts checks it).
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

const FILES: Record<string, Record<string, string>> = { admin, auth, capex, cycle, delivery, demo, dossiers, governance, needs, pilot, shell, startup, ui };

export const FR_FILES = FILES;
export const FR_DICT: Record<string, string> = Object.assign({}, ...Object.values(FILES));
