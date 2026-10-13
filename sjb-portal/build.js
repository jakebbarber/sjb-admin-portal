/* Cross-platform build: the same steps as build_server.ps1 then
   build_worker.ps1, in Node, so the worker can be built on Linux (GitHub
   Actions, a cloud Claude Code session) as well as on a Windows laptop.
   The two PowerShell scripts stay as they are; this must keep producing the
   same worker.js they do (only the build stamp differs).

   Usage: node build.js        (run from anywhere; paths are relative to this file)
   Then:  node checkregex.js   (run from sjb-portal/) */
const fs=require('fs'); const path=require('path');
const sp=__dirname, b=path.join(sp,'ff'), sv=path.join(sp,'server'), pub=path.join(sv,'public');
fs.mkdirSync(pub,{recursive:true});
const R=p=>fs.readFileSync(p,'utf8');
const W=(p,s)=>fs.writeFileSync(p,s,'utf8');   /* UTF-8 without BOM, like the PS1 */
const part=n=>R(n.endsWith('.js')?path.join(b,n):path.join(b,n+'.html'));
const pad=n=>String(n).padStart(2,'0');
const now=new Date(); const build=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes());
const logoRaw=R(path.join(sp,'logo_b64.txt')).trim();
const logo=logoRaw.startsWith('data:')?logoRaw:'data:image/webp;base64,'+logoRaw;
const font=R(path.join(sp,'manrope_b64.txt')).trim();
const fill=s=>s.split('__SJB_LOGO_DATA_URI__').join(logo).split('__MANROPE_B64__').join(font).split('__SJB_BUILD__').join(build);

/* ---- shared.js: the schema (w02 without its <script> line) + shared footer ---- */
const w02=part('w02').replace(/^\s*<script>\s*/,'');
const shared=fill(w02+'\r\n'+R(path.join(sv,'shared_footer.js')));
W(path.join(pub,'shared.js'),shared);

/* ---- app.html: the portal, assembled from its parts in this order ---- */
const order=['w01','w02','w03','w03s','w06_cols.js','w07','w08_cells.js','w09','w10','w04','w05','wp','wc','wr','ws','wl','wa','wrep','wreco','wtx','wadm','wrwl','wtpl','wman','wins','wfb','w99'];
const body=order.map(n=>part(n)+'\r\n').join('');
const app=fill('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">\r\n'+body+'\r\n</head></html>');
W(path.join(pub,'app.html'),app);

/* ---- form.html: the hosted client form ---- */
const w10=part('w10');
const m=/function SJB_CLIENT_APP\(CTX\)\{[\s\S]*?\n\}\n(?=\s*\n\/\* -{10,} generated-file assembly)/.exec(w10);
if(!m) throw new Error('could not extract SJB_CLIENT_APP');
const c=/return ff\+`([\s\S]*?)`;/.exec(w10);
if(!c) throw new Error('could not extract client CSS');
const form=fill(R(path.join(sv,'form_shell.html')).split('__FORM_CSS__').join(c[1]).split('__CLIENT_APP__').join(m[0]));
W(path.join(pub,'form.html'),form);

/* ---- docs.html: the client document-upload page ---- */
const docs=fill(R(path.join(sv,'docs_shell.html')).split('__FORM_CSS__').join(c[1]));
W(path.join(pub,'docs.html'),docs);

/* ---- desktop file ---- */
const order2=['w01','w02','w03','w06_cols.js','w07','w08_cells.js','w09','w10','w04','w05','w99'];
W(path.join(sp,'sjb-factfind.html'),fill(order2.map(n=>part(n)+'\r\n').join('')));

/* ---- copies for the browser test pages ---- */
fs.copyFileSync(path.join(sv,'app.js'),path.join(sp,'app.js'));
fs.copyFileSync(path.join(sv,'rwl_server.js'),path.join(sp,'rwl_server.js'));
fs.copyFileSync(path.join(pub,'shared.js'),path.join(sp,'shared.js'));

/* ---- worker.js: everything embedded as strings + the Cloudflare tail ---- */
/* same escaping as PowerShell's JavaScriptStringEncode, so the two builds stay byte-identical */
const J=s=>JSON.stringify(s).replace(/[<>&']/g,ch=>'\\u'+ch.charCodeAt(0).toString(16).padStart(4,'0'));
const worker=['/* SJB Fact Find - Cloudflare Worker. Generated file: paste the whole thing into the Worker editor. */',
  shared, R(path.join(sv,'fflate.umd.js')), R(path.join(sv,'rwl_server.js')), R(path.join(sv,'app.js')),
  'const SHARED_JS='+J(shared)+';', 'const APP_HTML='+J(app)+';', 'const FORM_HTML='+J(form)+';', 'const DOCS_HTML='+J(docs)+';',
  R(path.join(sv,'worker_tail.js'))].map(s=>s+'\r\n').join('');
W(path.join(sv,'worker.js'),worker);
fs.copyFileSync(path.join(sv,'worker.js'),path.join(sp,'worker.js'));
const kb=p=>Math.round(fs.statSync(p).size/1024)+' KB';
console.log('shared.js '+kb(path.join(pub,'shared.js'))+' · app.html '+kb(path.join(pub,'app.html'))+' · form.html '+kb(path.join(pub,'form.html'))+' · worker.js '+kb(path.join(sv,'worker.js'))+' · build '+build);
