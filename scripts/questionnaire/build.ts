// Product owner's questionnaire: renders ./questions.json (generated from docs/DECISIONS.md, kept in step with it) into the
// self-contained page published as the "Décisions Arche" artifact. Answers live in the artifact's database (collection
// `answers`, one document per question id: { choice, note, updatedAt }), read back with the ArtifactData tool.
//   npx tsx scripts/questionnaire/build.ts [-- <html output path>]   (default: .artifacts/decisions-arche.html, gitignored)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, '.artifacts', 'decisions-arche.html'));
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8')) as { id: string }[];
const ids = new Set<string>();
for (const q of questions) {
  if (ids.has(q.id)) throw new Error(`duplicate question ${q.id}`);
  ids.add(q.id);
}
const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const html = fs
  .readFileSync(path.join(__dirname, 'page.template.html'), 'utf8')
  .replace('__QUESTIONS__', JSON.stringify(questions).replace(/<\//g, '<\\/'))
  .replace('__UPDATED__', `mis à jour le ${today}`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`${questions.length} questions → ${path.relative(ROOT, OUT)}`);
