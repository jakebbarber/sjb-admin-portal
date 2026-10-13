/* docx.js — read a Word file, hand its paragraphs to the reviewer, and write
   the agreed edits back as Word tracked changes (w:ins / w:del) under one
   author, so the adviser accepts or rejects each one in Word. Nothing is
   changed silently and the original file is never altered.

   Works in Cloudflare Workers and in Node (fflate is pure JS). */
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const AUTHOR_DEFAULT = 'RWL Review – draft for adviser';

export function openDocx(bytes) {
  const files = unzipSync(new Uint8Array(bytes));
  if (!files['word/document.xml']) throw new Error('Not a Word .docx file (no word/document.xml)');
  return { files, xml: strFromU8(files['word/document.xml']) };
}

export function saveDocx(doc, xml) {
  const out = {};
  /* [Content_Types].xml stays first in the archive, as Word writes it */
  if (doc.files['[Content_Types].xml']) out['[Content_Types].xml'] = doc.files['[Content_Types].xml'];
  for (const k of Object.keys(doc.files)) if (!out[k]) out[k] = doc.files[k];
  out['word/document.xml'] = strToU8(xml);
  return zipSync(out, { level: 6 });
}

const unesc = s => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* every <w:p> in body order, with its visible text */
export function paragraphs(xml) {
  const out = []; const re = /<w:p[ >][\s\S]*?<\/w:p>/g; let m;
  while ((m = re.exec(xml))) {
    const text = unesc((m[0].match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));
    const style = (m[0].match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || '';
    out.push({ i: out.length, start: m.index, end: m.index + m[0].length, xml: m[0], text, style });
  }
  return out;
}

/* what the reviewer sees: numbered paragraphs, empty ones dropped */
export function numberedText(xml) {
  return paragraphs(xml).filter(p => p.text.trim()).map(p => '[' + p.i + ']' + (p.style ? ' {' + p.style + '}' : '') + ' ' + p.text.trim()).join('\n');
}

const pprOf = p => (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
const firstRpr = p => { const r = /<w:r(?: [^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(p); return r ? r[1] : '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'; };
const clean = rpr => rpr.replace(/<w:highlight [^>]*\/>/g, '').replace(/<w:noProof\/>/g, '').replace(/<w:b\/>/g, '').replace(/<w:bCs\/>/g, '');
const norm = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

/* Apply a list of edits as tracked changes. Each edit:
     { op:'replace'|'insert_after'|'delete', para:<index>, anchor:<text the paragraph should contain>,
       text:<new text>, lead:<optional bold lead-in>, point:<compliance point no>, reason:<why> }
   Returns { xml, applied, skipped, insertions, deletions }. An edit whose
   paragraph no longer matches its anchor is skipped and reported, never
   applied to the wrong place. */
export function redline(xml, edits, opts = {}) {
  const author = opts.author || AUTHOR_DEFAULT;
  const date = (opts.date || new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
  let nextId = 9000; const id = () => String(nextId++);
  const ins = (text, rpr, bold) => '<w:ins w:id="' + id() + '" w:author="' + esc(author) + '" w:date="' + date + '"><w:r>'
    + (bold ? rpr.replace('<w:rPr>', '<w:rPr><w:b/>') : rpr) + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:ins>';
  const delRuns = pxml => pxml.replace(/<w:r(?: [^>]*)?>[\s\S]*?<\/w:r>/g, r => '<w:del w:id="' + id() + '" w:author="' + esc(author) + '" w:date="' + date + '">'
    + r.replace(/<w:t(\s[^>]*)?>/g, '<w:delText xml:space="preserve">').replace(/<\/w:t>/g, '</w:delText>') + '</w:del>');
  const runs = (e, rpr) => (e.lead ? ins(e.lead.replace(/\s*$/, ' '), rpr, true) : '') + ins(e.text, rpr, false);

  const applied = [], skipped = [];
  /* apply from the bottom of the document up so earlier offsets stay valid */
  const order = edits.map((e, k) => ({ e, k })).sort((a, b) => (b.e.para | 0) - (a.e.para | 0));
  for (const { e, k } of order) {
    const ps = paragraphs(xml);
    let p = ps[e.para | 0];
    const key = e.anchor ? norm(e.anchor).slice(0, 60) : '';
    const ok = p && (!key || norm(p.text).includes(key));
    if (!ok) {
      /* fall back to a unique text match anywhere in the document */
      const hits = key ? ps.filter(q => norm(q.text).includes(key)) : [];
      if (hits.length === 1) p = hits[0];
      else { skipped.push({ k, edit: e, why: hits.length > 1 ? 'anchor text appears more than once' : 'paragraph not found' }); continue; }
    }
    const rpr = clean(firstRpr(p.xml));
    let body;
    if (e.op === 'delete') {
      body = delRuns(p.xml);
      const mark = '<w:del w:id="' + id() + '" w:author="' + esc(author) + '" w:date="' + date + '"/>';
      if (/<w:pPr>[\s\S]*?<w:rPr>/.test(body)) body = body.replace(/(<w:pPr>[\s\S]*?<w:rPr>)/, '$1' + mark);
      else if (/<w:pPr>/.test(body)) body = body.replace(/<\/w:pPr>/, '<w:rPr>' + mark + '</w:rPr></w:pPr>');
      else body = body.replace(/^(<w:p[^>]*>)/, '$1<w:pPr><w:rPr>' + mark + '</w:rPr></w:pPr>');
      xml = xml.slice(0, p.start) + body + xml.slice(p.end);
    } else if (e.op === 'replace') {
      if (!e.text) { skipped.push({ k, edit: e, why: 'no replacement text' }); continue; }
      body = delRuns(p.xml).replace(/<\/w:p>$/, runs(e, rpr) + '</w:p>');
      xml = xml.slice(0, p.start) + body + xml.slice(p.end);
    } else if (e.op === 'insert_after') {
      if (!e.text) { skipped.push({ k, edit: e, why: 'no text to insert' }); continue; }
      let ppr = pprOf(p.xml).replace(/ w:rsid[A-Za-z]*="[^"]*"/g, '').replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, '');
      const mark = '<w:ins w:id="' + id() + '" w:author="' + esc(author) + '" w:date="' + date + '"/>';
      if (/<w:rPr>/.test(ppr)) ppr = ppr.replace('<w:rPr>', '<w:rPr>' + mark);
      else if (ppr) ppr = ppr.replace('</w:pPr>', '<w:rPr>' + mark + '</w:rPr></w:pPr>');
      else ppr = '<w:pPr><w:rPr>' + mark + '</w:rPr></w:pPr>';
      const paras = String(e.text).split(/\n{2,}/).filter(Boolean);
      const built = paras.map((t, n) => '<w:p>' + ppr + runs({ lead: n === 0 ? e.lead : '', text: t }, rpr) + '</w:p>').join('');
      xml = xml.slice(0, p.end) + built + xml.slice(p.end);
    } else { skipped.push({ k, edit: e, why: 'unknown operation ' + e.op }); continue; }
    applied.push({ k, edit: e });
  }
  /* sanity: every tracked-change tag balanced */
  const count = re => (xml.match(re) || []).length;
  if (count(/<w:ins /g) - count(/<w:ins [^>]*\/>/g) !== count(/<\/w:ins>/g) || count(/<w:del /g) - count(/<w:del [^>]*\/>/g) !== count(/<\/w:del>/g))
    throw new Error('tracked-change markup unbalanced; refusing to write');
  applied.sort((a, b) => a.k - b.k); skipped.sort((a, b) => a.k - b.k);
  return { xml, applied, skipped, insertions: count(/<w:ins w:id=/g), deletions: count(/<w:del w:id=/g) };
}
