/* Unit test for the redline engine on the fictional fixture. Run: node test/engine.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDocx, saveDocx, numberedText, paragraphs, redline } from '../src/docx.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

const bytes = fs.readFileSync(path.join(here, 'fixture-rwl.docx'));
const doc = openDocx(bytes);
const letter = numberedText(doc.xml);
ok(letter.includes('[') && letter.split('\n').length > 20, 'numbered text has paragraphs');
const idx = s => paragraphs(doc.xml).findIndex(p => p.text.includes(s));

const edits = [
  { op: 'insert_after', para: idx('We recently went through a Cashflow'), anchor: 'We recently went through a Cashflow report', lead: 'Key assumptions behind the forecast.', text: 'The continuation of consultancy income is the single largest driver of the result.\n\nIf it reduces or stops, the outcome would look materially different.', point: 1, reason: 'R3' },
  { op: 'replace', para: idx('The reason we are doing this recommendation'), anchor: 'The reason we are doing this recommendation', lead: '', text: 'The reasons for this recommendation are not about retirement income.', point: 2, reason: 'R2' },
  { op: 'delete', para: idx('Better Performance'), anchor: 'Better Performance', lead: '', text: '', point: 3, reason: 'R7' },
  { op: 'replace', para: 999, anchor: 'this text is nowhere in the letter', lead: '', text: 'x', point: 4, reason: 'should skip' },
  { op: 'replace', para: idx('Greater investment options'), anchor: 'Online access to valuations', lead: '', text: 'wrong anchor but unique elsewhere', point: 5, reason: 'falls back to the unique match' }
];
const r = redline(doc.xml, edits, { author: 'Test Author', date: new Date('2026-10-12T10:00:00Z') });
ok(r.applied.length === 4, 'four edits applied, got ' + r.applied.length);
ok(r.skipped.length === 1 && r.skipped[0].why === 'paragraph not found', 'the unplaceable edit is skipped and reported');
ok(r.insertions === 7 && r.deletions === 4, 'tracked-change counts ' + r.insertions + '/' + r.deletions);
ok(/<w:ins [^>]*w:author="Test Author"/.test(r.xml), 'author stamped');
ok(/<w:delText[^>]*>Better Performance<\/w:delText>/.test(r.xml), 'deleted text kept as delText');
ok(!/<w:del [^>]*>[^]*?<w:t[ >]/.test(r.xml.match(/<w:del [^>]*>[^]*?<\/w:del>/g).join('')), 'no live <w:t> inside a deletion');
ok(r.xml.includes('Key assumptions behind the forecast. ') && r.xml.includes('If it reduces or stops'), 'two inserted paragraphs');
/* the paragraph that was replaced by anchor fallback is the one containing "Online access" */
const after = paragraphs(r.xml);
const repl = after.find(p => p.xml.includes('wrong anchor but unique elsewhere'));
ok(repl && repl.xml.includes('Online access to valuations'), 'fallback edit landed on the unique anchor paragraph');
/* the rewritten file is a valid docx we can open again */
const out = saveDocx(doc, r.xml);
const again = openDocx(out);
ok(again.xml === r.xml, 'round trip through zip');
ok(Object.keys(again.files)[0] === '[Content_Types].xml', 'content types first in archive');
fs.writeFileSync(path.join(here, 'fixture-rwl-redlined.docx'), out);
/* the original is untouched */
ok(fs.readFileSync(path.join(here, 'fixture-rwl.docx')).equals(bytes), 'original unchanged');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
