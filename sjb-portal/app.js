'use strict';
/* ===========================================================================
   SJB Fact Find — server application.

   Written against the web-standard Request/Response API so the same code runs
   under Node (server.js adapts it) and can be exercised in a browser for
   testing. No framework, no dependencies.

   createApp({store, secret, mail, baseUrl, log}) -> async (Request) => Response

   store: { get(col,id), put(col,id,obj), del(col,id), list(col) }   all async
   mail:  async (to, subject, text) => void    (optional)
   ========================================================================= */
const SHARED=(typeof module!=='undefined'&&typeof require==='function')?require('./public/shared.js'):globalThis.SJB_SHARED;

const enc=new TextEncoder(), dec=new TextDecoder();
const b64u=bytes=>{ let s=''; for(const b of bytes) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64u=s=>{ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  const bin=atob(s); const out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; };
const randomToken=(n)=>b64u(crypto.getRandomValues(new Uint8Array(n||24)));
const newId=p=>(p||'id')+'-'+Date.now().toString(36)+'-'+randomToken(6);

async function hmac(secret,msg){
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(msg))));
}
async function hashPassword(pw,saltB64,iter){
  const salt=saltB64?unb64u(saltB64):crypto.getRandomValues(new Uint8Array(16));
  const iterations=iter||150000;
  const key=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
  return 'pbkdf2$'+iterations+'$'+b64u(salt)+'$'+b64u(new Uint8Array(bits));
}
async function verifyPassword(pw,stored){
  const p=String(stored||'').split('$'); if(p.length!==4||p[0]!=='pbkdf2') return false;
  const again=await hashPassword(pw,p[2],+p[1]);
  return again===stored;
}

/* ===========================================================================
   Drafting assistant prompts.

   These produce a FIRST DRAFT for the adviser to edit — never a final word.
   The house rules below keep the output usable in a regulated file: plain
   English, no invented facts, no promises about performance, and the adviser's
   own recorded words preferred over anything the model would rather say.
   ========================================================================= */
const AI_HOUSE=
 'You draft text for a UK-regulated financial adviser at SJB Global (part of Blacktower Financial Management). '
+'Rules you must follow:\n'
+'- Use ONLY the facts given. If something is not in the facts, leave it out. Never invent figures, products, dates or reasons.\n'
+'- Write in plain British English, second person ("you"), warm and direct. No jargon, no marketing language, no exclamation marks.\n'
+'- Never guarantee or predict investment performance. Never say an investment "will" grow.\n'
+'- Do not give tax advice; you may note that tax treatment depends on individual circumstances and can change.\n'
+'- Do not add headings, bullet characters, markdown, or a sign-off unless asked. Return prose only.\n'
+'- If the facts are thin, write less rather than padding.';
const AI_PROMPTS={
  lumpSumFactors:{ system:AI_HOUSE,
    user:(facts)=>'Draft the answer to this question for the client file:\n\n'
      +'"In the client\'s own words, what would be the most important factor(s) for you investing this money?"\n\n'
      +'Cover, only where the facts support it: what matters most to them about this money; if other products exist in '
      +'their country of residence, why the recommended product was chosen instead; any tax planning the product allows; '
      +'if their risk profile does not match the product, why that is appropriate; and why they are content with the '
      +'fees. Two or three short paragraphs.\n\nFACTS:\n'+facts },
  retirementNarrative:{ system:AI_HOUSE,
    user:(facts,b)=>'Draft the "Are your retirement goals achievable?" paragraph for the client file. '
      +'The cashflow shows the client is '+(b.onTrack==='On track'?'ON TRACK':'NOT ON TRACK')+' to meet their retirement goals.\n\n'
      +(b.onTrack==='On track'
        ?'Open by saying that based on their financial goals, current assets and projected savings contributions they are '
         +'on track, then set out which of these are worth discussing, choosing only those the facts support: estate '
         +'planning to pass excess assets on; different income strategies in retirement; tax planning depending on where '
         +'they retire; and reviewing the existing portfolio for taxation status, asset allocation, performance and charges.'
        :'Open by saying that based on their financial goals, current assets and projected savings contributions they are '
         +'not on track, then set out which of these could close the gap, choosing only those the facts support: reducing '
         +'the income requirement in retirement; reducing expenses to save more; increasing risk; and retiring later.')
      +'\n\nUse the actual figures from the facts where they help. Two short paragraphs.\n\nFACTS:\n'+facts },
  mainObjectives:{ system:AI_HOUSE,
    user:(facts,b)=>'Draft the "Main objectives" section for the client file as a short list of objectives, one per line, '
      +'each starting with "- ". Choose only the objectives the facts actually support for this client, and add any '
      +'others the facts show. The advice type is: '+(b.adviceType||'not stated')+'.\n\n'
      +'Draw from this menu where relevant:\n'
      +'UK pensions: flexible drawdown; alternative currency options; retiring outside the UK and wanting cross-border '
      +'advice through retirement; consolidating pensions into one pot; more flexible death benefits than a cash lump sum; '
      +'greater investment options.\n'
      +'Defined benefit only: reduced life expectancy; the option to outperform inflation; flexibility over retirement age; '
      +'protecting against foreign inflation.\n'
      +'Change of adviser: reduce ongoing fees; reduce exposure to structured notes as they mature; improve investment '
      +'performance; change investment strategy; a more holistic service.\n'
      +'GIA: improve investment performance; greater investment options; the option to outperform inflation; a more '
      +'holistic service; receiving advice through retirement.\n'
      +'ISA: consolidating ISAs into one pot to manage and track more easily; moving cash ISAs to stocks and shares for '
      +'better growth potential; using this year\'s ISA allowance; using the allowance in future years.\n\n'
      +'Return only the lines, nothing else.\n\nFACTS:\n'+facts },
  ukNarrative:{ system:AI_HOUSE,
    user:(facts)=>'Draft the UK advice paragraph for the client file. One long, flowing paragraph (or two at most) covering, '
      +'where the facts support it: their future retirement plans and where they intend to retire; why the recommended '
      +'provider was chosen and who was discounted; when they plan to retire and the sustainability of the plan before and '
      +'after retirement; how retirement will be funded and which pots the income will come from. Do not use bullet points.'
      +'\n\nFACTS:\n'+facts },
  polish:{ system:AI_HOUSE,
    user:(facts,b)=>'Rewrite the draft below as flowing prose for a client file. Keep EVERY fact, figure, name and '
      +'date exactly as written — you are changing the wording, not the content. Keep any text in square brackets '
      +'exactly as it is, including the brackets, because it marks something the adviser still has to complete. '
      +'Keep bullet lists as bullet lists.\n\nDRAFT:\n'+String(b.draft||'')+'\n\nFACTS (for context only, do not add from these):\n'+facts },
  reportNarrative:{ system:AI_HOUSE,
    user:(facts)=>'Write the "What this means for you" section of a cashflow report addressed to the client. Three short '
      +'paragraphs: what the forecast shows about their position; what is driving that (the main pressures or strengths); '
      +'and what could be adjusted if they wanted a different outcome. Speak to them directly and plainly. Do not repeat '
      +'the numbers table — interpret it. Make clear this is an illustration based on assumptions, not a promise.'
      +'\n\nFACTS:\n'+facts },
  /* Reading a ceding scheme's reply. The portal matches the labels itself
     first; this only runs on what that could not find, and its answers are
     shown to the adviser as suggestions to approve, never applied blind. */
  transcriptExtract:{
    /* Reading an hour of conversation is a bigger job than drafting a
       paragraph, so this one asks for the larger model. */
    opts:{model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',max_tokens:1800,temperature:0.1},
    system:'You read a transcript of a meeting between a financial adviser and their client, and you pull out facts '
      +'about the CLIENT for a fact find. You return ONLY a JSON array, no prose, no markdown, no code fences.\n'
      +'Rules you must follow:\n'
      +'- Every item needs "q": the exact words from the transcript that state the fact, copied word for word, '
      +'at most 30 words. If you cannot quote it, do not include it.\n'
      +'- Never infer, estimate, round or calculate. Never invent a figure, a name, a date or a provider.\n'
      +'- Only facts about the client and their family. Anything the adviser says about their OWN life, home, '
      +'holidays or health is not a client fact — leave it out.\n'
      +'- If something is discussed but no clear answer is given, leave it out.\n'
      +'- The quote must contain the answer itself: the figure, the name, the place, the word. A name on its own is '
      +'not evidence of anything else about that person — do not work out a title, a gender or a nationality from it.\n'
      +'- Give a currency only if it was said out loud (pounds, euros, dollars). Otherwise leave the currency out.\n'
      +'- If a figure is corrected later in the conversation, give the corrected figure and quote the correction.\n'
      +'- Amounts as plain numbers without currency symbols or commas. Dates as YYYY-MM-DD when the full date is '
      +'given, otherwise leave the date out.',
    user:(facts,b)=>'The adviser is '+String(b.adviser||'the adviser').slice(0,80)+'. '
      +String(b.people||'').slice(0,400)+'\n\n'
      +'Return a JSON array. Each item is one of:\n'
      +'{"k":"<key>","who":"1"|"2"|"joint","v":<value>,"q":"<exact quote>"}   for a single answer\n'
      +'{"k":"<list>","who":"1"|"2"|"joint","v":{<fields>},"q":"<exact quote>"}   for something there can be several of\n\n'
      +'SINGLE ANSWERS (use exactly these keys):\n'
      +(Array.isArray(b.want)?b.want.slice(0,80).map(w=>'"'+String(w.id).slice(0,40)+'": '+String(w.ask||'').slice(0,140)).join('\n'):'')
      +'\n\nLISTS (use exactly these keys and field names):\n'
      +(Array.isArray(b.lists)?b.lists.slice(0,12).map(w=>'"'+String(w.id).slice(0,40)+'": '+String(w.ask||'').slice(0,260)).join('\n'):'')
      +'\n\nThis is part '+(Number(b.part)||1)+' of '+(Number(b.parts)||1)+' of the meeting. Return [] if this part '
      +'holds none of the above.\n\nTRANSCRIPT:\n'+facts },
  schemeExtract:{
    system:'You extract facts from pension scheme documents. You return ONLY a JSON object, no prose, no markdown, '
      +'no code fences. Every value must be copied from the document — never inferred, never invented, never '
      +'rounded. If the document does not answer a field, omit that field entirely. Do not guess.',
    user:(facts,b)=>'From the pension scheme document below, extract these fields into a JSON object. '
      +'Use exactly these keys, and omit any key the document does not answer:\n'
      +(Array.isArray(b.want)&&b.want.length
        ? b.want.map(w=>'"'+String(w.id).slice(0,40)+'": '+String(w.ask||'').slice(0,160)).join('\n')
        : '(no fields requested)')
      +'\n\nReturn the JSON object and nothing else.\n\nDOCUMENT:\n'+facts }
};

function createApp(deps){
  const store=deps.store, secret=deps.secret, log=deps.log||(()=>{});
  const baseUrl=(deps.baseUrl||'').replace(/\/$/,'');
  const SESSION_DAYS=14, FORM_DAYS=45;
  const failed=new Map();  /* login throttling: key -> {n, until} */

  const json=(obj,status,headers)=>new Response(JSON.stringify(obj),{status:status||200,
    headers:Object.assign({'content-type':'application/json; charset=utf-8','cache-control':'no-store'},headers||{})});
  const err=(status,message)=>json({error:message},status);

  /* ----------------------------- sessions ------------------------------ */
  async function makeCookie(userId,secure){
    const exp=Date.now()+SESSION_DAYS*86400000;
    const payload=userId+'.'+exp;
    const sig=await hmac(secret,payload);
    return 'sjb_s='+payload+'.'+sig+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+(SESSION_DAYS*86400)+(secure?'; Secure':'');
  }
  async function userFrom(req){
    let ck=req.headers.get('cookie')||'';
    if(!ck&&deps.exposeCookie) ck=req.headers.get('x-session')||'';   /* test harness only */
    const m=/(?:^|;\s*)sjb_s=([^;]+)/.exec(ck); if(!m) return null;
    const parts=m[1].split('.'); if(parts.length!==3) return null;
    const [userId,exp,sig]=parts;
    if(+exp<Date.now()) return null;
    if(await hmac(secret,userId+'.'+exp)!==sig) return null;
    const u=await store.get('users',userId); if(!u||u.disabled) return null;
    return u;
  }
  async function readJson(req,limit){
    const ct=req.headers.get('content-type')||'';
    if(!/application\/json/i.test(ct)) throw err(415,'Send JSON');
    const t=await req.text();
    if(t.length>(limit||2*1024*1024)) throw err(413,'Too large');
    try{ return JSON.parse(t); }catch(e){ throw err(400,'Bad JSON'); }
  }
  const isSecure=req=>{ const u=new URL(req.url); return u.protocol==='https:'||(req.headers.get('x-forwarded-proto')||'')==='https'; };

  /* ------------------------------ state -------------------------------- */
  /* Every adviser sees only their own book. Records carry ownerId; anything
     created before ownership existed is claimed by the admin on their next
     sign-in, so nothing is ever orphaned or shared by accident. */
  async function singleton(col,def){ return (await store.get(col,'main'))||def; }
  async function isAdmin(user){
    if(user.admin) return true;
    const users=await store.list('users');
    if(users.some(u=>u.admin)) return false;
    /* no admin flag anywhere yet: the earliest login is the admin */
    const first=users.slice().sort((a,b)=>(a.created||'').localeCompare(b.created||''))[0];
    return !!first&&first.id===user.id;
  }
  const mine=(rec,user)=>rec&&rec.ownerId===user.id;
  async function perUser(col,user,def){
    return (await store.get(col,user.id))||def;
  }
  async function claimLegacy(user){
    /* one-off migration: unowned records -> admin */
    const clients=await store.list('clients');
    for(const c of clients){ if(!c.ownerId){ c.ownerId=user.id; await store.put('clients',c.id,c); } }
    for(const col of ['requests','sends']){
      const legacy=await store.get(col,'main');
      if(legacy&&Array.isArray(legacy.items)){
        const cur=await perUser(col,user,{items:[]});
        const have=new Set((cur.items||[]).map(x=>x&&x.id));
        cur.items=(cur.items||[]).concat(legacy.items.filter(x=>x&&!have.has(x.id)));
        await store.put(col,user.id,cur); await store.del(col,'main');
      }
    }
    const subs=await store.list('submissions');
    for(const s of subs){ if(!s.ownerId){ s.ownerId=user.id; await store.put('submissions',s.id,s); } }
  }
  async function fullState(user){
    const admin=await isAdmin(user);
    if(admin&&!user.admin){ user.admin=true; await store.put('users',user.id,user); }
    if(admin) await claimLegacy(user);
    const clients=(await store.list('clients')).filter(c=>mine(c,user));
    const requests=(await perUser('requests',user,{items:[]})).items||[];
    const sends=(await perUser('sends',user,{items:[]})).items||[];
    const settings=await singleton('settings',{});
    const inbox=(await store.list('submissions')).filter(s=>!s.acked&&mine(s,user))
      .sort((a,b)=>(b.at||'').localeCompare(a.at||''));
    return {user:{id:user.id,email:user.email,name:user.name||'',phone:user.phone||'',admin},clients,requests,sends,settings,inbox};
  }

  /* ------------------------------ routes ------------------------------- */
  return async function handle(req){
    const url=new URL(req.url), path=url.pathname, method=req.method;
    try{
      if(path==='/api/health') return json({ok:true,time:new Date().toISOString()});

      /* ---- public: the client's form ---- */
      let m;
      if((m=/^\/api\/form\/([A-Za-z0-9_-]{16,})$/.exec(path))&&method==='GET'){
        const f=await store.get('forms',m[1]); if(!f) return err(404,'This link is not valid.');
        if(f.expires&&f.expires<Date.now()) return err(410,'This link has expired. Please ask your adviser for a new one.');
        const c=await store.get('clients',f.clientId); if(!c) return err(404,'This link is no longer valid.');
        const p=(c.data&&c.data.personal)||{}, a=p.a1||{}, b=p.a2||{};
        const settings=await singleton('settings',{});
        return json({ref:c.ref,clientName:SHARED.recordName(c),firstName:a.firstName||'',
          greetName:[a.firstName,b.firstName].filter(Boolean).join(' and '),
          joint:!!(b.firstName||b.surname),adviserName:(c.data.meta&&c.data.meta.adviser)||settings.adviserName||'',
          org:SHARED.CFG.org,data:SHARED.clientSubsetData(c),submitted:!!f.submittedAt,
          privacy:SHARED.privacyNotice(settings,'factfind'),
          consent:{main:SHARED.DP_CONSENT.factfind,health:SHARED.DP_CONSENT.health,
            version:(settings.dp&&settings.dp.version)||'1'}});
      }
      if((m=/^\/api\/form\/([A-Za-z0-9_-]{16,})\/submit$/.exec(path))&&method==='POST'){
        const f=await store.get('forms',m[1]); if(!f) return err(404,'This link is not valid.');
        if(f.expires&&f.expires<Date.now()) return err(410,'This link has expired.');
        const c=await store.get('clients',f.clientId); if(!c) return err(404,'This link is no longer valid.');
        const body=await readJson(req,1024*1024);
        if(!body||typeof body.data!=='object') return err(400,'No answers received.');
        /* Record consent as evidence: the wording, the version and the time. */
        if(body.consent&&typeof body.consent==='object'){
          c.consent={agreedAt:String(body.consent.agreedAt||new Date().toISOString()).slice(0,40),
            wording:String(body.consent.wording||'').slice(0,600),
            version:String(body.consent.version||'').slice(0,20),
            health:{given:!!(body.consent.health&&body.consent.health.given),
                    wording:String(((body.consent.health)||{}).wording||'').slice(0,600)},
            via:'fact find link'};
        }
        const summary=SHARED.mergeSubmission(c,body.data);
        if(body.joint!=null) c.joint=!!body.joint;
        await store.put('clients',c.id,c);
        const sub={id:newId('sub'),kind:'factfind',clientId:c.id,ref:c.ref,clientName:SHARED.recordName(c),
          ownerId:c.ownerId||null,at:new Date().toISOString(),summary,acked:false,token:f.token};
        await store.put('submissions',sub.id,sub);
        f.submittedAt=sub.at; f.submissions=(f.submissions||0)+1; await store.put('forms',f.token,f);
        /* notify — best effort, never blocks the client */
        try{
          const settings=await singleton('settings',{});
          const to=(c.data.meta&&c.data.meta.adviserEmail)||settings.adviserEmail||f.notify;
          if(deps.mail&&to) await deps.mail(to,'['+c.ref+'] Fact Find returned — '+sub.clientName,
            sub.clientName+' has completed their Fact Find.\n\n'+(summary.length?summary.join('\n'):'No new answers.')
            +'\n\nOpen it: '+baseUrl+'/#client='+c.id+'\n');
        }catch(e){ log('mail failed',e&&e.message); }
        return json({ok:true,ref:c.ref});
      }

      /* ======================= DATA PROTECTION =========================
         Erasure has to reach everything, or the button is a lie. A client
         record is only one of six places their personal data sits: the
         uploaded files, the chunks those files are stored in, the returned
         Fact Find submissions, and the live links that would let anyone
         holding the URL carry on filling their form.
         ================================================================= */
      const erasePerson=async(clientId)=>{
        const gone={client:0,files:0,chunks:0,submissions:0,formLinks:0,docLinks:0};
        const files=(await store.list('files')).filter(f=>f.clientId===clientId);
        for(const f of files){
          for(let i=0;i<(f.totalChunks||0);i++){
            await store.del('filechunks',f.id+'.'+i); gone.chunks++;
          }
          await store.del('files',f.id); gone.files++;
        }
        for(const sub2 of (await store.list('submissions')).filter(x=>x.clientId===clientId)){
          await store.del('submissions',sub2.id); gone.submissions++;
        }
        for(const f of (await store.list('forms')).filter(x=>x.clientId===clientId)){
          await store.del('forms',f.token); gone.formLinks++;
        }
        for(const d of (await store.list('doclinks')).filter(x=>x.clientId===clientId)){
          await store.del('doclinks',d.token); gone.docLinks++;
        }
        if(await store.get('clients',clientId)){ await store.del('clients',clientId); gone.client=1; }
        return gone;
      };
      /* A KYC link dribbles in — four photos, then the typed details, often
         over several days. One inbox entry per file would bury the Fact Find
         notices, so a client keeps ONE open entry that gathers what has
         arrived and moves to the top each time. Marking it Seen closes it;
         anything that arrives afterwards opens a fresh one. */
      /* `key` identifies the thing being reported, so a second send of the
         same thing rewrites its line instead of adding another: re-uploading
         a passport, or sending the details form twice, should not read as two
         separate events. */
      const noteKyc=async(c,dl,line,key)=>{
        const open=(await store.list('submissions'))
          .filter(s=>s.kind==='kyc'&&s.clientId===c.id&&!s.acked)
          .sort((a,b)=>(b.at||'').localeCompare(a.at||''))[0];
        const at=new Date().toISOString();
        if(open){
          const keys=(open.keys||[]).slice(), sum=(open.summary||[]).slice();
          const at2=keys.indexOf(key);
          if(at2>=0) sum[at2]=line; else { sum.push(line); keys.push(key); }
          open.summary=sum.slice(-12); open.keys=keys.slice(-12);
          open.at=at; open.clientName=SHARED.recordName(c);
          await store.put('submissions',open.id,open);
          return open;
        }
        const sub={id:newId('sub'),kind:'kyc',clientId:c.id,ref:c.ref,clientName:SHARED.recordName(c),
          ownerId:c.ownerId||null,at,summary:[line],keys:[key],acked:false,token:dl&&dl.token};
        await store.put('submissions',sub.id,sub);
        return sub;
      };
      const DOC_EXT={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',pdf:'application/pdf',heic:'image/heic',webp:'image/webp'};
      const extOf=n=>String(n||'').split('.').pop().toLowerCase();
      if((m=/^\/api\/docs\/([A-Za-z0-9_-]{16,})$/.exec(path))&&method==='GET'){
        const dl=await store.get('doclinks',m[1]); if(!dl) return err(404,'This link is not valid.');
        if(dl.expires&&dl.expires<Date.now()) return err(410,'This link has expired. Please ask your adviser for a new one.');
        const c=await store.get('clients',dl.clientId); if(!c) return err(404,'This link is no longer valid.');
        const p=(c.data&&c.data.personal)||{}, a=p.a1||{}, b=p.a2||{};
        const settings=await singleton('settings',{});
        const files=(await store.list('files')).filter(x=>x.clientId===c.id&&x.complete&&x.scope!=='template')
          .map(x=>({label:x.label,name:x.name,size:x.size,at:x.at}));
        const dpv=(settings.dp&&settings.dp.version)||'1';
        return json({ref:c.ref,firstName:a.firstName||'',clientName:SHARED.recordName(c),
          greetName:[a.firstName,b.firstName].filter(Boolean).join(' and '),
          privacy:SHARED.privacyNotice(settings,'kyc'),
          consent:{main:SHARED.DP_CONSENT.kyc,version:dpv},
          adviserName:(c.data.meta&&c.data.meta.adviser)||settings.adviserName||'',org:SHARED.CFG.org,
          uploaded:files,detailsAt:dl.detailsAt||null});
      }
      if((m=/^\/api\/docs\/([A-Za-z0-9_-]{16,})\/upload$/.exec(path))&&method==='POST'){
        const dl=await store.get('doclinks',m[1]); if(!dl) return err(404,'This link is not valid.');
        if(dl.expires&&dl.expires<Date.now()) return err(410,'This link has expired.');
        const c=await store.get('clients',dl.clientId); if(!c) return err(404,'This link is no longer valid.');
        const b=await readJson(req,1024*1024);
        const ext=extOf(b.name);
        if(!DOC_EXT[ext]) return err(400,'That file type is not accepted — please send a photo (JPG/PNG) or a PDF.');
        if(!(+b.size>0&&+b.size<=12*1024*1024)) return err(400,'Files up to 12 MB please.');
        if(!(+b.totalChunks>=1&&+b.totalChunks<=40)||!(+b.index>=0&&+b.index<+b.totalChunks)) return err(400,'Bad upload.');
        if(typeof b.dataB64!=='string'||b.dataB64.length>900000) return err(400,'Bad upload chunk.');
        let f=b.fileId?await store.get('files',b.fileId):null;
        if(!f){
          f={id:newId('fl'),clientId:c.id,ownerId:c.ownerId||null,scope:'client-doc',
            name:String(b.name).slice(0,120),label:String(b.label||'Document').slice(0,80),
            type:DOC_EXT[ext],size:+b.size,totalChunks:+b.totalChunks,received:0,complete:false,at:new Date().toISOString()};
          await store.put('files',f.id,f);
        }
        if(f.clientId!==c.id) return err(403,'Bad upload.');
        await store.put('filechunks',f.id+'.'+b.index,{fileId:f.id,index:+b.index,dataB64:b.dataB64});
        f.received=(f.received||0)+1;
        if(f.received>=f.totalChunks&&!f.complete){
          f.complete=true;
          try{ await noteKyc(c,dl,f.label||'A document','doc:'+(f.label||f.name)); }catch(e){ log('inbox note failed',e&&e.message); }
          try{
            const settings=await singleton('settings',{});
            const to=(c.data.meta&&c.data.meta.adviserEmail)||settings.adviserEmail||dl.notify;
            if(deps.mail&&to) await deps.mail(to,'['+c.ref+'] Document received — '+SHARED.recordName(c),
              SHARED.recordName(c)+' has uploaded: '+f.label+' ('+f.name+').\n\nOpen their record: '+baseUrl+'/#client='+c.id+'\n');
          }catch(e){ log('mail failed',e&&e.message); }
        }
        await store.put('files',f.id,f);
        return json({ok:true,fileId:f.id,received:f.received,complete:f.complete});
      }
      if((m=/^\/api\/docs\/([A-Za-z0-9_-]{16,})\/details$/.exec(path))&&method==='POST'){
        const dl=await store.get('doclinks',m[1]); if(!dl) return err(404,'This link is not valid.');
        const c=await store.get('clients',dl.clientId); if(!c) return err(404,'This link is no longer valid.');
        const b=await readJson(req,200000);
        c.data=c.data||{};
        if(b.tin&&String(b.tin).trim()){
          c.data.personal=c.data.personal||{a1:{},a2:{}}; c.data.personal.a1=c.data.personal.a1||{};
          c.data.personal.a1.tin=String(b.tin).trim().slice(0,60);
        }
        if(Array.isArray(b.beneficiaries)&&b.beneficiaries.length){
          c.data.beneficiaries=b.beneficiaries.slice(0,10).map(x=>({_id:newId('r'),
            name:String(x.name||'').slice(0,120),relationship:String(x.relationship||'').slice(0,60),
            dob:String(x.dob||'').slice(0,20),phone:String(x.phone||'').slice(0,40),
            email:String(x.email||'').slice(0,120),address:String(x.address||'').slice(0,300),
            pct:String(x.pct||'').slice(0,8)})).filter(x=>x.name);
        }
        /* The account the provider pays out to. Asked on this link rather than
           the Fact Find, alongside the statement that proves it. Updates the
           existing row in place so an adviser's earlier entry is not lost, and
           only overwrites a field they actually filled in. */
        if(b.bank&&typeof b.bank==='object'){
          const keep=['bank','accountName','ccy','iban','bic','sortCode','accountNo','heldSince'];
          const given={};
          keep.forEach(k=>{ const v=b.bank[k];
            if(v!=null&&String(v).trim()!=='') given[k]=String(v).trim().slice(0,120); });
          if(Object.keys(given).length){
            c.data.bank=Array.isArray(c.data.bank)?c.data.bank:[];
            const row=c.data.bank[0]||{_id:newId('r')};
            Object.assign(row,given);
            /* the statement they uploaded on this same link is the proof */
            const up=(await store.list('files')).filter(x=>x.clientId===c.id&&x.complete);
            if(up.some(f=>/proof of bank/i.test(f.label||''))) row.proof='Yes';
            c.data.bank[0]=row;
          }
        }
        c.updated=new Date().toISOString();
        await store.put('clients',c.id,c);
        dl.detailsAt=new Date().toISOString(); await store.put('doclinks',dl.token,dl);
        /* Say what they actually sent. Read it off the record rather than off
           this payload: they may send the form more than once, and the notice
           should say what we now hold, not only what came in the last post. */
        try{
          const bits=[];
          if(String(((c.data.personal||{}).a1||{}).tin||'').trim()) bits.push('Tax number');
          const nb=(c.data.beneficiaries||[]).filter(x=>x&&x.name).length;
          if(nb) bits.push(nb+' beneficiar'+(nb===1?'y':'ies'));
          const bank=(c.data.bank||[])[0]||{};
          if(['bank','accountName','iban','bic','sortCode','accountNo']
             .some(k=>String(bank[k]||'').trim())) bits.push('Bank details');
          if(bits.length) await noteKyc(c,dl,bits.join(', '),'details');
        }catch(e){ log('inbox note failed',e&&e.message); }
        try{
          const settings=await singleton('settings',{});
          const to=(c.data.meta&&c.data.meta.adviserEmail)||settings.adviserEmail||dl.notify;
          if(deps.mail&&to) await deps.mail(to,'['+c.ref+'] KYC details received — '+SHARED.recordName(c),
            SHARED.recordName(c)+' has sent their tax number, beneficiaries and bank details.\n\nOpen their record: '+baseUrl+'/#client='+c.id+'\n');
        }catch(e){ log('mail failed',e&&e.message); }
        return json({ok:true});
      }

      /* ---- auth ---- */
      if(path==='/api/login'&&method==='POST'){
        const body=await readJson(req,10000);
        const email=String(body.email||'').trim().toLowerCase(), pw=String(body.password||'');
        const key=email+'|'+(req.headers.get('x-forwarded-for')||'');
        const fl=failed.get(key);
        if(fl&&fl.until>Date.now()) return err(429,'Too many attempts. Try again in a few minutes.');
        const users=await store.list('users');
        const u=users.find(x=>(x.email||'').toLowerCase()===email);
        const ok=u&&!u.disabled&&await verifyPassword(pw,u.hash);
        if(!ok){
          const n=(fl?fl.n:0)+1; failed.set(key,{n,until:n>=5?Date.now()+15*60000:0});
          return err(401,'Email or password not recognised.');
        }
        failed.delete(key);
        u.lastLogin=new Date().toISOString(); await store.put('users',u.id,u);
        const ck=await makeCookie(u.id,isSecure(req));
        /* exposeCookie is for the browser test harness only — browsers hide
           Set-Cookie from scripts. Never set it in production. */
        return json({ok:true,user:{id:u.id,email:u.email,name:u.name||''}},200,
          Object.assign({'set-cookie':ck},deps.exposeCookie?{'x-session':ck.split(';')[0]}:{}));
      }
      if(path==='/api/logout'&&method==='POST'){
        return json({ok:true},200,{'set-cookie':'sjb_s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'});
      }

      /* ---- everything below needs a signed-in adviser ---- */
      if(path.indexOf('/api/')!==0) return err(404,'Not found');
      const user=await userFrom(req);
      if(!user) return err(401,'Please sign in.');

      if(path==='/api/me'&&method==='GET') return json({user:{id:user.id,email:user.email,name:user.name||'',phone:user.phone||'',admin:await isAdmin(user)}});
      if(path==='/api/state'&&method==='GET') return json(await fullState(user));
      if(path==='/api/state'&&method==='PUT'){
        const body=await readJson(req);
        let n=0, denied=0;
        if(Array.isArray(body.clients)) for(const c of body.clients){
          if(!c||typeof c.id!=='string'||c.id.length>80) continue;
          const existing=await store.get('clients',c.id);
          if(existing&&existing.ownerId&&existing.ownerId!==user.id){ denied++; continue; }
          c.ownerId=(existing&&existing.ownerId)||user.id;
          c.updated=c.updated||new Date().toISOString();
          await store.put('clients',c.id,c); n++;
        }
        if(Array.isArray(body.requests)) await store.put('requests',user.id,{items:body.requests});
        if(Array.isArray(body.sends)) await store.put('sends',user.id,{items:body.sends.slice(0,500)});
        if(body.settings&&typeof body.settings==='object') await store.put('settings','main',body.settings);
        return json({ok:true,clients:n,denied});
      }
      if((m=/^\/api\/clients\/([A-Za-z0-9_-]+)$/.exec(path))&&method==='DELETE'){
        const c=await store.get('clients',m[1]);
        if(c&&!mine(c,user)) return err(403,'That client belongs to another adviser.');
        const gone=await erasePerson(m[1]);
        return json({ok:true,erased:gone});
      }
      /* Everything held about one person, for a subject access request or a
         portability request. Includes what is stored ABOUT the data as well
         as the data itself \u2014 when links were made, when things arrived. */
      if((m=/^\/api\/clients\/([A-Za-z0-9_-]+)\/data$/.exec(path))&&method==='GET'){
        const c=await store.get('clients',m[1]); if(!c) return err(404,'No such client');
        if(!mine(c,user)) return err(403,'That client belongs to another adviser.');
        const files=(await store.list('files')).filter(f=>f.clientId===c.id)
          .map(f=>({name:f.name,label:f.label,type:f.type,size:f.size,uploaded:f.at,complete:!!f.complete}));
        const subs=(await store.list('submissions')).filter(x=>x.clientId===c.id)
          .map(x=>({kind:x.kind||'factfind',at:x.at,summary:x.summary,seen:!!x.acked}));
        const forms=(await store.list('forms')).filter(x=>x.clientId===c.id)
          .map(x=>({created:new Date(x.created).toISOString(),expires:new Date(x.expires).toISOString(),
                    submitted:x.submittedAt||null}));
        const docs=(await store.list('doclinks')).filter(x=>x.clientId===c.id)
          .map(x=>({created:new Date(x.created).toISOString(),expires:new Date(x.expires).toISOString(),
                    detailsSent:x.detailsAt||null}));
        return json({exported:new Date().toISOString(),reference:c.ref,
          record:c,documents:files,submissions:subs,factFindLinks:forms,documentLinks:docs});
      }

      /* ---- public: the client's document upload link ---- */

      if((m=/^\/api\/clients\/([A-Za-z0-9_-]+)\/form$/.exec(path))&&method==='POST'){
        const c=await store.get('clients',m[1]); if(!c) return err(404,'No such client');
        if(!mine(c,user)) return err(403,'That client belongs to another adviser.');
        /* reuse a live link rather than scattering several */
        const existing=(await store.list('forms')).find(f=>f.clientId===c.id&&f.expires>Date.now()+86400000);
        const f=existing||{token:randomToken(24),clientId:c.id,created:Date.now(),
          expires:Date.now()+FORM_DAYS*86400000,notify:user.email};
        if(!existing) await store.put('forms',f.token,f);
        return json({token:f.token,url:baseUrl+'/f/'+f.token,expires:new Date(f.expires).toISOString(),
          submittedAt:f.submittedAt||null});
      }
      /* ---- document request links + stored files (adviser side) ---- */
      if((m=/^\/api\/clients\/([A-Za-z0-9_-]+)\/docs$/.exec(path))&&method==='POST'){
        const c=await store.get('clients',m[1]); if(!c) return err(404,'No such client');
        if(!mine(c,user)) return err(403,'That client belongs to another adviser.');
        const existing=(await store.list('doclinks')).find(d=>d.clientId===c.id&&d.expires>Date.now()+86400000);
        const dl=existing||{token:randomToken(24),clientId:c.id,created:Date.now(),
          expires:Date.now()+60*86400000,notify:user.email};
        if(!existing) await store.put('doclinks',dl.token,dl);
        return json({token:dl.token,url:baseUrl+'/d/'+dl.token,expires:new Date(dl.expires).toISOString()});
      }
      if((m=/^\/api\/clients\/([A-Za-z0-9_-]+)\/files$/.exec(path))&&method==='GET'){
        const c=await store.get('clients',m[1]); if(!c) return err(404,'No such client');
        if(!mine(c,user)) return err(403,'That client belongs to another adviser.');
        const files=(await store.list('files')).filter(x=>x.clientId===c.id&&x.complete)
          .sort((a,b)=>(b.at||'').localeCompare(a.at||''))
          .map(x=>({id:x.id,label:x.label,name:x.name,size:x.size,type:x.type,at:x.at}));
        return json({files});
      }
      if((m=/^\/api\/files\/([A-Za-z0-9_.-]+)$/.exec(path))&&method==='GET'){
        const f=await store.get('files',m[1]); if(!f||!f.complete) return err(404,'Not found');
        if(f.ownerId&&f.ownerId!==user.id) return err(403,'That file belongs to another adviser.');
        const parts=[];
        for(let i=0;i<f.totalChunks;i++){
          const ch=await store.get('filechunks',f.id+'.'+i); if(!ch) return err(500,'A piece of this file is missing.');
          const bin=atob(ch.dataB64); const u=new Uint8Array(bin.length);
          for(let j=0;j<bin.length;j++) u[j]=bin.charCodeAt(j);
          parts.push(u);
        }
        let total=0; parts.forEach(p=>total+=p.length);
        const all=new Uint8Array(total); let off=0; parts.forEach(p=>{ all.set(p,off); off+=p.length; });
        return new Response(all,{headers:{'content-type':f.type||'application/octet-stream',
          'content-disposition':'attachment; filename="'+String(f.name).replace(/[^\w. -]/g,'_')+'"','cache-control':'no-store'}});
      }
      if((m=/^\/api\/files\/([A-Za-z0-9_.-]+)$/.exec(path))&&method==='DELETE'){
        const f=await store.get('files',m[1]); if(!f) return err(404,'Not found');
        if(f.ownerId&&f.ownerId!==user.id) return err(403,'That file belongs to another adviser.');
        for(let i=0;i<(f.totalChunks||0);i++) await store.del('filechunks',f.id+'.'+i);
        await store.del('files',f.id);
        return json({ok:true});
      }
      /* adviser uploads — the PowerPoint template, and the Word report templates.
         Report templates belong to the practice, not to one adviser, so every
         adviser generates from the same document. */
      if(path==='/api/upload'&&method==='POST'){
        const b=await readJson(req,1024*1024);
        const scope=String(b.scope||'');
        if(scope!=='template'&&scope!=='report') return err(400,'Unknown upload type.');
        const isReport=scope==='report';
        if(isReport){
          if(!/\.docx$/i.test(String(b.name||''))) return err(400,'A suitability report template must be a .docx file.');
          if(!/^[a-z0-9_-]{1,24}$/.test(String(b.key||''))) return err(400,'Unknown report type.');
        } else if(!/\.pptx$/i.test(String(b.name||''))) return err(400,'The presentation template must be a .pptx file.');
        if(!(+b.size>0&&+b.size<=20*1024*1024)) return err(400,'Templates up to 20 MB please.');
        if(!(+b.totalChunks>=1&&+b.totalChunks<=60)||!(+b.index>=0&&+b.index<+b.totalChunks)) return err(400,'Bad upload.');
        if(typeof b.dataB64!=='string'||b.dataB64.length>900000) return err(400,'Bad upload chunk.');
        let f=b.fileId?await store.get('files',b.fileId):null;
        if(!f){
          f={id:newId('fl'),clientId:null,ownerId:isReport?null:user.id,scope,
            key:isReport?String(b.key):null,
            title:isReport?String(b.title||b.name||'').slice(0,120):null,
            name:String(b.name).slice(0,120),label:isReport?'Suitability report template':'Report template',
            type:isReport?'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                         :'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            size:+b.size,totalChunks:+b.totalChunks,received:0,complete:false,
            uploadedBy:user.email,at:new Date().toISOString()};
          await store.put('files',f.id,f);
        }
        if(!isReport&&f.ownerId!==user.id) return err(403,'Bad upload.');
        await store.put('filechunks',f.id+'.'+b.index,{fileId:f.id,index:+b.index,dataB64:b.dataB64});
        f.received=(f.received||0)+1;
        if(f.received>=f.totalChunks){
          f.complete=true;
          /* one live template per report type — retire the previous one */
          if(isReport){
            const old=(await store.list('files')).filter(x=>x.scope==='report'&&x.key===f.key&&x.id!==f.id);
            for(const o of old){
              for(let i=0;i<(o.totalChunks||0);i++) await store.del('filechunks',o.id+'.'+i);
              await store.del('files',o.id);
            }
          }
        }
        await store.put('files',f.id,f);
        return json({ok:true,fileId:f.id,received:f.received,complete:f.complete});
      }
      if(path==='/api/report-template'&&method==='GET'){
        const t=(await store.list('files')).filter(x=>x.scope==='template'&&x.ownerId===user.id&&x.complete)
          .sort((a,b)=>(b.at||'').localeCompare(a.at||''))[0]||null;
        return json({template:t?{id:t.id,name:t.name,size:t.size,at:t.at}:null});
      }
      if(path==='/api/report-templates'&&method==='GET'){
        const out={};
        (await store.list('files')).filter(x=>x.scope==='report'&&x.complete)
          .sort((a,b)=>(a.at||'').localeCompare(b.at||''))
          .forEach(t=>{ out[t.key]={id:t.id,name:t.name,title:t.title||'',size:t.size,at:t.at,uploadedBy:t.uploadedBy||''}; });
        return json({templates:out});
      }
      if(path==='/api/inbox'&&method==='GET'){
        const inbox=(await store.list('submissions')).filter(s=>!s.acked&&mine(s,user))
          .sort((a,b)=>(b.at||'').localeCompare(a.at||''));
        return json({inbox});
      }
      if((m=/^\/api\/submissions\/([A-Za-z0-9_-]+)\/ack$/.exec(path))&&method==='POST'){
        const s=await store.get('submissions',m[1]); if(!s||!mine(s,user)) return err(404,'Not found');
        s.acked=true; s.ackedAt=new Date().toISOString(); await store.put('submissions',s.id,s);
        return json({ok:true});
      }
      if(path==='/api/backup'&&method==='GET'){
        const st=await fullState(user);
        const subs=(await store.list('submissions')).filter(s=>mine(s,user));
        return json({app:SHARED.CFG.app,exported:new Date().toISOString(),adviser:user.email,clients:st.clients,requests:st.requests,
          sends:st.sends,settings:st.settings,submissions:subs},200,
          {'content-disposition':'attachment; filename="sjb-factfind-backup.json"'});
      }
      /* ---- advisers: admins only ---- */
      if(path==='/api/users'&&method==='GET'){
        if(!(await isAdmin(user))) return err(403,'Only an admin can manage advisers.');
        const users=await store.list('users');
        return json({users:users.map(u=>({id:u.id,email:u.email,name:u.name||'',phone:u.phone||'',lastLogin:u.lastLogin||null,disabled:!!u.disabled,admin:!!u.admin}))});
      }
      if(path==='/api/users'&&method==='POST'){
        if(!(await isAdmin(user))) return err(403,'Only an admin can add advisers.');
        const body=await readJson(req,10000);
        const email=String(body.email||'').trim(), pw=String(body.password||''), name=String(body.name||'').trim().slice(0,80);
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(400,'That does not look like an email address.');
        if(pw.length<10) return err(400,'Use a password of at least 10 characters.');
        const users=await store.list('users');
        if(users.some(u=>(u.email||'').toLowerCase()===email.toLowerCase())) return err(409,'There is already a login for that email.');
        const u={id:'u-'+randomToken(6),email,name:name||email.split('@')[0],created:new Date().toISOString(),createdBy:user.email,
          hash:await hashPassword(pw,null,deps.pbkdf2Iterations)};
        await store.put('users',u.id,u);
        return json({ok:true,user:{id:u.id,email:u.email,name:u.name}});
      }
      if((m=/^\/api\/users\/([A-Za-z0-9_-]+)\/(disable|enable)$/.exec(path))&&method==='POST'){
        if(!(await isAdmin(user))) return err(403,'Only an admin can change advisers.');
        if(m[1]===user.id) return err(400,'You cannot disable your own login.');
        const u=await store.get('users',m[1]); if(!u) return err(404,'No such adviser');
        u.disabled=m[2]==='disable'; await store.put('users',u.id,u);
        return json({ok:true});
      }
      if(path==='/api/profile'&&method==='POST'){
        const body=await readJson(req,10000);
        if(body.name!=null) user.name=String(body.name).trim().slice(0,80);
        if(body.phone!=null) user.phone=String(body.phone).trim().slice(0,40);
        await store.put('users',user.id,user);
        return json({ok:true,user:{id:user.id,email:user.email,name:user.name||'',phone:user.phone||''}});
      }
      /* ---- drafting assistant ---- */
      if(path==='/api/ai'&&method==='POST'){
        if(!deps.ai) return err(501,'The drafting assistant is not switched on for this server.');
        const body=await readJson(req,120000);
        const kind=String(body.kind||'');
        const spec=AI_PROMPTS[kind];
        if(!spec) return err(400,'Unknown draft type.');
        /* Reading a document needs more room than drafting a paragraph does. */
        const facts=String(body.facts||'').slice(0,kind==='schemeExtract'?24000:kind==='transcriptExtract'?14000:8000);
        if(!facts.trim()) return err(400,'Nothing to work from yet — fill in more of the Fact Find first.');
        try{
          const text=await deps.ai(spec.system,spec.user(facts,body),spec.opts||null);
          return json({text:String(text||'').trim()});
        }catch(e){ log('ai failed',e&&e.message); return err(502,'The assistant could not be reached. Try again, or write it yourself.'); }
      }
      /* ---- assistant chat ---- */
      if(path==='/api/chat'&&method==='POST'){
        if(!deps.ai) return err(501,'The assistant is not switched on for this server.');
        const body=await readJson(req,200000);
        const msgs=Array.isArray(body.messages)?body.messages.slice(-12):[];
        if(!msgs.length) return err(400,'Nothing to answer.');
        const facts=String(body.facts||'').slice(0,8000);
        const system=AI_HOUSE+'\n\nYou are answering questions from the adviser (not the client) inside their own '
          +'Fact Find portal. Be brief and practical. If a question needs information that is not in the facts below, '
          +'say what is missing rather than guessing. You may explain how the portal works if asked.'
          +(facts?('\n\nThe adviser currently has this client open:\n'+facts):'\n\nNo client is currently open.');
        const convo=msgs.map(m=>(m.role==='user'?'Adviser: ':'You: ')+String(m.content||'').slice(0,4000)).join('\n\n')
          +'\n\nYou:';
        try{
          const text=await deps.ai(system,convo);
          return json({text:String(text||'').trim()});
        }catch(e){ log('chat failed',e&&e.message); return err(502,'The assistant could not be reached.'); }
      }
      if(path==='/api/password'&&method==='POST'){
        const body=await readJson(req,10000);
        if(!(await verifyPassword(String(body.current||''),user.hash))) return err(403,'Current password is wrong.');
        if(String(body.next||'').length<10) return err(400,'Use at least 10 characters.');
        /* pbkdf2Iterations lets a CPU-capped host (Cloudflare's free tier) use
           fewer rounds; stored hashes carry their own count so mixes are fine. */
        user.hash=await hashPassword(String(body.next),null,deps.pbkdf2Iterations); await store.put('users',user.id,user);
        return json({ok:true});
      }
      return err(404,'Not found');
    }catch(e){
      if(e instanceof Response) return e;
      log('error',path,e&&e.stack||e);
      return err(500,'Something went wrong on the server.');
    }
  };
}

const SJB_APP={createApp,hashPassword,verifyPassword,randomToken,newId};
if(typeof module!=='undefined'&&module.exports) module.exports=SJB_APP;
else globalThis.SJB_APP=SJB_APP;
