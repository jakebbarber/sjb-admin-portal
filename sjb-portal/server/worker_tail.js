
/* ===========================================================================
   CLOUDFLARE WORKER — everything above is the shared schema, the application
   and the three pages embedded as strings. This tail wires them to Cloudflare:
   a D1 database for storage, a one-time /setup page for the first login, and
   plain routing. Bindings expected: DB (D1), SECRET (secret), optional
   SETUP_CODE, RESEND_API_KEY, MAIL_FROM, BASE_URL (vars).
   ========================================================================= */
class D1Store{
  constructor(db){ this.db=db; this.ready=null; }
  init(){
    if(!this.ready) this.ready=this.db.prepare(
      'CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, updated INTEGER, PRIMARY KEY(col,id))').run();
    return this.ready;
  }
  async get(col,id){ await this.init();
    const r=await this.db.prepare('SELECT body FROM docs WHERE col=?1 AND id=?2').bind(col,id).first();
    return r?JSON.parse(r.body):null; }
  async put(col,id,obj){ await this.init();
    await this.db.prepare('INSERT INTO docs (col,id,body,updated) VALUES (?1,?2,?3,?4) ON CONFLICT(col,id) DO UPDATE SET body=excluded.body, updated=excluded.updated')
      .bind(col,id,JSON.stringify(obj),Date.now()).run(); }
  async del(col,id){ await this.init(); await this.db.prepare('DELETE FROM docs WHERE col=?1 AND id=?2').bind(col,id).run(); }
  async list(col){ await this.init();
    const r=await this.db.prepare('SELECT body FROM docs WHERE col=?1').bind(col).all();
    return (r.results||[]).map(x=>JSON.parse(x.body)); }
}
/* Cloudflare has no outbound SMTP; Resend's free tier (3,000 emails/month)
   is the simplest way to get notifications. Optional. */
async function sendMail(env,to,subject,text){
  if(!env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails',{method:'POST',
    headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},
    body:JSON.stringify({from:env.MAIL_FROM||'SJB Fact Find <onboarding@resend.dev>',to:[to],subject,text})});
}
const PBKDF2_ITER=12000;   /* keeps password hashing inside the free tier's 10 ms CPU budget */
/* Workers AI drafts the narrative sections. Bind `AI` in the Worker's settings
   to switch it on; without the binding the buttons simply say it is off and
   the adviser writes the text themselves. */
const AI_MODEL='@cf/meta/llama-3.1-8b-instruct';
async function runAI(env,system,user,opts){
  if(!env.AI) throw new Error('no AI binding');
  opts=opts||{};
  const ask=model=>env.AI.run(model,{
    messages:[{role:'system',content:system},{role:'user',content:user}],
    max_tokens:opts.max_tokens||900,temperature:opts.temperature!=null?opts.temperature:0.3
  });
  const base=env.AI_MODEL||AI_MODEL;
  let r;
  /* A prompt may ask for a stronger model. If that one is unavailable the
     ordinary model still answers, rather than the feature simply failing. */
  if(opts.model&&opts.model!==base){
    try{ r=await ask(opts.model); }catch(e){ console.log('model fallback',opts.model,e&&e.message); r=await ask(base); }
  } else r=await ask(base);
  const t=r&&(r.response!=null?r.response:r.result);
  /* some models hand back parsed JSON rather than a string */
  return t==null?'':(typeof t==='string'?t:JSON.stringify(t));
}
const page=(html,status)=>new Response(html,{status:status||200,headers:{'content-type':'text/html; charset=utf-8',
  'cache-control':'no-cache','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'}});
const SETUP_HTML='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
+'<title>SJB Fact Find — first-time setup</title><style>body{font-family:Segoe UI,system-ui,sans-serif;background:#F2F5F7;margin:0;display:grid;place-items:center;min-height:100vh}'
+'.c{background:#fff;border:1px solid #E2E8EB;border-radius:14px;padding:28px;width:min(420px,92vw)}h1{font-size:20px;margin:0 0 6px}p{color:#67787F;font-size:14px;margin:0 0 16px}'
+'label{display:block;font-size:12px;font-weight:700;color:#41525C;margin:10px 0 4px}input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #E2E8EB;border-radius:9px;font:inherit}'
+'button{margin-top:16px;width:100%;padding:11px;border:0;border-radius:9px;background:#F47920;color:#fff;font:inherit;font-weight:800;cursor:pointer}.m{margin-top:12px;font-size:13px;color:#C0392B}</style>'
+'<div class="c"><h1>Create your adviser login</h1><p>This page works once, for the first login only. After that it is switched off.</p>'
+'<form id="f"><label>Your email</label><input id="e" type="email" required autocomplete="username">'
+'<label>Password (10+ characters)</label><input id="p" type="password" required minlength="10" autocomplete="new-password">'
+'<label>Setup code (from your Cloudflare settings, if you set one)</label><input id="k" type="text" autocomplete="off">'
+'<button type="submit">Create login</button><div class="m" id="m"></div></form></div>'
+'<script>document.getElementById("f").addEventListener("submit",async e=>{e.preventDefault();const m=document.getElementById("m");m.textContent="Creating…";'
+'const r=await fetch("/api/setup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:e.target.e.value,password:e.target.p.value,code:e.target.k.value})});'
+'const j=await r.json().catch(()=>({}));if(r.ok){location.href="/";}else m.textContent=j.error||"Could not create the login.";});</script>';

let APP=null;
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const store=new D1Store(env.DB);
    if(!APP) APP=createApp({store,secret:env.SECRET||'change-me',baseUrl:env.BASE_URL||url.origin,
      mail:(to,s,t)=>sendMail(env,to,s,t),log:(...a)=>console.log(...a),pbkdf2Iterations:PBKDF2_ITER,
      ai:env.AI?((system,user,opts)=>runAI(env,system,user,opts)):null,
      /* RWL Review: Claude via the API key; MOCK_AI=1 runs the sandbox without one */
      claudeKey:env.ANTHROPIC_API_KEY||'',claudeModel:env.CLAUDE_MODEL||'',mockAI:!!env.MOCK_AI,
      fflate:globalThis.fflate||null,rwlAuthor:env.RWL_AUTHOR||''});
    /* one-time setup: only while no adviser login exists */
    if(url.pathname==='/api/setup'&&request.method==='POST'){
      const users=await store.list('users');
      if(users.length) return new Response(JSON.stringify({error:'Setup has already been completed.'}),{status:410,headers:{'content-type':'application/json'}});
      let body={}; try{ body=await request.json(); }catch(e){}
      if(env.SETUP_CODE&&String(body.code||'')!==env.SETUP_CODE) return new Response(JSON.stringify({error:'Setup code is wrong.'}),{status:403,headers:{'content-type':'application/json'}});
      const email=String(body.email||'').trim(), pw=String(body.password||'');
      if(!/@/.test(email)||pw.length<10) return new Response(JSON.stringify({error:'Enter a valid email and a password of 10+ characters.'}),{status:400,headers:{'content-type':'application/json'}});
      /* the first login is the practice admin: manages advisers, inherits any pre-ownership records */
      const u={id:'u-'+randomToken(6),email,name:email.split('@')[0],created:new Date().toISOString(),admin:true,hash:await hashPassword(pw,null,PBKDF2_ITER)};
      await store.put('users',u.id,u);
      return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});
    }
    if(url.pathname==='/setup'){
      const users=await store.list('users');
      return users.length?page('<p style="font-family:system-ui;padding:40px">Setup is already complete. <a href="/">Go to the portal</a>.</p>',410):page(SETUP_HTML);
    }
    /* Diagnostics: /api/diag?code=<SETUP_CODE> — counts per collection plus a
       live write/read/delete round-trip against D1, so a broken binding or a
       silent storage fault shows up here instead of as a vague client error. */
    if(url.pathname==='/api/diag'){
      if(!env.SETUP_CODE||url.searchParams.get('code')!==env.SETUP_CODE) return new Response('forbidden',{status:403});
      const out={time:new Date().toISOString(),bindings:{DB:!!env.DB,SECRET:!!env.SECRET,BASE_URL:env.BASE_URL||'(using request origin: '+url.origin+')'}};
      try{
        const probe={t:Date.now()};
        await store.put('diag','probe',probe);
        const back=await store.get('diag','probe');
        await store.del('diag','probe');
        out.roundTrip=back&&back.t===probe.t?'ok':'MISMATCH '+JSON.stringify(back);
        for(const col of ['users','clients','forms','submissions']){
          const rows=await store.list(col);
          out[col]=rows.length;
          if(col==='forms') out.formTokens=rows.map(f=>({token:String(f.token).slice(0,8)+'…',len:String(f.token).length,client:f.clientId,expired:f.expires<Date.now(),submitted:!!f.submittedAt}));
        }
      }catch(e){ out.error=String(e&&e.message||e); }
      return new Response(JSON.stringify(out,null,1),{headers:{'content-type':'application/json'}});
    }
    if(url.pathname.startsWith('/api/')) return APP(request);
    if(url.pathname==='/'||url.pathname==='/index.html') return page(APP_HTML);
    if(/^\/f\/[A-Za-z0-9_-]+$/.test(url.pathname)) return page(FORM_HTML);
    if(/^\/d\/[A-Za-z0-9_-]+$/.test(url.pathname)) return page(DOCS_HTML);
    if(url.pathname==='/shared.js') return new Response(SHARED_JS,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'public, max-age=3600'}});
    if(url.pathname==='/health') return new Response('ok');
    return page('<p style="font-family:system-ui;padding:40px">Not found.</p>',404);
  }
};
