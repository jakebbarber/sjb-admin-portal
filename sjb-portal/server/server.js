'use strict';
/* ===========================================================================
   SJB Fact Find — Node entry point.   Node 18 or newer. No dependencies.

     node server.js                       start (PORT, DATA_DIR, BASE_URL, SECRET env)
     node server.js adduser EMAIL PASS    create an adviser login
     node server.js passwd  EMAIL PASS    reset a password
     node server.js users                 list logins

   Data is plain JSON files under DATA_DIR — back that folder up and you have
   backed up everything.
   ========================================================================= */
const http=require('node:http'), fs=require('node:fs'), fsp=require('node:fs/promises');
const path=require('node:path'), os=require('node:os');
if(!globalThis.crypto) globalThis.crypto=require('node:crypto').webcrypto;

const ROOT=__dirname;
const PUBLIC=path.join(ROOT,'public');
const DATA=process.env.DATA_DIR||path.join(ROOT,'data');
const PORT=+(process.env.PORT||8080);
const BASE_URL=process.env.BASE_URL||('http://localhost:'+PORT);
const SECRET_FILE=path.join(DATA,'.secret');

fs.mkdirSync(DATA,{recursive:true});
let SECRET=process.env.SECRET;
if(!SECRET){
  if(fs.existsSync(SECRET_FILE)) SECRET=fs.readFileSync(SECRET_FILE,'utf8').trim();
  else { SECRET=require('node:crypto').randomBytes(32).toString('base64url'); fs.writeFileSync(SECRET_FILE,SECRET,{mode:0o600}); }
}

/* ------------------------------ file store ------------------------------ */
const safeId=id=>{ if(typeof id!=='string'||!/^[A-Za-z0-9_.-]{1,120}$/.test(id)) throw new Error('bad id'); return id; };
const FileStore={
  dir(col){ const d=path.join(DATA,safeId(col)); fs.mkdirSync(d,{recursive:true}); return d; },
  async get(col,id){ try{ return JSON.parse(await fsp.readFile(path.join(this.dir(col),safeId(id)+'.json'),'utf8')); }
    catch(e){ if(e.code==='ENOENT') return null; throw e; } },
  async put(col,id,obj){
    const f=path.join(this.dir(col),safeId(id)+'.json'), tmp=f+'.'+process.pid+'.tmp';
    await fsp.writeFile(tmp,JSON.stringify(obj),'utf8'); await fsp.rename(tmp,f);   /* atomic on POSIX */
  },
  async del(col,id){ try{ await fsp.unlink(path.join(this.dir(col),safeId(id)+'.json')); }catch(e){ if(e.code!=='ENOENT') throw e; } },
  async list(col){
    const d=this.dir(col); const names=(await fsp.readdir(d)).filter(n=>n.endsWith('.json'));
    const out=[]; for(const n of names){ try{ out.push(JSON.parse(await fsp.readFile(path.join(d,n),'utf8'))); }catch(e){} }
    return out;
  }
};

/* --------------------------------- mail --------------------------------- */
/* Optional. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM and
   `npm install nodemailer` to get notification emails. Without it, returned
   Fact Finds still show in the portal — you just will not get an email. */
let mail=null;
if(process.env.SMTP_HOST){
  try{
    const nodemailer=require('nodemailer');
    const t=nodemailer.createTransport({host:process.env.SMTP_HOST,port:+(process.env.SMTP_PORT||587),
      secure:process.env.SMTP_SECURE==='1',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});
    mail=async(to,subject,text)=>{ await t.sendMail({from:process.env.MAIL_FROM||process.env.SMTP_USER,to,subject,text}); };
    console.log('mail: enabled via '+process.env.SMTP_HOST);
  }catch(e){ console.log('mail: SMTP_HOST set but nodemailer is not installed — run: npm install nodemailer'); }
} else console.log('mail: not configured (portal notifications only)');

/* --------------------------------- CLI ---------------------------------- */
const APP=require('./app.js');
(async()=>{
  const [cmd,a,b]=process.argv.slice(2);
  if(cmd==='adduser'||cmd==='passwd'){
    if(!a||!b){ console.error('usage: node server.js '+cmd+' EMAIL PASSWORD'); process.exit(1); }
    if(b.length<10){ console.error('password must be at least 10 characters'); process.exit(1); }
    const users=await FileStore.list('users');
    let u=users.find(x=>x.email.toLowerCase()===a.toLowerCase());
    if(cmd==='adduser'&&u){ console.error('that user already exists — use passwd'); process.exit(1); }
    if(cmd==='passwd'&&!u){ console.error('no such user'); process.exit(1); }
    /* the first login created is the practice admin */
    u=u||{id:'u-'+require('node:crypto').randomBytes(6).toString('base64url'),email:a,name:a.split('@')[0],created:new Date().toISOString(),admin:users.length===0};
    u.hash=await APP.hashPassword(b);
    await FileStore.put('users',u.id,u);
    console.log((cmd==='adduser'?'created ':'updated ')+u.email); process.exit(0);
  }
  if(cmd==='users'){ for(const u of await FileStore.list('users')) console.log(u.email+(u.disabled?' (disabled)':'')+'  last login '+(u.lastLogin||'never')); process.exit(0); }

  /* ------------------------------- server ------------------------------- */
  const handle=APP.createApp({store:FileStore,secret:SECRET,mail,baseUrl:BASE_URL,log:(...x)=>console.log(new Date().toISOString(),...x)});
  const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
    '.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
  const sendFile=(res,file,extra)=>{
    fs.readFile(file,(e,buf)=>{
      if(e){ res.writeHead(404,{'content-type':'text/plain'}); res.end('not found'); return; }
      res.writeHead(200,Object.assign({'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream',
        'x-content-type-options':'nosniff','referrer-policy':'same-origin','x-frame-options':'DENY',
        'cache-control':'no-cache'},extra||{}));
      res.end(buf);
    });
  };
  const server=http.createServer(async(req,res)=>{
    const u=new URL(req.url,BASE_URL);
    if(u.pathname.startsWith('/api/')){
      /* adapt Node's request to a web Request and back */
      const chunks=[]; for await(const ch of req) chunks.push(ch);
      const body=chunks.length?Buffer.concat(chunks):null;
      const headers=new Headers(); for(const [k,v] of Object.entries(req.headers)) if(v!=null) headers.set(k,Array.isArray(v)?v.join(', '):v);
      const request=new Request(BASE_URL+req.url,{method:req.method,headers,body:(req.method==='GET'||req.method==='HEAD')?undefined:body});
      const response=await handle(request);
      const out={}; response.headers.forEach((v,k)=>{ out[k]=v; });
      res.writeHead(response.status,out);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if(u.pathname==='/'||u.pathname==='/index.html') return sendFile(res,path.join(PUBLIC,'app.html'));
    if(/^\/f\/[A-Za-z0-9_-]+$/.test(u.pathname)) return sendFile(res,path.join(PUBLIC,'form.html'));
    if(/^\/d\/[A-Za-z0-9_-]+$/.test(u.pathname)) return sendFile(res,path.join(PUBLIC,'docs.html'));
    const safe=path.normalize(u.pathname).replace(/^(\.\.[\/\\])+/,'');
    const file=path.join(PUBLIC,safe);
    if(!file.startsWith(PUBLIC)){ res.writeHead(403); res.end(); return; }
    sendFile(res,file);
  });
  server.listen(PORT,'127.0.0.1',()=>console.log('SJB Fact Find listening on http://127.0.0.1:'+PORT+'  (public: '+BASE_URL+')  data: '+DATA));
})().catch(e=>{ console.error(e); process.exit(1); });
