/* worker.js — the RWL Review portal.

   One Cloudflare Worker, one D1 database (case records and audit log), one R2
   bucket (the Word files). Admin staff log in, upload a Reason Why Letter,
   optionally paste the compliance email, and get back a redlined Word file
   (tracked changes) plus a draft reply to Compliance. Claude is called only
   from here, server-side, with the letter text and the email; the API key
   never reaches a browser.

   Sign-in: Cloudflare Access when ACCESS_TEAM and ACCESS_AUD are set (the
   production route: staff use their Microsoft 365 login). Otherwise a shared
   passcode (PORTAL_PASSCODE) for the sandbox. */
import APP_HTML from '../public/app.html';
import { openDocx, saveDocx, numberedText, redline } from './docx.js';
import { precheck, planEdits } from './ai.js';
import { RUBRIC } from './rubric.js';

const enc = new TextEncoder();
const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });
const page = html => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin', 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'" } });
const now = () => Date.now();
const uid = () => { const u = new Uint8Array(12); crypto.getRandomValues(u); return b64u(u); };

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg))));
}

/* ------------------------------- storage ------------------------------- */
let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) schemaReady = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, ref TEXT NOT NULL, adviser TEXT, status TEXT NOT NULL,
      created INTEGER NOT NULL, updated INTEGER NOT NULL, created_by TEXT, original_name TEXT, letter TEXT,
      findings TEXT, email TEXT, plan TEXT, result TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, at INTEGER NOT NULL, who TEXT, what TEXT NOT NULL)`)
  ]);
  return schemaReady;
}
const parse = (row, keys) => { if (!row) return null; for (const k of keys) row[k] = row[k] ? JSON.parse(row[k]) : null; return row; };
async function getCase(env, id) { return parse(await env.DB.prepare('SELECT * FROM cases WHERE id=?1').bind(id).first(), ['findings', 'plan', 'result']); }
async function setCase(env, id, fields) {
  const keys = Object.keys(fields); fields.updated = now(); keys.push('updated');
  const sets = keys.map((k, i) => k + '=?' + (i + 2)).join(',');
  const vals = keys.map(k => (typeof fields[k] === 'object' && fields[k] !== null) ? JSON.stringify(fields[k]) : fields[k]);
  await env.DB.prepare('UPDATE cases SET ' + sets + ' WHERE id=?1').bind(id, ...vals).run();
}
const log = (env, caseId, who, what) => env.DB.prepare('INSERT INTO events (case_id,at,who,what) VALUES (?1,?2,?3,?4)').bind(caseId, now(), who, what).run();

/* --------------------------------- auth -------------------------------- */
async function accessUser(request, env) {
  /* Cloudflare Access puts a signed JWT on every request it lets through. Verify it. */
  const jwt = request.headers.get('cf-access-jwt-assertion');
  if (!jwt) return null;
  const [h, p, s] = jwt.split('.');
  if (!s) return null;
  const header = JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/')));
  const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.aud !== env.ACCESS_AUD && !(Array.isArray(payload.aud) && payload.aud.includes(env.ACCESS_AUD))) return null;
  if (payload.exp * 1000 < now()) return null;
  const certs = await (await fetch('https://' + env.ACCESS_TEAM + '.cloudflareaccess.com/cdn-cgi/access/certs', { cf: { cacheTtl: 3600 } })).json();
  const jwk = (certs.keys || []).find(k => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, enc.encode(h + '.' + p));
  return ok ? (payload.email || 'access-user') : null;
}
async function sessionUser(request, env) {
  const m = /(?:^|;\s*)rwl_s=([^;]+)/.exec(request.headers.get('cookie') || '');
  if (!m) return null;
  const [name, exp, sig] = decodeURIComponent(m[1]).split('|');
  if (!sig || Number(exp) < now()) return null;
  if (await hmac(env.SESSION_SECRET || 'sandbox', name + '|' + exp) !== sig) return null;
  return name;
}
async function whoami(request, env) {
  if (env.ACCESS_TEAM && env.ACCESS_AUD) return accessUser(request, env);
  return sessionUser(request, env);
}
const LOGIN_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RWL Review — sign in</title>
<style>body{font-family:Segoe UI,system-ui,sans-serif;background:#f3f5f7;margin:0;display:grid;place-items:center;min-height:100vh;color:#1f2a33}
.c{background:#fff;padding:32px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.08);width:min(380px,92vw)}h1{font-size:20px;margin:0 0 6px}p{margin:0 0 18px;color:#5b6b78;font-size:14px}
input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cfd6dc;border-radius:8px;font-size:16px}button{margin-top:12px;width:100%;padding:12px;border:0;border-radius:8px;background:#0b5fff;color:#fff;font-size:16px;font-weight:600}
.m{color:#b00020;font-size:14px;min-height:20px;margin-top:8px}</style>
<div class="c"><h1>RWL Review</h1><p>Sandbox sign-in. In production this page is replaced by your Microsoft 365 login through Cloudflare Access.</p>
<form id="f"><label>Your name<input name="n" required autocomplete="name" placeholder="e.g. Vickey"></label><br><br><label>Team passcode<input name="p" type="password" required></label><button>Sign in</button><div class="m" id="m"></div></form></div>
<script>document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:e.target.n.value,passcode:e.target.p.value})});
if(r.ok)location.href='/';else document.getElementById('m').textContent='That passcode is not right.';});</script>`;

/* ------------------------------- handlers ------------------------------- */
async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  await ensureSchema(env.DB);

  if (path === '/api/login' && request.method === 'POST') {
    if (env.ACCESS_TEAM && env.ACCESS_AUD) return json({ error: 'Sign in through Cloudflare Access' }, 400);
    const b = await request.json().catch(() => ({}));
    if (!env.PORTAL_PASSCODE || b.passcode !== env.PORTAL_PASSCODE) return json({ error: 'wrong passcode' }, 401);
    const name = String(b.name || 'staff').slice(0, 60).replace(/[|;]/g, '');
    const exp = now() + 10 * 3600 * 1000;
    const tok = name + '|' + exp + '|' + await hmac(env.SESSION_SECRET || 'sandbox', name + '|' + exp);
    return json({ ok: true, name }, 200, { 'set-cookie': 'rwl_s=' + encodeURIComponent(tok) + '; Path=/; HttpOnly; SameSite=Lax' + (url.protocol === 'https:' ? '; Secure' : '') });
  }
  if (path === '/api/logout') return json({ ok: true }, 200, { 'set-cookie': 'rwl_s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });

  const user = await whoami(request, env);
  if (path === '/' || path === '/index.html') return page(user ? APP_HTML : LOGIN_HTML);
  if (!path.startsWith('/api/')) return new Response('Not found', { status: 404 });
  if (!user) return json({ error: 'sign in first' }, 401);

  if (path === '/api/me') return json({ name: user, mock: !!env.MOCK_AI, rubric: RUBRIC, retentionDays: Number(env.RETENTION_DAYS || 30) });

  if (path === '/api/cases' && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT id,ref,adviser,status,created,updated,created_by,original_name FROM cases ORDER BY updated DESC LIMIT 200').all();
    return json({ cases: r.results || [] });
  }
  if (path === '/api/cases' && request.method === 'POST') {
    const form = await request.formData();
    const file = form.get('file');
    const ref = String(form.get('ref') || '').trim().slice(0, 80);
    const adviser = String(form.get('adviser') || '').trim().slice(0, 80);
    if (!ref) return json({ error: 'Give the case a reference' }, 400);
    if (!file || typeof file === 'string' || !/\.docx$/i.test(file.name)) return json({ error: 'Upload the RWL as a Word .docx file' }, 400);
    if (file.size > 15 * 1024 * 1024) return json({ error: 'File is larger than 15 MB' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let letter;
    try { letter = numberedText(openDocx(bytes).xml); } catch (e) { return json({ error: 'Could not read that file: ' + e.message }, 400); }
    if (letter.length < 500) return json({ error: 'That file has almost no text in it' }, 400);
    const id = uid();
    await env.DOCS.put('cases/' + id + '/original.docx', bytes, { httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } });
    await env.DB.prepare('INSERT INTO cases (id,ref,adviser,status,created,updated,created_by,original_name,letter) VALUES (?1,?2,?3,?4,?5,?5,?6,?7,?8)')
      .bind(id, ref, adviser, 'uploaded', now(), user, file.name, letter).run();
    await log(env, id, user, 'uploaded ' + file.name + ' (' + bytes.length + ' bytes)');
    return json({ id, ref, paragraphs: letter.split('\n').length });
  }

  const m = /^\/api\/cases\/([A-Za-z0-9_-]+)(?:\/(\w+))?$/.exec(path);
  if (!m) return json({ error: 'not found' }, 404);
  const c = await getCase(env, m[1]);
  if (!c) return json({ error: 'case not found' }, 404);
  const action = m[2];

  if (!action && request.method === 'GET') {
    const ev = await env.DB.prepare('SELECT at,who,what FROM events WHERE case_id=?1 ORDER BY id').bind(c.id).all();
    return json({ ...c, events: ev.results || [] });
  }
  if (!action && request.method === 'DELETE') {
    await env.DOCS.delete(['cases/' + c.id + '/original.docx', 'cases/' + c.id + '/redlined.docx']);
    await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE case_id=?1').bind(c.id), env.DB.prepare('DELETE FROM cases WHERE id=?1').bind(c.id)]);
    return json({ ok: true });
  }
  if (action === 'precheck' && request.method === 'POST') {
    const r = await precheck(env, c.letter);
    await setCase(env, c.id, { findings: r.data, status: r.data.ready_to_submit ? 'checked-ready' : 'checked-issues' });
    await log(env, c.id, user, 'pre-check run (' + r.model + '): ' + r.data.findings.length + ' finding(s)');
    return json({ findings: r.data, usage: r.usage });
  }
  if (action === 'revise' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const email = String(b.email || '').trim();
    if (email.length < 40) return json({ error: 'Paste the compliance email first' }, 400);
    const r = await planEdits(env, c.letter, email);
    /* dry run against the real file so the admin sees what will and will not apply */
    const obj = await env.DOCS.get('cases/' + c.id + '/original.docx');
    const doc = openDocx(await obj.arrayBuffer());
    const dry = redline(doc.xml, r.data.edits, { author: env.AUTHOR });
    await setCase(env, c.id, { email, plan: r.data, status: 'edits-proposed', result: { dry: { applied: dry.applied.map(a => a.k), skipped: dry.skipped.map(s => ({ k: s.k, why: s.why })) } } });
    await log(env, c.id, user, 'compliance points mapped (' + r.model + '): ' + r.data.edits.length + ' edit(s), ' + dry.skipped.length + ' could not be placed');
    return json({ plan: r.data, dry: { applied: dry.applied.map(a => a.k), skipped: dry.skipped.map(s => ({ k: s.k, why: s.why })) }, usage: r.usage });
  }
  if (action === 'apply' && request.method === 'POST') {
    if (!c.plan) return json({ error: 'Map the compliance points first' }, 400);
    const b = await request.json().catch(() => ({}));
    const skip = new Set(b.skip || []);
    const edits = c.plan.edits.filter((e, k) => !skip.has(k));
    const obj = await env.DOCS.get('cases/' + c.id + '/original.docx');
    const doc = openDocx(await obj.arrayBuffer());
    const out = redline(doc.xml, edits, { author: env.AUTHOR });
    const bytes = saveDocx(doc, out.xml);
    await env.DOCS.put('cases/' + c.id + '/redlined.docx', bytes, { httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } });
    const result = { at: now(), insertions: out.insertions, deletions: out.deletions, applied: out.applied.length, skipped: out.skipped.map(s => ({ edit: s.edit, why: s.why })), skippedByUser: [...skip] };
    await setCase(env, c.id, { result, status: 'redlined' });
    await log(env, c.id, user, 'redline written: ' + out.applied.length + ' edit(s) as ' + out.insertions + ' insertions / ' + out.deletions + ' deletions');
    return json(result);
  }
  if (action === 'download' && request.method === 'GET') {
    const which = url.searchParams.get('which') === 'original' ? 'original' : 'redlined';
    const obj = await env.DOCS.get('cases/' + c.id + '/' + which + '.docx');
    if (!obj) return json({ error: 'no ' + which + ' file yet' }, 404);
    const base = (c.original_name || 'RWL').replace(/\.docx$/i, '');
    const name = which === 'original' ? c.original_name : base + ' - redlined.docx';
    await log(env, c.id, user, 'downloaded ' + which);
    return new Response(obj.body, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': 'attachment; filename="' + name.replace(/"/g, '') + '"', 'cache-control': 'no-store' } });
  }
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    try { return await handle(request, env, ctx); }
    catch (e) { console.log('error', e && e.stack || e); return json({ error: (e && e.message) || 'Something went wrong' }, 500); }
  },
  /* retention: client files do not live here longer than they need to */
  async scheduled(event, env) {
    await ensureSchema(env.DB);
    const cutoff = now() - Number(env.RETENTION_DAYS || 30) * 86400000;
    const old = await env.DB.prepare('SELECT id FROM cases WHERE updated < ?1').bind(cutoff).all();
    for (const row of old.results || []) {
      await env.DOCS.delete(['cases/' + row.id + '/original.docx', 'cases/' + row.id + '/redlined.docx']);
      await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE case_id=?1').bind(row.id), env.DB.prepare('DELETE FROM cases WHERE id=?1').bind(row.id)]);
    }
  }
};
