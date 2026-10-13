
/* ===========================================================================
   Shared between the server, the portal and the client form.
   Everything above this line is the schema (generated from the portal parts).
   ========================================================================= */
/* The sections a client is asked to fill in. Beneficiaries and bank details
   are deliberately absent: the advisers asked for them off the Fact Find. Both
   are better taken in conversation, and a bank account is not something to ask
   anyone to type into a link. Both stay in the portal, so the MADS still gets
   them. */
const CLIENT_SECTION_IDS=['personal','addresses','dependants','employment','retirement',
  'estate','properties','cash','investments','dcPensions','dbPensions','statePensions',
  'liabilities','protection','incomeExp'];
/* Fields marked `adviser:` come from the provider or from our own judgement —
   a transfer value, a CETV, an exit fee, an IHT position. On the client's form
   they are noise at best and unanswerable at worst. `reco:` is the same for the
   ceding-scheme questions the admin needs to make the application. */
function clientFields(list){ return (list||[]).filter(f=>!f.adviser&&!f.reco); }
const CLIENT_COPY={
  personal:{t:'About you',d:'The basics — who you are and how to reach you.'},
  addresses:{t:'Where you live',d:'Your current address, and anywhere else you have lived in the last three years.'},
  dependants:{t:'Family',d:'Children and anyone else who depends on you financially.'},
  employment:{t:'Work & income',d:'What you do and what you earn. Round figures are fine.'},
  retirement:{t:'Retirement',d:'When you would like to stop working, where, and on what income.'},
  estate:{t:'Wills & estate',d:'Three short questions: your will, power of attorney, and anything you expect to inherit.'},
  properties:{t:'Property',d:'Your home and any other property, in the currency it is valued in.'},
  cash:{t:'Bank & savings accounts',d:'Where your cash sits. Approximate balances are fine.'},
  investments:{t:'Investments',d:'ISAs, investment accounts, bonds — anything invested.'},
  dcPensions:{t:'Pensions',d:'Just the provider, the policy number and roughly what each pot is worth. We write to the providers for everything else, so do not worry about the detail.'},
  dbPensions:{t:'Final salary pensions',d:'Pensions that promise an income rather than a pot. Skip if you have none.'},
  statePensions:{t:'State pensions',d:'From any country where you have made contributions.'},
  liabilities:{t:'Loans & credit cards',d:'Anything you owe, other than mortgages (those were covered under Property).'},
  protection:{t:'Insurance',d:'Life cover, illness cover, income protection, private healthcare.'},
  incomeExp:{t:'Your spending',d:'A few yearly figures — close estimates are fine. This is the only place we ask about what you spend.'}
};
function emptyFor(s){ return s.rows?[]:(s.per?{a1:{},a2:{}}:{}); }
/* What the client's form is pre-filled with. It carries only what they are
   being asked about: a transfer value we obtained from the provider, an IHT
   position, our own workings — none of that should be sitting in a page served
   to whoever holds the link, even though no field on it would show them. */
function clientSubsetData(record){
  const d={};
  const keep=(obj,fields)=>{ const o={}; clientFields(fields).forEach(fd=>{
    if(obj&&obj[fd.id]!=null&&obj[fd.id]!=='') o[fd.id]=obj[fd.id]; }); return o; };
  CLIENT_SECTION_IDS.forEach(id=>{
    const s=sectionById(id), had=(record.data&&record.data[id])||emptyFor(s);
    if(s.rows) d[id]=(Array.isArray(had)?had:[]).map(r=>keep(r,s.cols));
    else if(s.per) d[id]={a1:keep(had.a1,s.fields),a2:keep(had.a2,s.fields)};
    else d[id]=keep(had,s.fields);
  });
  return d;
}
function recordName(record){
  const p=(record.data&&record.data.personal)||{}, a=p.a1||{}, b=p.a2||{};
  const n1=[a.firstName,a.surname].filter(Boolean).join(' ');
  const n2=[b.firstName,b.surname].filter(Boolean).join(' ');
  if(n1&&n2) return a.surname&&a.surname===b.surname? a.firstName+' & '+b.firstName+' '+a.surname : n1+' & '+n2;
  return n1||n2||record.name||'Unnamed client';
}
let _mid=0;
function mergeId(){ return 'r-'+Date.now().toString(36)+'-'+(++_mid); }
/* Pure merge of a client's submitted answers into their record. Non-empty
   answers win. Returns a human summary of what changed.

   Repeating tables are merged, never replaced. The client's form no longer
   carries the transfer value, the CETV, the exit fee or the ceding-scheme
   answers, so rebuilding a table from their reply would throw away everything
   the adviser and the admin had already put in. Entries are matched on their
   policy number or name and updated in place; anything the client did not
   mention is left alone, because it may be an entry only we know about. */
function mergeSubmission(record,data){
  const summary=[];
  record.data=record.data||{};
  const norm=v=>String(v==null?'':v).toLowerCase().replace(/[^a-z0-9]/g,'');
  CLIENT_SECTION_IDS.forEach(id=>{
    const inc=data&&data[id]; if(inc==null) return;
    const s=sectionById(id); if(!s) return;
    if(s.rows){
      if(Array.isArray(inc)&&inc.length){
        const cols=s.cols||[];
        const keyCol=['policyNo','name','lender','bank','provider','address','scheme']
          .find(k=>cols.some(x=>x.id===k)) || (cols.find(x=>x.req)||{}).id;
        const had=Array.isArray(record.data[id])?record.data[id].slice():[];
        const claimed={}, out=[];
        inc.forEach(r=>{
          let row=null;
          if(keyCol&&norm(r&&r[keyCol])){
            for(let i=0;i<had.length;i++){
              if(!claimed[i]&&norm(had[i][keyCol])===norm(r[keyCol])){ row=had[i]; claimed[i]=1; break; }
            }
          }
          if(!row) row={_id:mergeId()};
          clientFields(cols).forEach(fd=>{ const v=r&&r[fd.id];
            if(v!=null&&String(v).trim()!=='') row[fd.id]=String(v).slice(0,2000); });
          out.push(row);
        });
        let kept=0;
        had.forEach((e,i)=>{ if(!claimed[i]&&out.indexOf(e)<0){ out.push(e); kept++; } });
        record.data[id]=out;
        summary.push(s.name+': '+inc.length+' entr'+(inc.length===1?'y':'ies')
          +(kept?', '+kept+' of yours kept':''));
      }
      return;
    }
    let n=0;
    const into=(dst,src)=>{ if(!src||typeof src!=='object') return;
      clientFields(s.fields).forEach(fd=>{ const v=src[fd.id];
        if(v!=null&&String(v).trim()!==''&&String(v)!==String(dst[fd.id]||'')){ dst[fd.id]=String(v).slice(0,4000); n++; } }); };
    if(s.per==='applicant'){
      record.data[id]=record.data[id]||{a1:{},a2:{}};
      record.data[id].a1=record.data[id].a1||{}; record.data[id].a2=record.data[id].a2||{};
      into(record.data[id].a1,inc.a1); into(record.data[id].a2,inc.a2);
    } else { record.data[id]=record.data[id]||{}; into(record.data[id],inc); }
    if(n) summary.push(s.name+': '+n+' answer'+(n===1?'':'s'));
  });
  record.name=recordName(record);
  record.status='Fact Find returned';
  record.updated=new Date().toISOString();
  return summary;
}
const SJB_SHARED={CFG,SECTIONS,L,CURRENCIES,CCY_SYM,sectionById,listFor,
  CLIENT_SECTION_IDS,CLIENT_COPY,clientFields,clientSubsetData,recordName,mergeSubmission,emptyFor,
  dpSettings,dpGaps,privacyNotice,DP_CONSENT};
if(typeof module!=='undefined'&&module.exports) module.exports=SJB_SHARED;
else if(typeof globalThis!=='undefined') globalThis.SJB_SHARED=SJB_SHARED;
