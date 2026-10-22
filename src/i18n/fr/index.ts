// French dictionaries, one file per area of the application (English source string → French). One French translation per
// key across the files (src/i18n/completeness.test.ts checks it).
import admin from './admin.json';
import auth from './auth.json';
import capex from './capex.json';
import cycle from './cycle.json';
import demo from './demo.json';
import dossiers from './dossiers.json';
import needs from './needs.json';
import shell from './shell.json';
import ui from './ui.json';

const FILES: Record<string, Record<string, string>> = { admin, auth, capex, cycle, demo, dossiers, needs, shell, ui };

export const FR_FILES = FILES;
export const FR_DICT: Record<string, string> = Object.assign({}, ...Object.values(FILES));
