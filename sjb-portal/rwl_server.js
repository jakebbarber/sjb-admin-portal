'use strict';
/* ===========================================================================
   SJB Admin Portal — RWL Review (server side).

   Two jobs with a Reason Why Letter:
     1. pre-check it against the Blacktower review rubric before it is sent;
     2. take the email Compliance sent back and turn every point into a Word
        tracked change, plus a draft reply.

   Claude only ever sees the letter text and the compliance email, from this
   file, server-side. It returns JSON to a fixed schema; the code here (not
   the model) writes the edits into the .docx as w:ins / w:del under one
   author, so the adviser accepts or rejects each one in Word.

   Runs wherever app.js runs. Needs deps.fflate (zip), and either
   deps.claudeKey (Anthropic API key) or deps.mockAI (sandbox).
   ========================================================================= */

/* ------------------------------- rubric -------------------------------- */
/* Distilled from the BT Sales Manual and the objections that keep coming
   back. Add a rule here the next time a new type of objection appears. */
const RWL_RUBRIC=[
  {id:'R1',section:'RWL contents',severity:'must',rule:'The recommendation must rest on stated client objectives recorded in the fact find, and the letter must explain why the recommended action meets them. The strongest reasons (for example cross-border residence, where benefits will be drawn, religious or ethical investment requirements, an ongoing advisory relationship) must be the stated rationale, not an afterthought.'},
  {id:'R2',section:'Cashflow',severity:'must',rule:'If a cashflow forecast is included, the letter must say what it does and does not show. If the forecast shows the client meets their retirement objective with or without the transaction, the letter must say so plainly and must not present the cashflow as the reason for the recommendation.'},
  {id:'R3',section:'Cashflow',severity:'must',rule:'Material assumptions behind a cashflow forecast (continuing business or employment income, contribution levels, growth, inflation, expenditure, retirement age) must be stated prominently, with the single largest driver named, and the letter must say what happens to the outcome if that assumption fails.'},
  {id:'R4',section:'13.9 Switching and transfers',severity:'must',rule:'A switch or transfer must explain why the existing arrangement no longer meets the client needs, the costs of moving, and any benefits lost (guarantees, protected tax-free cash, employer contributions, death benefits), and must confirm the benefits of moving match or outweigh staying. Where the existing scheme already provides what the client wants (flexible drawdown, death benefits, access for non-UK residents, no exit penalty), the letter must say so and then state exactly what cannot be achieved within it and why the transfer is still the better option.'},
  {id:'R5',section:'Cross-border tax',severity:'must',rule:'Where the client lives in a different country from the pension or may retire in a third country, the letter must state the current country of tax residence, explain that taxation on withdrawal depends on residence at the time benefits are drawn (including the relevant double taxation treaty), and must not assume a future retirement country as fact.'},
  {id:'R6',section:'13.5 Tax caveat',severity:'must',rule:'The letter must include the mandatory tax caveat: tax treatment depends on individual circumstances and may change; the firm is not a tax adviser; the client should obtain local tax advice before proceeding and before drawing benefits.'},
  {id:'R7',section:'13.5 Past performance',severity:'must',rule:'Past or expected investment performance must never be given as a reason for a recommendation and must not be implied (for example a bullet such as "better performance"). Future performance cannot be guaranteed and the letter must not suggest otherwise.'},
  {id:'R8',section:'Risk',severity:'must',rule:'The letter must state the client attitude to risk, capacity for loss and investment horizon, and show the recommended investment matches them. Specific risks of the recommendation (investment, currency, liquidity, provider, regulatory) must be described in plain language. Capacity for loss must be its own clearly labelled statement, not implied. For an adventurous or speculative strategy the letter must state the potential scale of loss, the possibility of significant short-term falls, and why that remains acceptable given the client\'s wider wealth and retirement plans.'},
  {id:'R9',section:'Costs',severity:'must',rule:'All initial and ongoing charges (adviser, platform or provider, fund, and any exit charges on the existing plan) must be disclosed in cash and percentage terms, compared with the existing arrangement, and the total cost of advice stated.'},
  {id:'R10',section:'Servicing and fees',severity:'must',rule:'Where a reduced or non-standard fee is agreed, the letter must say so and must confirm that the full agreed servicing proposition continues unchanged, listing what the client will receive for the ongoing fee.'},
  {id:'R11',section:'Alternatives',severity:'should',rule:'Alternatives considered (do nothing, retain and alter, alternative products or providers) must be listed with the reason each was not recommended.'},
  {id:'R12',section:'Scope and shortfalls',severity:'should',rule:'Where advice is limited at the client request, the limitation and any resulting shortfalls in other areas must be recorded.'},
  {id:'R13',section:'Consistency',severity:'must',rule:'Figures, dates, names, currencies and objectives must be consistent across the letter (fact find summary, cashflow, recommendation, charges). Any contradiction is a finding.'},
  {id:'R14',section:'Plain language',severity:'should',rule:'Statements must be evidenced from the fact find or cashflow, free of marketing language, and must not overstate benefits or certainty.'},
  {id:'R15',section:'Four Eyes',severity:'should',rule:'The letter must be ready for a second-person approval: no placeholders, template text or unresolved highlights left in.'},
  {id:'R16',section:'Cashflow matches the report',severity:'must',rule:'Where the cashflow (CashCalc) report is attached, the letter\'s cashflow summary must match it exactly: the same income, expenditure, growth, inflation and retirement-age assumptions, the same figures, the same scenarios compared (for example with and without the transfer), and the same conclusion (on track, or a shortfall and from which year). The letter must not state a figure, assumption or conclusion the report does not show, and must not leave out a shortfall or a failing scenario the report does show.'},
  {id:'R17',section:'Why not the existing plan',severity:'must',rule:'Where the rationale rests on consolidation or on receiving ongoing (cross-border) advice, the letter must say for each existing plan whether it can receive that advice and whether the other plans could be consolidated into it; if any existing plan can, the letter must say why it is not the recommended home. Consolidation and advice alone are not a sufficient rationale.'},
  {id:'R18',section:'Ongoing cost justified',severity:'must',rule:'The total ongoing cost of the recommendation (adviser, platform or custodian, discretionary or model fee, fund costs) must be added up and stated as one figure, compared with the cost of retaining the existing plans, and justified: what the client receives for the extra cost and why that is proportionate to the size of the plan and the client\'s wider wealth.'},
  {id:'R19',section:'Retirement income figures',severity:'must',rule:'Where the letter gives more than one retirement income figure (a net target, a gross target, the retirement expenditure used in the cashflow, a surplus), it must state in one place how they relate to each other (tax, currency, timing) so the figures reconcile. Income, expenditure and surplus must be the same, or explicitly converted, wherever they appear: in the fact find summary, the cashflow section and the recommendation.'}
];
const rubricText=()=>RWL_RUBRIC.map(r=>r.id+' ['+r.section+'] ('+r.severity+'): '+r.rule).join('\n');

/* ------------------------------ Word engine ----------------------------- */
const RWL_AUTHOR='SJB Admin Portal – draft for adviser';
const xUnesc=s=>s.replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const xEsc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const xNorm=s=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();

function docxOpen(fflate,bytes){
  const files=fflate.unzipSync(new Uint8Array(bytes));
  if(!files['word/document.xml']) throw new Error('Not a Word .docx file');
  return {files,xml:fflate.strFromU8(files['word/document.xml'])};
}
function docxSave(fflate,doc,xml){
  const out={};
  if(doc.files['[Content_Types].xml']) out['[Content_Types].xml']=doc.files['[Content_Types].xml'];
  for(const k of Object.keys(doc.files)) if(!out[k]) out[k]=doc.files[k];
  out['word/document.xml']=fflate.strToU8(xml);
  return fflate.zipSync(out,{level:6});
}
function docxParas(xml){
  const out=[]; const re=/<w:p[ >][\s\S]*?<\/w:p>/g; let m;
  while((m=re.exec(xml))){
    const text=xUnesc((m[0].match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join(''));
    const style=(m[0].match(/<w:pStyle w:val="([^"]+)"/)||[])[1]||'';
    out.push({i:out.length,start:m.index,end:m.index+m[0].length,xml:m[0],text,style});
  }
  return out;
}
/* MERGEFIELD codes in a document: name -> the exact field instruction, so a
   rebuilt field carries the same switches the template used. Both forms Word
   writes are read: fldSimple, and the fldChar/instrText run sequence. */
function mergeFields(xml){
  const instr=new Map(); const names=[];
  const add=code=>{ const m=/MERGEFIELD\s+(?:"([^"]+)"|(\S+))/i.exec(code); if(!m) return; const n=m[1]||m[2]; names.push(n); if(!instr.has(n)) instr.set(n,code.trim()); };
  (xml.match(/<w:fldSimple[^>]*w:instr="([^"]*)"/g)||[]).forEach(t=>add(xUnesc((/w:instr="([^"]*)"/.exec(t)||[])[1]||'')));
  (xml.match(/<w:instrText[^>]*>[^<]*<\/w:instrText>/g)||[]).forEach(t=>add(xUnesc(t.replace(/<[^>]+>/g,''))));
  return {names,instr,count:names.length};
}
/* what the document says once every tracked change is accepted */
function acceptedView(xml){
  return xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g,'').replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:pPr>[\s\S]*?<w:rPr>[^<]*<w:del\b[^>]*\/>[\s\S]*?<\/w:p>/g,m=>/<w:t[ >]/.test(m)?m:'');
}
const FIELD_TOKEN=/«([^»]{1,80})»/g;
const docxNumbered=xml=>docxParas(xml).filter(p=>p.text.trim()).map(p=>'['+p.i+']'+(p.style?' {'+p.style+'}':'')+' '+p.text.trim()).join('\n');
const pprOf=p=>(p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)||[''])[0];
const firstRpr=p=>{ const r=/<w:r(?: [^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(p); return r?r[1]:'<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'; };
const cleanRpr=r=>r.replace(/<w:highlight [^>]*\/>/g,'').replace(/<w:noProof\/>/g,'').replace(/<w:b\/>/g,'').replace(/<w:bCs\/>/g,'');

/* Apply edits as tracked changes. Edit: {op:'replace'|'insert_after'|'delete', para, anchor, lead, text, point, reason}.
   An edit whose paragraph does not match its anchor is skipped and reported, never applied to the wrong place. */
function docxRedline(xml,edits,opts){
  opts=opts||{};
  const author=opts.author||RWL_AUTHOR;
  const date=(opts.date||new Date()).toISOString().replace(/\.\d+Z$/,'Z');
  let nextId=9000; const id=()=>String(nextId++);
  const fields=mergeFields(xml);
  const fieldRuns=(name,rpr)=>{ const code=fields.instr.get(name)||('MERGEFIELD '+name+' \\* MERGEFORMAT');
    return '<w:r>'+rpr+'<w:fldChar w:fldCharType="begin"/></w:r><w:r>'+rpr+'<w:instrText xml:space="preserve"> '+xEsc(code)+' </w:instrText></w:r><w:r>'+rpr+'<w:fldChar w:fldCharType="separate"/></w:r>'
      +'<w:r>'+rpr+'<w:t xml:space="preserve">«'+xEsc(name)+'»</w:t></w:r><w:r>'+rpr+'<w:fldChar w:fldCharType="end"/></w:r>'; };
  const ins=(text,rpr,bold)=>{ const rp=bold?rpr.replace('<w:rPr>','<w:rPr><w:b/>'):rpr; let body='';
    String(text).split(/(«[^»]{1,80}»)/).forEach(part=>{ if(!part) return; const f=/^«([^»]{1,80})»$/.exec(part);
      body+=f?fieldRuns(f[1],rp):'<w:r>'+rp+'<w:t xml:space="preserve">'+xEsc(part)+'</w:t></w:r>'; });
    return '<w:ins w:id="'+id()+'" w:author="'+xEsc(author)+'" w:date="'+date+'">'+body+'</w:ins>'; };
  const fieldsIn=px=>mergeFields(px).names;
  /* a simple field becomes the complex form so its code can be deleted too */
  const expandSimple=px=>px.replace(/<w:fldSimple\b([^>]*)>([\s\S]*?)<\/w:fldSimple>/g,(m,attrs,inner)=>{
    const code=xUnesc((/w:instr="([^"]*)"/.exec(attrs)||[])[1]||''); const rp=(/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(inner)||[''])[0];
    return '<w:r>'+rp+'<w:fldChar w:fldCharType="begin"/></w:r><w:r>'+rp+'<w:instrText xml:space="preserve"> '+xEsc(code.trim())+' </w:instrText></w:r><w:r>'+rp+'<w:fldChar w:fldCharType="separate"/></w:r>'+inner+'<w:r>'+rp+'<w:fldChar w:fldCharType="end"/></w:r>'; });
  const delRuns=px=>expandSimple(px).replace(/<w:r(?: [^>]*)?>[\s\S]*?<\/w:r>/g,r=>'<w:del w:id="'+id()+'" w:author="'+xEsc(author)+'" w:date="'+date+'">'
    +r.replace(/<w:t(\s[^>]*)?>/g,'<w:delText xml:space="preserve">').replace(/<\/w:t>/g,'</w:delText>')
     .replace(/<w:instrText(\s[^>]*)?>/g,'<w:delInstrText xml:space="preserve">').replace(/<\/w:instrText>/g,'</w:delInstrText>')+'</w:del>');
  const runs=(e,rpr)=>(e.lead?ins(String(e.lead).replace(/\s*$/,' '),rpr,true):'')+ins(e.text,rpr,false);
  const applied=[],skipped=[];
  const order=edits.map((e,k)=>({e,k})).sort((a,b)=>(b.e.para|0)-(a.e.para|0));
  for(const {e,k} of order){
    const ps=docxParas(xml);
    let p=ps[e.para|0];
    const key=e.anchor?xNorm(String(e.anchor)).slice(0,60):'';
    const ok=p&&(!key||xNorm(p.text).includes(key));
    if(!ok){
      const hits=key?ps.filter(q=>xNorm(q.text).includes(key)):[];
      if(hits.length===1) p=hits[0];
      else { skipped.push({k,edit:e,why:hits.length>1?'anchor text appears more than once':'paragraph not found'}); continue; }
    }
    const rpr=cleanRpr(firstRpr(p.xml));
    let body;
    if(e.op==='delete'){
      body=delRuns(p.xml);
      const mark='<w:del w:id="'+id()+'" w:author="'+xEsc(author)+'" w:date="'+date+'"/>';
      if(/<w:pPr>[\s\S]*?<w:rPr>/.test(body)) body=body.replace(/(<w:pPr>[\s\S]*?<w:rPr>)/,'$1'+mark);
      else if(/<w:pPr>/.test(body)) body=body.replace(/<\/w:pPr>/,'<w:rPr>'+mark+'</w:rPr></w:pPr>');
      else body=body.replace(/^(<w:p[^>]*>)/,'$1<w:pPr><w:rPr>'+mark+'</w:rPr></w:pPr>');
      xml=xml.slice(0,p.start)+body+xml.slice(p.end);
    } else if(e.op==='replace'){
      if(!e.text){ skipped.push({k,edit:e,why:'no replacement text'}); continue; }
      const had=fieldsIn(p.xml); const kept=new Set((String(e.text).match(FIELD_TOKEN)||[]).map(t=>t.slice(1,-1)));
      const lost=had.filter(n=>!kept.has(n));
      if(lost.length){ skipped.push({k,edit:e,why:'would remove the mail-merge field'+(lost.length>1?'s':'')+' «'+lost.join('», «')+'»; keep the field in the new wording'}); continue; }
      body=delRuns(p.xml).replace(/<\/w:p>$/,runs(e,rpr)+'</w:p>');
      xml=xml.slice(0,p.start)+body+xml.slice(p.end);
    } else if(e.op==='insert_after'){
      if(!e.text){ skipped.push({k,edit:e,why:'no text to insert'}); continue; }
      let ppr=pprOf(p.xml).replace(/ w:rsid[A-Za-z]*="[^"]*"/g,'').replace(/<w:numPr>[\s\S]*?<\/w:numPr>/,'');
      const mark='<w:ins w:id="'+id()+'" w:author="'+xEsc(author)+'" w:date="'+date+'"/>';
      if(/<w:rPr>/.test(ppr)) ppr=ppr.replace('<w:rPr>','<w:rPr>'+mark);
      else if(ppr) ppr=ppr.replace('</w:pPr>','<w:rPr>'+mark+'</w:rPr></w:pPr>');
      else ppr='<w:pPr><w:rPr>'+mark+'</w:rPr></w:pPr>';
      const paras=String(e.text).split(/\n{2,}/).filter(Boolean);
      const built=paras.map((t,n)=>'<w:p>'+ppr+runs({lead:n===0?e.lead:'',text:t},rpr)+'</w:p>').join('');
      xml=xml.slice(0,p.end)+built+xml.slice(p.end);
    } else { skipped.push({k,edit:e,why:'unknown operation '+e.op}); continue; }
    applied.push({k,edit:e});
  }
  const count=re=>(xml.match(re)||[]).length;
  if(count(/<w:ins /g)-count(/<w:ins [^>]*\/>/g)!==count(/<\/w:ins>/g)||count(/<w:del /g)-count(/<w:del [^>]*\/>/g)!==count(/<\/w:del>/g))
    throw new Error('tracked-change markup unbalanced; refusing to write');
  applied.sort((a,b)=>a.k-b.k); skipped.sort((a,b)=>a.k-b.k);
  const before=fields, after=mergeFields(acceptedView(xml));
  const missing=[...new Set(before.names)].filter(n=>!after.names.includes(n));
  const merge={before:before.count,after:after.count,missing,names:[...new Set(before.names)]};
  return {xml,applied,skipped,insertions:count(/<w:ins w:id=/g),deletions:count(/<w:del w:id=/g),merge};
}

/* --------------------------------- Claude ------------------------------- */
const RWL_MODEL='claude-opus-5-5';
const SYSTEM_PRECHECK=rb=>'You are the compliance reviewer for a regulated financial advice firm. You check a Reason Why Letter (suitability report) before it is submitted to the network\'s Compliance department, using the firm\'s review rubric below. You are rigorous, specific and fair: you only raise a finding you can point to in the letter (or a clear omission), you quote the paragraph number, and you say exactly what would satisfy the rule. You never invent client facts. Where a rule needs facts the letter does not contain (for example the client\'s current tax residence), say what is missing rather than guessing it.\n\nFor every finding give "quote": the exact sentence or phrase from the letter the finding rests on (empty only when the finding is an omission), and "manual_ref": the rubric id and, where the manual is provided, the manual section or a short excerpt that the rule comes from, so the adviser can see the authority.\n\nRUBRIC\n'+rb.rubricText;
const SYSTEM_EDITS=rb=>'You are a senior paraplanner at a regulated financial advice firm. The network\'s Compliance department has returned a Reason Why Letter (suitability report) with points that must be addressed before it can be approved. Your job is to draft the precise edits that answer every point, as changes to the letter\'s existing paragraphs, and a short covering reply to Compliance that maps each point to the change made.\n\nRules you must follow:\n- Use only facts that are in the letter or in the compliance email. If a point needs a fact that neither contains, do not invent it: write the sentence with a clearly marked placeholder in square brackets, e.g. [confirm current country of tax residence], and list it under "needs_adviser".\n- Keep the adviser\'s voice and the letter\'s existing structure. Prefer inserting a new paragraph after an existing one, or replacing a paragraph, over rewriting whole sections.\n- Each edit refers to a paragraph by its number [n] from the numbered letter, and quotes the first words of that paragraph as the anchor so the system can verify it.\n- A "delete" removes a paragraph that must not be there (for example a reason that cannot be evidenced). A "replace" rewrites one paragraph. An "insert_after" adds one or more new paragraphs (separate them with a blank line) after paragraph n; an optional bold "lead" starts the first new paragraph.\n- Never add promises about investment performance, never remove a risk warning, never change figures.\n- Text shown as «Field_Name» is a mail-merge field: keep it exactly as it is in any paragraph you replace.\n- Write in plain UK English, in the second person to the client, with the firm\'s compliance rubric below in mind so the revised letter would also pass a fresh review.\n- For every point in the compliance email give "rule": the id of the checklist rule it corresponds to, or "NEW" if no rule covers it, in which case put a one-sentence rule the checklist should gain in "new_rule" (otherwise leave new_rule empty).\n\nRUBRIC\n'+rb.rubricText;
const FINDINGS_SCHEMA={type:'object',additionalProperties:false,required:['ready_to_submit','summary','findings'],properties:{
  ready_to_submit:{type:'boolean'},summary:{type:'string'},
  findings:{type:'array',items:{type:'object',additionalProperties:false,required:['rule','severity','paragraph','issue','fix','quote','manual_ref'],properties:{
    rule:{type:'string'},severity:{type:'string',enum:['must','should']},paragraph:{type:['integer','null']},issue:{type:'string'},fix:{type:'string'},quote:{type:'string'},manual_ref:{type:'string'}}}}}};
const EDITS_SCHEMA={type:'object',additionalProperties:false,required:['points','edits','reply','needs_adviser'],properties:{
  points:{type:'array',items:{type:'object',additionalProperties:false,required:['n','summary','rule','new_rule'],properties:{n:{type:'integer'},summary:{type:'string'},rule:{type:'string'},new_rule:{type:'string'}}}},
  edits:{type:'array',items:{type:'object',additionalProperties:false,required:['op','para','anchor','lead','text','point','reason'],properties:{
    op:{type:'string',enum:['replace','insert_after','delete']},para:{type:'integer'},anchor:{type:'string'},lead:{type:'string'},text:{type:'string'},point:{type:'integer'},reason:{type:'string'}}}},
  reply:{type:'string'},needs_adviser:{type:'array',items:{type:'string'}}}};

/* Messages API over fetch: this Worker is uploaded unbundled, so there is no
   npm package to import. Request shape follows the Anthropic SDK defaults
   (structured output, effort, cached system prompt, default fallbacks). */
/* Two layers of backup, both within Claude:
   - fallbacks:'default' (server side): if the main model declines a request,
     Anthropic re-routes it to another Claude model.
   - outage fallback (here): a rate limit, overload, server error or network
     failure is retried once on the main model, then once on the backup model
     (CLAUDE_FALLBACK_MODEL, default Sonnet). A 4xx that is our own mistake
     (bad request, bad key) is not retried. The case history records which
     model answered, so a check done by the backup is visible. */
const RWL_FALLBACK_MODEL='claude-sonnet-5-5';
const RETRY_STATUS=new Set([408,409,425,429,500,502,503,504,529]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function claudeOnce(deps,rb,system,user,schema,model){
  const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{
      'content-type':'application/json','x-api-key':deps.claudeKey,'anthropic-version':'2023-06-01',
      'anthropic-beta':'server-side-fallback-2026-07-01'},
    body:JSON.stringify({model,max_tokens:16000,fallbacks:'default',
      output_config:{effort:'high',format:{type:'json_schema',schema}},
      system:rb.manual?[{type:'text',text:system},{type:'text',text:'SALES MANUAL — the network\'s current manual ('+rb.manualName+'). It is the authority behind the rubric; where the two differ, follow the manual and say so.\n\n'+rb.manual,cache_control:{type:'ephemeral'}}]
        :[{type:'text',text:system,cache_control:{type:'ephemeral'}}],
      messages:[{role:'user',content:user}]})});
  const r=await res.json().catch(()=>({}));
  if(!res.ok){ const e=new Error((r.error&&r.error.message)||('Claude API error '+res.status)); e.status=res.status; e.retryable=RETRY_STATUS.has(res.status); throw e; }
  if(r.stop_reason==='refusal') throw new Error('The model declined this request'+(r.stop_details&&r.stop_details.explanation?': '+r.stop_details.explanation:''));
  if(r.stop_reason==='max_tokens') throw new Error('The answer was cut off; the letter may be too long for one pass');
  const text=(r.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  return {data:JSON.parse(text),usage:r.usage||null,model:r.model||model};
}
async function askClaude(deps,rb,system,user,schema){
  if(!deps.claudeKey) throw new Error('ANTHROPIC_API_KEY is not set on this server (or set MOCK_AI=1 for the sandbox)');
  const main=deps.claudeModel||RWL_MODEL, backup=deps.claudeFallbackModel||RWL_FALLBACK_MODEL;
  const plan=[main,main].concat(backup&&backup!==main?[backup]:[]);
  let last;
  for(let i=0;i<plan.length;i++){
    try{ const r=await claudeOnce(deps,rb,system,user,schema,plan[i]); if(i>0) r.fellBack=plan[i]!==main; return r; }
    catch(e){ last=e; const transient=e.retryable||(!e.status&&!(e instanceof SyntaxError)); if(!transient) throw e; if(i<plan.length-1) await sleep(deps.retryWait!=null?deps.retryWait:1500); }
  }
  throw new Error('The reviewer could not be reached (main and backup model): '+(last&&last.message||'unknown error'));
}

/* sandbox mock: fixed, plausible answers keyed off words in the letter */
const findPara=(letter,needle)=>{ const m=letter.split('\n').find(l=>l.toLowerCase().includes(needle.toLowerCase())); return m?parseInt(m.slice(1),10):null; };
const anchorOf=(letter,n)=>{ const l=letter.split('\n').find(x=>x.startsWith('['+n+']'))||''; return l.replace(/^\[\d+\]\s*(\{[^}]*\}\s*)?/,'').slice(0,60); };
function mockFindings(letter,report){
  const perf=findPara(letter,'better performance'), cash=findPara(letter,'cashflow');
  const r16=report&&/shortfall/i.test(report)&&!/shortfall/i.test(letter)?[{rule:'R16',severity:'must',paragraph:findPara(letter,'sufficient')||cash,issue:'The letter says the forecast meets the retirement income target in every year, but the CashCalc report shows a shortfall.',fix:'Say what the report shows: in which scenario and from which year the shortfall appears, and what it means for the recommendation.',quote:anchorOf(letter,findPara(letter,'sufficient')||cash),manual_ref:'R16 · cashflow summary must match the report (sandbox mock)'}]:[];
  return {ready_to_submit:false,
    summary:'Sandbox mock. The letter leans on the cashflow and on performance rather than on the client objectives; tax residence on withdrawal and the fee/servicing wording need attention.',
    findings:[
      {rule:'R7',severity:'must',paragraph:perf,issue:'A bullet gives better performance as a reason for the transfer.',fix:'Remove the bullet; performance cannot be evidenced or guaranteed.',quote:'Better Performance',manual_ref:'R7 · Sales Manual 13.5: past performance is not a basis for a recommendation'},
      {rule:'R2',severity:'must',paragraph:cash,issue:'The cashflow shows the objective is met either way, but the letter presents it as supporting the transfer.',fix:'State plainly that the recommendation does not rest on retirement income need, and give the real reasons.',quote:anchorOf(letter,cash),manual_ref:'R2 · RWL must explain why the recommendation meets the objectives'},
      {rule:'R5',severity:'must',paragraph:null,issue:'Current country of tax residence and the tax position on withdrawal are not stated.',fix:'Add a paragraph on current residence, withdrawal taxation and the need for local tax advice.',quote:'',manual_ref:'R5 · cross-border tax disclosure; R6 · Sales Manual 13.5 tax caveat'},
      {rule:'R10',severity:'should',paragraph:findPara(letter,'reduced fee'),issue:'Reduced fee stated without confirming the service is unchanged.',fix:'Add that the full servicing proposition continues.',quote:'we have agreed to apply a reduced fee structure',manual_ref:'R10 · servicing proposition'}].concat(r16)};
}
function mockEdits(letter){
  const perf=findPara(letter,'better performance'), cash=findPara(letter,'cashflow'), fee=findPara(letter,'reduced fee');
  const edits=[];
  if(cash!=null) edits.push({op:'insert_after',para:cash,anchor:anchorOf(letter,cash),lead:'Key assumptions behind the forecast.',text:'The forecast assumes your business income continues at its current level throughout the forecast period. That is the single largest driver of the result. If it reduces or stops, the outcome would look materially different, and we will review this assumption with you at each annual review.',point:1,reason:'Assumptions must be prominent (R3).'});
  if(perf!=null) edits.push({op:'delete',para:perf,anchor:'better performance',lead:'',text:'',point:2,reason:'Performance cannot be a reason for a recommendation (R7).'});
  if(fee!=null) edits.push({op:'replace',para:fee,anchor:anchorOf(letter,fee),lead:'',text:'Following our discussions we have agreed a reduced fee structure. This does not reduce the service you receive: you will continue to receive the full agreed servicing proposition set out below.',point:3,reason:'Servicing must be confirmed unchanged (R10).'});
  return {points:[{n:1,summary:'Cashflow assumptions need prominence',rule:'R3',new_rule:''},{n:2,summary:'Remove better performance',rule:'R7',new_rule:''},{n:3,summary:'Fee reduction must confirm servicing continues',rule:'R10',new_rule:''}],
    edits,reply:'Thank you for the review. Point 1: a new paragraph on the key assumptions now follows the cashflow summary. Point 2: the performance bullet has been removed. Point 3: the fee paragraph now confirms the full servicing proposition continues. (Sandbox mock reply.)',
    needs_adviser:['[confirm current country of tax residence]']};
}
async function rwlPrecheck(deps,rb,letter,report){
  if(deps.mockAI) return {data:mockFindings(letter,report),usage:null,model:'mock'};
  const rep=report?'\n\nThe adviser\'s cashflow (CashCalc) report for this client is attached below. Rule R16 applies: compare the letter\'s cashflow summary with it line by line (assumptions, figures, scenarios, conclusion) and raise a finding for every difference and every omission, quoting the letter and naming what the report shows instead.\n\n<cashflow_report>\n'+report+'\n</cashflow_report>':'';
  return askClaude(deps,rb,SYSTEM_PRECHECK(rb),'Review the following Reason Why Letter against the rubric. Paragraphs are numbered [n].\n\n<letter>\n'+letter+'\n</letter>'+rep,FINDINGS_SCHEMA);
}
async function rwlPlan(deps,rb,letter,email){
  if(deps.mockAI) return {data:mockEdits(letter),usage:null,model:'mock'};
  return askClaude(deps,rb,SYSTEM_EDITS(rb),'Here is the compliance email returning the letter, then the letter with numbered paragraphs [n]. Produce the edits that answer every point, and the covering reply.\n\n<compliance_email>\n'+email+'\n</compliance_email>\n\n<letter>\n'+letter+'\n</letter>',EDITS_SCHEMA);
}


/* --------------------------- automatic checks --------------------------- */
/* Things a prompt should never be trusted with: figures that must agree,
   names, dates, template residue, sentences nobody can read. Pure code,
   run on every pre-check and merged into the findings as rules C1..C7. */
function editDistance(a,b){ const m=a.length,n=b.length; const d=Array.from({length:m+1},(_,i)=>[i].concat(new Array(n).fill(0))); for(let j=1;j<=n;j++) d[0][j]=j; for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[m][n]; }
const paraLines=letter=>letter.split('\n').map(l=>{ const m=/^\[(\d+)\](?:\s*\{[^}]*\})?\s*(.*)$/.exec(l); return m?{n:+m[1],text:m[2]}:null; }).filter(Boolean);
function codeChecks(letter,opts){
  const out=[]; const P=paraLines(letter);
  const F=(rule,severity,paragraph,issue,fix,quote)=>out.push({rule,severity,paragraph,issue,fix,quote:quote||'',manual_ref:'Automatic check'});
  /* C1 names: the salutation surname should be the only surname with a title */
  const dear=P.map(p=>/^Dear\s+(?:Mr|Mrs|Ms|Miss|Mx|Dr)\.?\s+([A-Z][\w'-]+)/i.exec(p.text)).find(Boolean);
  if(dear){ const sur=dear[1]; const seen=new Map();
    P.forEach(p=>{ const re=/\b(?:Mr|Mrs|Ms|Miss|Mx|Dr)\.?\s+((?:[A-Z][\w'-]+\s+){0,2}[A-Z][\w'-]+)/g; let m; while((m=re.exec(p.text))){ const last=m[1].trim().split(/\s+/).pop(); if(last.toLowerCase()!==sur.toLowerCase()&&!seen.has(last)) seen.set(last,p.n); } });
    seen.forEach((n,name)=>F('C1','must',n,'The letter is addressed to '+sur+' but also refers to '+name+'.','Check the name: a wrong name is an automatic bounce-back.',name));
    /* and the same surname spelled two ways (Occhetti / Ochetti): a capitalised word one or two edits from it */
    const near=new Map();
    P.forEach(p=>{ (p.text.match(/\b[A-Z][a-z][\w'-]{2,}\b/g)||[]).forEach(w=>{ if(w.toLowerCase()!==sur.toLowerCase()&&Math.abs(w.length-sur.length)<=2&&sur.length>=4&&editDistance(w.toLowerCase(),sur.toLowerCase())<=Math.max(1,Math.floor(sur.length/5))&&!near.has(w)) near.set(w,p.n); }); });
    near.forEach((n,w)=>F('C1','must',n,'The surname is spelled "'+sur+'" in the salutation but "'+w+'" at paragraph '+n+'.','Make the spelling the same throughout; a misspelt client name is an automatic bounce-back.',w));
  }
  /* C2 fees: one percentage per fee term across the letter */
  const terms=[['initial fee',/initial (?:advice |adviser )?fee/i],['ongoing fee',/ongoing (?:advice |adviser |advisory )?fee/i],['platform charge',/platform (?:fee|charge)/i],['fund charge',/(?:fund|portfolio|ongoing) charge/i]];
  terms.forEach(([label,re])=>{ const found=new Map();
    P.forEach(p=>{ p.text.split(/(?<=[.;!?])\s+/).forEach(sent=>{ if(re.test(sent)){ (sent.match(/\d+(?:\.\d+)?\s?%/g)||[]).forEach(v=>{ const k=v.replace(/\s/g,''); if(!found.has(k)) found.set(k,p.n); }); } }); });
    if(found.size>1) F('C2','must',[...found.values()][1],'The '+label+' appears with more than one figure: '+[...found.keys()].join(', ')+' (paragraphs '+[...found.values()].join(', ')+').','Make the figure the same everywhere, or say plainly why two figures apply.',[...found.keys()].join(' / '));
  });
  /* C3 dates: nothing in the future, and the meeting before the letter */
  const today=new Date(); const dates=[];
  P.forEach(p=>{ const re=/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g; let m; while((m=re.exec(p.text))){ const d=new Date(+m[3],+m[2]-1,+m[1]); if(!isNaN(d)) dates.push({d,n:p.n,s:m[0]}); } });
  const future=dates.find(x=>x.d>new Date(today.getTime()+86400000));
  if(future) F('C3','must',future.n,'A date in the letter is in the future: '+future.s+'.','Check the date.',future.s);
  const letterDate=dates[0]; const meet=P.map(p=>({p,m:/(?:meeting|spoke|telephone|call|met)[^.]{0,60}?\bon\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(p.text)})).find(x=>x.m);
  if(letterDate&&meet){ const [dd,mm,yy]=meet.m[1].split('/'); const md=new Date(+yy,+mm-1,+dd); if(md>letterDate.d) F('C3','should',meet.p.n,'The meeting date ('+meet.m[1]+') is after the letter date ('+letterDate.s+').','Check which is wrong.',meet.m[1]); }
  /* C4 currencies: say which currency, and the basis, when more than one is used */
  const ccy=new Set(); P.forEach(p=>{ if(/\bGBP\b|£/.test(p.text)) ccy.add('GBP'); if(/\bEUR\b|€/.test(p.text)) ccy.add('EUR'); if(/\bUSD\b|\$/.test(p.text)) ccy.add('USD'); });
  if(ccy.size>1) F('C4','should',null,'The letter uses more than one currency ('+[...ccy].join(', ')+').','Make sure every figure says its currency, and state the exchange basis used for any comparison.','');
  /* C5 template residue */
  const res=P.find(p=>/\[[^\]]{2,60}\]|\bTBC\b|\bXXX+\b|\bINSERT\b|\{\{|<<|>>/.test(p.text)&&!/^\[\d+\]/.test(p.text));
  if(res) F('C5','must',res.n,'Template residue or a placeholder is still in the letter.','Fill it in or remove it before it goes anywhere.',(res.text.match(/\[[^\]]{2,60}\]|\bTBC\b|\bXXX+\b|\bINSERT\b|\{\{.*?\}\}|<<.*?>>/)||[''])[0]);
  /* C6 readability: sentences nobody can follow */
  const long=[]; let words=0,sents=0;
  P.forEach(p=>{ const ss=p.text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(x=>x.trim().length>2); ss.forEach(x=>{ const w=x.trim().split(/\s+/).length; words+=w; sents++; if(w>55) long.push({n:p.n,w,x}); }); });
  if(long.length) F('C6','should',long[0].n,long.length+' sentence'+(long.length===1?'':'s')+' run'+(long.length===1?'s':'')+' past 55 words (the longest is '+Math.max(...long.map(l=>l.w))+').','Split them. Consumer Duty asks for letters a client can follow at first reading.',long[0].x.slice(0,120));
  /* C7 template drift */
  if(opts&&opts.template&&opts.template.status!=='aligned') F('C7','should',null,'Built from the template "'+opts.template.name+'", which has not been aligned with the manual.','Align the template in RWL Templates so the next letter starts clean.','');
  /* C9 the same quantity with different figures in different places: income,
     expenditure, surplus, assets, retirement income. The commonest form is a
     cashflow section in one currency and a fact find summary in another. */
  const QTY=[['income',/\b(?:gross|net|employment|total|annual|household)?\s?income\b/i],['expenditure',/\bexpenditure|\bspending|\boutgoings/i],['surplus',/\bsurplus\b/i],['assets',/\b(?:total|current|investable|net)\s+assets\b/i],['retirement income target',/retirement income(?: target| objective| need)?/i]];
  const AMT=/(£|€|\$|\b(?:GBP|EUR|USD|CHF)\b)\s?(\d[\d,]*(?:\.\d+)?)\s?([km])?\b/gi;
  QTY.forEach(([label,re])=>{ const seenQ=new Map();
    /* each amount belongs to the clause it sits in ("income of X a year and expenditure of Y": two clauses), so one label never collects the other's figure */
    P.forEach(p=>{ p.text.split(/(?<=[.;!?])\s+/).forEach(sent=>{ if(/convert|exchange rate|equivalent|at a rate|approximately the same/i.test(sent)) return; sent.split(/,\s+(?=[A-Za-z])|;|\band\b|\bwhile\b|\bwhereas\b|\bagainst\b/i).forEach(cl=>{ if(!re.test(cl)) return; let m; const a=new RegExp(AMT.source,'gi'); while((m=a.exec(cl))){ const ccy=/£|GBP/i.test(m[1])?'GBP':/€|EUR/i.test(m[1])?'EUR':'USD'; const v=numNorm(m[2]+(m[3]||'')); if(v==null||v<1000) continue; const k=ccy+' '+v; if(!seenQ.has(k)) seenQ.set(k,{ccy,v,n:p.n,raw:m[0].trim()}); } }); }); });
    if(seenQ.size>1){ const xs=[...seenQ.values()]; const ccys=new Set(xs.map(x=>x.ccy)); const sev=ccys.size>1?'should':'must';
      F('C9',sev,xs[1].n,'The '+label+' is given as '+xs.map(x=>x.raw+' (para '+x.n+')').join(' and ')+'.',ccys.size>1?'Different currencies for the same figure: say which is the source figure, give the exchange rate used, and make the cashflow narrative and the fact find summary agree.':'Make the figure the same everywhere, or say plainly why two figures apply.',xs.map(x=>x.raw).join(' / ')); }
  });
  /* C10 a plan with two values (transfer value against fund value with a protected benefit) */
  const tv=[],fv=[];
  P.forEach(p=>{ p.text.split(/(?<=[.;!?])\s+/).forEach(sent=>{ let m; const a=new RegExp(AMT.source,'gi'); const isTV=/transfer value|cash equivalent|CETV/i.test(sent), isFV=/\b(?:fund|plan|policy|current|total)\s+value\b/i.test(sent); if(!isTV&&!isFV) return; while((m=a.exec(sent))){ const v=numNorm(m[2]+(m[3]||'')); if(v==null||v<1000) continue; (isTV&&!isFV?tv:fv).push({v,raw:m[0].trim(),n:p.n}); } }); });
  if(tv.length&&fv.length){ const diff=fv.find(f=>!tv.some(t=>t.v===f.v)); if(diff&&!P.some(p=>/(protected|guaranteed|safeguarded|RST|with.?profits|bonus|penalty|less|after)[^.]{0,80}(transfer value|fund value)|(transfer value|fund value)[^.]{0,80}(protected|guaranteed|safeguarded|RST|bonus|penalty|differ|less)/i.test(p.text)))
    F('C10','should',diff.n,'The plan is valued at '+tv[0].raw+' as a transfer value and '+diff.raw+' as a fund value.','Say in one place why the two differ (for example a protected benefit that does not transfer), so neither Compliance nor the client has to work it out.',tv[0].raw+' / '+diff.raw); }
  /* C8 cashflow summary against the CashCalc report */
  const cf=cashflowCheck(letter,opts&&opts.report); cf.findings.forEach(f=>out.push(f));
  return {checks:out,readability:{avgSentence:sents?Math.round(words/sents):0,longSentences:long.length,sentences:sents},cashflow:{paras:cf.paras,compared:cf.compared,missing:cf.missing,attached:!!(opts&&opts.report)}};
}
/* C8 cashflow reconciliation: every figure in the letter's cashflow summary
   must appear in the attached CashCalc report. Pure code: money, percentages,
   ages and years are pulled out of both and compared as numbers, so a summary
   that says EUR 90,000 when the report says EUR 85,000 is caught before
   Compliance catches it. The reviewer (R16) then reads both for assumptions,
   scenarios and the conclusion, which no regex can do. */
const paraStyled=letter=>letter.split('\n').map(l=>{ const m=/^\[(\d+)\](?:\s*\{([^}]*)\})?\s*(.*)$/.exec(l); return m?{n:+m[1],style:m[2]||'',text:m[3]}:null; }).filter(Boolean);
const CASHFLOW_WORDS=/cash\s*flow|cashcalc|forecast|projection|on track|shortfall/i;
function cashflowParas(letter){
  const P=paraStyled(letter); const out=[]; let inSection=false;
  P.forEach(p=>{ const heading=/^Heading/i.test(p.style)||(p.text.length<70&&!/[.!?]$/.test(p.text)&&/cash\s*flow|forecast/i.test(p.text));
    if(heading) inSection=/cash\s*flow|cashcalc|forecast|projection/i.test(p.text);
    else if(inSection||CASHFLOW_WORDS.test(p.text)) out.push(p); });
  return out;
}
const numNorm=s=>{ let t=String(s).replace(/[,\s]/g,'').toLowerCase(); let k=1; if(/k$/.test(t)){ k=1000; t=t.slice(0,-1); } if(/m$/.test(t)){ k=1000000; t=t.slice(0,-1); } const v=parseFloat(t); return isNaN(v)?null:Math.round(v*k*100)/100; };
function figuresOf(text){
  const out=[]; const seen=new Set(); const add=(kind,raw,v)=>{ if(v==null) return; const key=kind+':'+v; if(seen.has(key)) return; seen.add(key); out.push({kind,raw,v}); };
  const t=String(text).replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,' ');            /* dates are C3's business */
  let m; const money=/(?:£|€|\$|\b(?:GBP|EUR|USD|CHF)\b)\s?(\d[\d,]*(?:\.\d+)?\s?[km]?)\b|\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/gi;
  while((m=money.exec(t))) add('amount',m[0].trim(),numNorm(m[1]||m[2]));
  const pct=/(\d+(?:\.\d+)?)\s?%/g; while((m=pct.exec(t))) add('percent',m[0],numNorm(m[1]));
  const age=/\b(?:age|aged|at|until|to|from)\s+(\d{2})\b(?!\s?%)/gi; while((m=age.exec(t))){ const v=+m[1]; if(v>=40&&v<=100) add('age',m[0],v); }
  const yr=/\b(20[2-9]\d)\b/g; while((m=yr.exec(t))) add('year',m[0],+m[1]);
  return out;
}
function cashflowCheck(letter,report){
  const paras=cashflowParas(letter); if(!paras.length) return {findings:[],compared:0,missing:[],paras:0};
  if(!report) return {findings:[{rule:'C8',severity:'should',paragraph:paras[0].n,issue:'The letter has a cashflow summary but no CashCalc report is attached, so its figures could not be reconciled.',fix:'Attach the CashCalc report to this case and run the check again. A summary that does not match the report is one of the commonest bounce-backs.',quote:paras[0].text.slice(0,120),manual_ref:'Automatic check · R16'}],compared:0,missing:[],paras:paras.length};
  const have=new Set(figuresOf(report).map(f=>f.kind+':'+f.v)); const haveLoose=new Set(figuresOf(report).map(f=>f.v));
  const missing=[]; let compared=0;
  paras.forEach(p=>figuresOf(p.text).forEach(f=>{ compared++; if(!have.has(f.kind+':'+f.v)&&!(f.kind!=='percent'&&haveLoose.has(f.v))) missing.push({...f,n:p.n}); }));
  const findings=missing.map(x=>({rule:'C8',severity:'must',paragraph:x.n,issue:'The cashflow summary gives '+x.raw+', which is not in the CashCalc report.',fix:'Make the letter say what the report says, or re-run the report. Every figure in the cashflow summary must come from the attached report.',quote:x.raw,manual_ref:'Automatic check · R16'}));
  return {findings,compared,missing:missing.map(x=>x.raw),paras:paras.length};
}
const scoreOf=findings=>{ const m=findings.filter(f=>f.severity==='must').length, sh=findings.length-m; return Math.max(0,100-15*m-5*sh); };
async function sha256(text){ const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
const csvCell=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';

/* ------------------------------- storage -------------------------------- */
/* Word files live in the same store as everything else, as base64 chunks,
   like the portal's existing template uploads. Letters are 100-300 KB. */
const CHUNK=600000;
function bytesToB64(u8){ let s=''; for(let i=0;i<u8.length;i+=8192) s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192)); return btoa(s); }
function b64ToBytes(b){ const bin=atob(b); const out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; }
async function fileWrite(store,caseId,which,u8){
  const b64=bytesToB64(u8); const n=Math.ceil(b64.length/CHUNK);
  for(let i=0;i<n;i++) await store.put('rwlchunks',caseId+'.'+which+'.'+i,{d:b64.slice(i*CHUNK,(i+1)*CHUNK)});
  await store.put('rwlfiles',caseId+'.'+which,{caseId,which,size:u8.length,chunks:n,at:new Date().toISOString()});
}
async function fileRead(store,caseId,which){
  const f=await store.get('rwlfiles',caseId+'.'+which); if(!f) return null;
  let b64=''; for(let i=0;i<f.chunks;i++){ const c=await store.get('rwlchunks',caseId+'.'+which+'.'+i); b64+=c?c.d:''; }
  return b64ToBytes(b64);
}
async function fileDelete(store,caseId,which){
  const f=await store.get('rwlfiles',caseId+'.'+which); if(!f) return;
  for(let i=0;i<f.chunks;i++) await store.del('rwlchunks',caseId+'.'+which+'.'+i);
  await store.del('rwlfiles',caseId+'.'+which);
}
const DOCX_TYPE='application/vnd.openxmlformats-officedocument.wordprocessingml.document';


/* ----------------------------- the manual ------------------------------ */
/* The network's Sales Manual is what Compliance feeds to Copilot, so the
   reviewer reads the same text. A new version is uploaded here (PDF read in
   the browser, or a Word file read on the server); the checklist can then be
   rebuilt from it. Both live in the store, so nothing needs a code change. */
const TEXT_CHUNK=200000;
async function textWrite(store,key,text){
  const n=Math.ceil(text.length/TEXT_CHUNK)||1;
  for(let i=0;i<n;i++) await store.put('rwltext',key+'.'+i,{d:text.slice(i*TEXT_CHUNK,(i+1)*TEXT_CHUNK)});
  return n;
}
async function textRead(store,key,n){ let t=''; for(let i=0;i<n;i++){ const c=await store.get('rwltext',key+'.'+i); t+=c?c.d:''; } return t; }
async function textDelete(store,key,n){ for(let i=0;i<n;i++) await store.del('rwltext',key+'.'+i); }
const MANUAL_MAX=400000;
const REPORT_MAX=150000;   /* characters of the CashCalc report sent with a review */   /* characters sent to the reviewer; a 40-page manual is ~120k */
async function loadRules(store){
  const meta=await store.get('rwlmanual','main');
  const rr=await store.get('rwlrubric','main');
  const rubric=(rr&&Array.isArray(rr.rules)&&rr.rules.length)?rr.rules:RWL_RUBRIC;
  const manual=meta?await textRead(store,'manual',meta.chunks):'';
  return {rubric,rubricFrom:rr?(rr.from||'manual'):'built-in',rubricText:rubric.map(r=>r.id+' ['+r.section+'] ('+r.severity+'): '+r.rule).join('\n'),
    manual:manual.slice(0,MANUAL_MAX),manualName:meta?meta.name:'',manualMeta:meta||null};
}
const RUBRIC_SCHEMA={type:'object',additionalProperties:false,required:['rules','summary'],properties:{
  summary:{type:'string'},
  rules:{type:'array',items:{type:'object',additionalProperties:false,required:['id','section','severity','rule'],properties:{
    id:{type:'string'},section:{type:'string'},severity:{type:'string',enum:['must','should']},rule:{type:'string'}}}}}};
const SYSTEM_RUBRIC='You are the compliance lead of a regulated financial advice firm. From the network\'s Sales Manual below, and the firm\'s existing checklist, write the checklist a reviewer should apply to every Reason Why Letter (suitability report) before it is submitted. Keep every rule that the manual still supports, reword rules the manual has changed, add rules for requirements the manual contains that the checklist misses, and drop rules the manual no longer supports. Each rule: a short id (R1, R2 ...), the manual section it comes from, "must" or "should", and one plain-English sentence or two that a reviewer can test a letter against. Between 10 and 30 rules. In "summary", say in a few sentences what changed from the existing checklist.';
async function manualHandle(x){
  const {req,path,method,user,store,deps,json,err,readJson}=x;
  const who=user.name||user.email;
  if(path==='/api/rwlmanual'&&method==='GET'){
    const rb=await loadRules(store);
    return json({manual:rb.manualMeta,rubric:rb.rubric,rubricFrom:rb.rubricFrom,builtIn:RWL_RUBRIC.length,mock:!!deps.mockAI});
  }
  if(path==='/api/rwlmanual'&&method==='POST'){
    let form; try{ form=await req.formData(); }catch(e){ return err(400,'Send the manual as a form upload.'); }
    const name=String(form.get('name')||'').trim().slice(0,120);
    if(!name) return err(400,'Give this version of the manual a name (e.g. "BT Sales Manual v4, Oct 2026").');
    let text=String(form.get('text')||'');
    const file=form.get('file');
    if(file&&typeof file!=='string'&&file.size){
      if(!/\.docx$/i.test(file.name||'')) return err(400,'Upload the manual as a Word .docx, or as a PDF (which is read in the browser).');
      if(file.size>12*1024*1024) return err(400,'Files up to 12 MB please.');
      if(!deps.fflate) return err(501,'Word support is not available on this server.');
      try{ text=docxParas(docxOpen(deps.fflate,new Uint8Array(await file.arrayBuffer())).xml).map(p=>p.text).filter(t=>t.trim()).join('\n'); }
      catch(e){ return err(400,'Could not read that file: '+e.message); }
    }
    text=text.replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    if(text.length<2000) return err(400,'That does not look like the manual: only '+text.length+' characters of text came through. If it is a scanned PDF, the text cannot be read.');
    const old=await store.get('rwlmanual','main');
    if(old) await textDelete(store,'manual',old.chunks);
    const chunks=await textWrite(store,'manual',text);
    const meta={name,chars:text.length,chunks,uploadedBy:who,at:new Date().toISOString(),source:file&&typeof file!=='string'&&file.size?String(file.name).slice(0,140):'pdf (read in the browser)'};
    await store.put('rwlmanual','main',meta);
    return json({ok:true,manual:meta});
  }
  if(path==='/api/rwlmanual'&&method==='DELETE'){
    const old=await store.get('rwlmanual','main');
    if(old){ await textDelete(store,'manual',old.chunks); await store.del('rwlmanual','main'); }
    return json({ok:true});
  }
  if(path==='/api/rwlmanual/rubric'&&method==='POST'){
    const rb=await loadRules(store);
    if(!rb.manual) return err(400,'Upload the manual first.');
    let r;
    if(deps.mockAI) r={data:{summary:'Sandbox mock: the built-in checklist is kept as it is, with the manual recorded as its source.',rules:RWL_RUBRIC},model:'mock'};
    else { try{ r=await askClaude(deps,rb,SYSTEM_RUBRIC+'\n\nEXISTING CHECKLIST\n'+rb.rubricText,'Write the checklist from the manual.',RUBRIC_SCHEMA); }
      catch(e){ return err(502,e.message||'The reviewer could not be reached.'); } }
    const rules=(r.data.rules||[]).filter(z=>z.id&&z.rule).slice(0,40);
    if(rules.length<5) return err(502,'The checklist that came back was too short to trust; the existing one is kept.');
    await store.put('rwlrubric','main',{rules,from:rb.manualName,summary:r.data.summary||'',by:who,at:new Date().toISOString()});
    return json({ok:true,rubric:rules,summary:r.data.summary||'',model:r.model});
  }
  if(path==='/api/rwlmanual/rubric'&&method==='DELETE'){ await store.del('rwlrubric','main'); return json({ok:true,rubric:RWL_RUBRIC}); }
  return err(404,'Not found');
}

/* ------------------------------ templates ------------------------------- */
/* The RWLs are built from templates. Getting the templates in line with the
   manual once means the letters start compliant, and the review tool is
   only needed for the odd bounce-back. A template is reviewed the same way
   as a letter, except that merge fields and placeholders are expected and
   the edits are written back as tracked changes for the team to accept. */
const SYSTEM_TEMPLATE=rb=>'You are the compliance reviewer for a regulated financial advice firm. You are reviewing a TEMPLATE for a Reason Why Letter (suitability report), not a finished letter. Templates are Word mail-merge documents: text shown as «Field_Name» is a merge field filled from the firm\'s client workbook. Keep every «Field_Name» exactly as it is, inside any paragraph you replace; use an existing field (for example «Client_Name») rather than a placeholder wherever one exists; never invent a field that is not already in the template. Placeholders and optional paragraphs are expected and are never a finding. Your job is to make the template produce letters that pass the network\'s Compliance review first time, using the rubric below.\n\nWhat to look for:\n- Mandatory content the template does not prompt for: the tax caveat, the statement of current tax residence and taxation on withdrawal for cross-border clients, risk and capacity for loss, charges in cash and percentage terms, benefits lost on transfer, alternatives considered, the servicing proposition, the statement of what a cashflow does and does not show, prominent cashflow assumptions.\n- Standing wording that would be flagged in every letter: performance given as a reason, marketing language, certainty about the future, a cashflow presented as the reason for a recommendation.\n- Structure that invites the adviser to bury the real rationale: provide a clearly labelled place for the client\'s objectives-led reasons.\n\nFor each fix, draft the edit as a change to the template: insert a new paragraph (with [square-bracket placeholders] for anything client-specific, and optional paragraphs marked "[Include where ...]"), replace a paragraph, or delete one. Refer to paragraphs by their number [n] and quote the first words as the anchor. Keep the firm\'s voice and structure. Never add promises about performance, never remove a risk warning. Write in plain UK English, in the second person to the client. In "notes", explain to the paraplanning team in a few short paragraphs what changed and why, and what the adviser must now fill in for each letter.\n\nRUBRIC\n'+rb.rubricText;
const TEMPLATE_SCHEMA={type:'object',additionalProperties:false,required:['summary','findings','edits','notes'],properties:{
  summary:{type:'string'},
  findings:{type:'array',items:{type:'object',additionalProperties:false,required:['rule','severity','paragraph','issue','fix'],properties:{
    rule:{type:'string'},severity:{type:'string',enum:['must','should']},paragraph:{type:['integer','null']},issue:{type:'string'},fix:{type:'string'}}}},
  edits:{type:'array',items:{type:'object',additionalProperties:false,required:['op','para','anchor','lead','text','point','reason'],properties:{
    op:{type:'string',enum:['replace','insert_after','delete']},para:{type:'integer'},anchor:{type:'string'},lead:{type:'string'},text:{type:'string'},point:{type:'integer'},reason:{type:'string'}}}},
  notes:{type:'string'}}};
function mockTemplate(letter){
  const perf=findPara(letter,'better performance'), cash=findPara(letter,'cashflow'), risk=findPara(letter,'risk warnings')||findPara(letter,'can fall as well as rise');
  const findings=[], edits=[];
  if(perf!=null){ findings.push({rule:'R7',severity:'must',paragraph:perf,issue:'The template offers "Better Performance" as a standing reason.',fix:'Remove it from the template so it cannot appear in any letter.'});
    edits.push({op:'delete',para:perf,anchor:'better performance',lead:'',text:'',point:1,reason:'Performance can never be a reason (R7).'}); }
  if(cash!=null){ findings.push({rule:'R2',severity:'must',paragraph:cash,issue:'The cashflow section has no place to say what the forecast does and does not show, nor its key assumptions.',fix:'Add two prompted paragraphs after the cashflow summary.'});
    edits.push({op:'insert_after',para:cash,anchor:anchorOf(letter,cash),lead:'Key assumptions behind the forecast.',text:'The forecast assumes [the main income assumption, e.g. business income of £X a year continuing to age Y]. That is the single largest driver of the result. If it reduces or stops, the outcome would look materially different, and we will review this assumption with you at each annual review.\n\n[Include where the forecast shows the objective is met either way:] It is important to be clear about what the forecast does and does not show. On these assumptions your retirement income objective is met whether or not [the recommended action] is taken, so this recommendation does not rest on retirement income need. The reasons for it are set out under Recommendation.',point:2,reason:'R2 and R3: the cashflow must not be the stated reason, and assumptions must be prominent.'}); }
  if(risk!=null){ findings.push({rule:'R5',severity:'must',paragraph:null,issue:'No prompted paragraph for current tax residence and taxation on withdrawal for cross-border clients.',fix:'Add an optional paragraph with placeholders, plus the local tax advice caveat.'});
    edits.push({op:'insert_after',para:risk,anchor:anchorOf(letter,risk),lead:'Your tax residence and how benefits will be taxed.',text:'[Include for any client resident outside the UK or who may retire abroad:] You are currently tax resident in [country]. How your pension benefits are taxed when you draw them will depend on the country in which you are tax resident at that time, not on where you live now or where you intend to retire; the [UK–country] double taxation treaty will determine the treatment. We are not tax advisers, and you should obtain local tax advice before proceeding and before drawing benefits.',point:3,reason:'R5 and R6: cross-border tax residence and the mandatory tax caveat.'}); }
  return {summary:'Sandbox mock. The template would produce letters that are flagged for performance claims, an unexplained cashflow and missing cross-border tax wording.',findings,edits,
    notes:'What changed: the performance bullet is removed; two prompted paragraphs follow the cashflow summary (assumptions, and what the forecast does and does not show); an optional tax residence paragraph with the tax caveat follows the risk warnings.\n\nWhat the adviser must fill in per letter: the main income assumption, whether the objective is met either way, and the client\'s country of tax residence. (Sandbox mock notes.)'};
}
async function tplReview(deps,rb,letter){
  if(deps.mockAI) return {data:mockTemplate(letter),usage:null,model:'mock'};
  return askClaude(deps,rb,SYSTEM_TEMPLATE(rb),'Review the following Reason Why Letter TEMPLATE against the rubric and draft the edits that bring it in line. Paragraphs are numbered [n].\n\n<template>\n'+letter+'\n</template>',TEMPLATE_SCHEMA);
}
async function tplHandle(x){
  const {req,path,method,user,store,deps,json,err,readJson,newId}=x;
  if(path.indexOf('/api/rwltpl/')!==0) return null;
  const who=user.name||user.email;
  const logEv=(t,what)=>{ t.events=t.events||[]; t.events.push({at:new Date().toISOString(),who,what}); if(t.events.length>60) t.events.shift(); };
  const pub=t=>({id:t.id,name:t.name,kind:t.kind,status:t.status,created:t.created,updated:t.updated,createdBy:t.createdBy,originalName:t.originalName,paragraphs:t.paragraphs,findingsCount:t.review?t.review.findings.length:null});
  const touch=t=>{ t.updated=new Date().toISOString(); };
  if(path==='/api/rwltpl/list'&&method==='GET'){
    const all=(await store.list('rwltemplates')).map(pub).sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));
    return json({templates:all});
  }
  if(path==='/api/rwltpl/upload'&&method==='POST'){
    if(!deps.fflate) return err(501,'Word support is not available on this server.');
    let form; try{ form=await req.formData(); }catch(e){ return err(400,'Send the file as a form upload.'); }
    const file=form.get('file');
    const name=String(form.get('name')||'').trim().slice(0,100);
    const kind=String(form.get('kind')||'').trim().slice(0,60);
    if(!name) return err(400,'Give the template a name.');
    if(!file||typeof file==='string'||!/\.docx$/i.test(file.name||'')) return err(400,'Upload the template as a Word .docx file.');
    if(file.size>6*1024*1024) return err(400,'Files up to 6 MB please.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    let letter;
    try{ letter=docxNumbered(docxOpen(deps.fflate,bytes).xml); }catch(e){ return err(400,'Could not read that file: '+e.message); }
    if(letter.length<300) return err(400,'That file has almost no text in it.');
    const mf=mergeFields(docxOpen(deps.fflate,bytes).xml);
    const t={id:newId('tpl'),name,kind,status:'uploaded',created:new Date().toISOString(),updated:null,createdBy:who,mergeFields:[...new Set(mf.names)],
      originalName:String(file.name).slice(0,140),letter,paragraphs:letter.split('\n').length,review:null,result:null,events:[]};
    touch(t); logEv(t,'uploaded '+t.originalName+' ('+bytes.length+' bytes)');
    await fileWrite(store,t.id,'original',bytes);
    await store.put('rwltemplates',t.id,t);
    return json({id:t.id,name:t.name,paragraphs:t.paragraphs});
  }
  const m=/^\/api\/rwltpl\/([A-Za-z0-9_-]+)(?:\/(\w+))?$/.exec(path);
  if(!m) return err(404,'Not found');
  const t=await store.get('rwltemplates',m[1]);
  if(!t) return err(404,'Template not found');
  const action=m[2];
  if(!action&&method==='GET'){ const {letter,...rest}=t; return json(rest); }
  if(!action&&method==='DELETE'){
    await fileDelete(store,t.id,'original'); await fileDelete(store,t.id,'redlined');
    await store.del('rwltemplates',t.id);
    return json({ok:true});
  }
  if(action==='check'&&method==='POST'){
    const rb=await loadRules(store);
    let r; try{ r=await tplReview(deps,rb,t.letter); }catch(e){ return err(502,e.message||'The reviewer could not be reached.'); }
    const bytes=await fileRead(store,t.id,'original');
    const doc=docxOpen(deps.fflate,bytes);
    const dry=docxRedline(doc.xml,r.data.edits,{author:deps.rwlAuthor});
    t.review=r.data; t.status=r.data.edits.length?'reviewed':'aligned';
    t.result={dry:{applied:dry.applied.map(a=>a.k),skipped:dry.skipped.map(s=>({k:s.k,why:s.why}))}};
    touch(t); logEv(t,'checked against the manual ('+r.model+'): '+r.data.findings.length+' finding(s), '+r.data.edits.length+' edit(s)');
    await store.put('rwltemplates',t.id,t);
    return json({review:r.data,dry:t.result.dry,usage:r.usage});
  }
  if(action==='apply'&&method==='POST'){
    if(!t.review) return err(400,'Check the template first.');
    const b=await readJson(req,20000);
    const skip=new Set(Array.isArray(b.skip)?b.skip.map(Number):[]);
    const edits=t.review.edits.filter((e,k)=>!skip.has(k));
    const bytes=await fileRead(store,t.id,'original');
    const doc=docxOpen(deps.fflate,bytes);
    const out=docxRedline(doc.xml,edits,{author:deps.rwlAuthor});
    await fileWrite(store,t.id,'redlined',docxSave(deps.fflate,doc,out.xml));
    t.result={at:new Date().toISOString(),insertions:out.insertions,deletions:out.deletions,applied:out.applied.length,
      skipped:out.skipped.map(s=>({edit:s.edit,why:s.why})),skippedByUser:[...skip],merge:out.merge};
    t.status='aligned';
    if(out.merge.missing.length){ logEv(t,'WARNING: merge fields missing after edits: '+out.merge.missing.join(', ')); }
    touch(t); logEv(t,'aligned template written: '+out.applied.length+' edit(s) as '+out.insertions+' insertions / '+out.deletions+' deletions');
    await store.put('rwltemplates',t.id,t);
    return json(t.result);
  }
  if(action==='download'&&method==='GET'){
    const which=new URL(req.url).searchParams.get('which')==='original'?'original':'redlined';
    const bytes=await fileRead(store,t.id,which);
    if(!bytes) return err(404,'No '+which+' file yet.');
    const base=(t.originalName||'Template').replace(/\.docx$/i,'');
    const name=(which==='original'?t.originalName:base+' - aligned.docx').replace(/"/g,'');
    logEv(t,'downloaded '+which); touch(t); await store.put('rwltemplates',t.id,t);
    return new Response(bytes,{headers:{'content-type':DOCX_TYPE,'content-disposition':'attachment; filename="'+name+'"','cache-control':'no-store'}});
  }
  return err(404,'Not found');
}

/* -------------------------------- routes -------------------------------- */
/* handle({req,path,method,user,store,deps,json,err,readJson,newId}) -> Response|null */
async function rwlHandle(x){
  const {req,path,method,user,store,deps,json,err,readJson,newId}=x;
  if(path.indexOf('/api/rwltpl/')===0) return tplHandle(x);
  if(path.indexOf('/api/rwlmanual')===0) return manualHandle(x);
  if(path.indexOf('/api/rwl/')!==0) return null;
  const who=user.name||user.email;
  const logEv=(c,what)=>{ c.events=c.events||[]; c.events.push({at:new Date().toISOString(),who,what}); if(c.events.length>60) c.events.shift(); };
  const pub=c=>({id:c.id,ref:c.ref,adviser:c.adviser,status:c.status,created:c.created,updated:c.updated,createdBy:c.createdBy,originalName:c.originalName,paragraphs:c.paragraphs,score:c.score==null?null:c.score,template:c.template?c.template.name:'',returned:(c.returns||[]).length,approvedBy:c.approval?c.approval.by:''});
  const openMust=c=>(c.findings?c.findings.findings:[]).map((f,k)=>({f,k})).filter(x=>x.f.severity==='must'&&!(c.approval&&c.approval.overrides||[]).some(o=>o.k===x.k)&&!(c.overrides||[]).some(o=>o.k===x.k));
  const touch=c=>{ c.updated=new Date().toISOString(); };

  if(path==='/api/rwl/rubric'&&method==='GET'){ const rb=await loadRules(store); return json({rubric:rb.rubric,rubricFrom:rb.rubricFrom,manual:rb.manualMeta,mock:!!deps.mockAI,ai:!!(deps.claudeKey||deps.mockAI)}); }


  if(path==='/api/rwl/insights'&&method==='GET'){
    const cases=await store.list('rwlcases'); const rb=await loadRules(store);
    const CNAMES={C1:'Automatic: names agree',C2:'Automatic: fees agree',C3:'Automatic: dates',C4:'Automatic: currencies',C5:'Automatic: template residue',C6:'Automatic: readability',C7:'Automatic: template drift',C8:'Automatic: cashflow figures match the report',C9:'Automatic: the same figure everywhere',C10:'Automatic: plan valued two ways'};
    const ruleName=id=>{ const r=rb.rubric.find(x=>x.id===id); return r?r.section:(CNAMES[id]||(id==='NEW'?'Not in the checklist':id)); };
    const byStatus={}; cases.forEach(c=>{ byStatus[c.status]=(byStatus[c.status]||0)+1; });
    const submitted=cases.filter(c=>(c.submissions||[]).length||(c.returns||[]).length).length;
    const returned=cases.filter(c=>(c.returns||[]).length).length;
    const obj={}; const newRules=[]; const adv={}; const tpl={};
    cases.forEach(c=>{
      const a=c.adviser||'(no adviser)'; adv[a]=adv[a]||{adviser:a,cases:0,returned:0,points:0,scores:[]}; adv[a].cases++; if(c.score!=null) adv[a].scores.push(c.score);
      const t=c.template?c.template.name:'(no template)'; tpl[t]=tpl[t]||{template:t,cases:0,returned:0,scores:[]}; tpl[t].cases++; if(c.score!=null) tpl[t].scores.push(c.score);
      if((c.returns||[]).length){ adv[a].returned++; tpl[t].returned++; }
      (c.returns||[]).forEach(r=>(r.points||[]).forEach(p=>{ const k=p.rule||'NEW'; obj[k]=obj[k]||{rule:k,section:ruleName(k),count:0,examples:[]}; obj[k].count++; if(obj[k].examples.length<3) obj[k].examples.push(p.summary); adv[a].points++; if(k==='NEW'&&p.new_rule) newRules.push({rule:p.new_rule,ref:c.ref,at:r.at}); }));
    });
    const avg=xs=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):null;
    const scored=cases.filter(c=>c.score!=null);
    const hours=cases.filter(c=>c.result&&c.result.at&&c.returns&&c.returns.length).map(c=>(new Date(c.result.at)-new Date(c.returns[0].at))/3600000);
    const tally=Object.values(obj);
    const totalFindings=scored.reduce((a,c)=>a+(c.findings?c.findings.findings.length:0),0);
    const ruleHits={}; scored.forEach(c=>(c.findings?c.findings.findings:[]).forEach(f=>{ ruleHits[f.rule]=ruleHits[f.rule]||{rule:f.rule,section:ruleName(f.rule),count:0}; ruleHits[f.rule].count++; }));
    return json({cases:cases.length,byStatus,submitted,returned,bounceRate:submitted?Math.round(100*returned/submitted):null,avgScore:avg(scored.map(c=>c.score)),
      avgHoursToFix:hours.length?Math.round(avg(hours)*10)/10:null,
      topObjections:tally.sort((a,b)=>b.count-a.count).slice(0,10),
      topFindings:Object.values(ruleHits).sort((a,b)=>b.count-a.count).slice(0,10),totalFindings,
      byAdviser:Object.values(adv).map(a=>({...a,avgScore:avg(a.scores),scores:undefined})).sort((a,b)=>b.cases-a.cases),
      byTemplate:Object.values(tpl).map(t=>({...t,avgScore:avg(t.scores),scores:undefined})).sort((a,b)=>b.cases-a.cases),
      newRules:newRules.slice(0,20),rubricFrom:rb.rubricFrom,manual:rb.manualMeta?rb.manualMeta.name:''});
  }
  if(path==='/api/rwl/cases'&&method==='GET'){
    const all=(await store.list('rwlcases')).map(pub).sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));
    return json({cases:all});
  }
  if(path==='/api/rwl/cases'&&method==='POST'){
    if(!deps.fflate) return err(501,'Word support is not available on this server.');
    let form; try{ form=await req.formData(); }catch(e){ return err(400,'Send the file as a form upload.'); }
    const file=form.get('file');
    const ref=String(form.get('ref')||'').trim().slice(0,80);
    const adviser=String(form.get('adviser')||'').trim().slice(0,80);
    const templateId=String(form.get('templateId')||'').trim().slice(0,60);
    if(!ref) return err(400,'Give the case a reference.');
    if(!file||typeof file==='string'||!/\.docx$/i.test(file.name||'')) return err(400,'Upload the RWL as a Word .docx file.');
    if(file.size>6*1024*1024) return err(400,'Files up to 6 MB please.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    let letter;
    try{ letter=docxNumbered(docxOpen(deps.fflate,bytes).xml); }catch(e){ return err(400,'Could not read that file: '+e.message); }
    if(letter.length<500) return err(400,'That file has almost no text in it.');
    const c={id:newId('rwl'),ref,adviser,status:'uploaded',created:new Date().toISOString(),updated:null,createdBy:who,
      originalName:String(file.name).slice(0,140),letter,paragraphs:letter.split('\n').length,findings:null,email:'',plan:null,result:null,events:[],
      score:null,checks:null,readability:null,template:null,overrides:[],approval:null,submissions:[],returns:[],closed:null};
    if(templateId){ const t=await store.get('rwltemplates',templateId); if(t) c.template={id:t.id,name:t.name,status:t.status,aligned:t.status==='aligned'}; }
    touch(c); logEv(c,'uploaded '+c.originalName+' ('+bytes.length+' bytes)');
    await fileWrite(store,c.id,'original',bytes);
    await store.put('rwlcases',c.id,c);
    return json({id:c.id,ref:c.ref,paragraphs:c.paragraphs});
  }

  const m=/^\/api\/rwl\/cases\/([A-Za-z0-9_-]+)(?:\/(\w+))?$/.exec(path);
  if(!m) return err(404,'Not found');
  const c=await store.get('rwlcases',m[1]);
  if(!c) return err(404,'Case not found');
  const action=m[2];

  if(!action&&method==='GET'){ const {letter,...rest}=c; return json(rest); }
  if(!action&&method==='DELETE'){
    await fileDelete(store,c.id,'original'); await fileDelete(store,c.id,'redlined');
    if(c.cashcalc) await textDelete(store,'cc.'+c.id,c.cashcalc.chunks);
    await store.del('rwlcases',c.id);
    return json({ok:true});
  }
  /* the CashCalc report: a PDF is read in the browser (only its text comes
     here), a Word file is read here. Stored as text chunks beside the case. */
  if(action==='cashcalc'&&method==='POST'){
    let form; try{ form=await req.formData(); }catch(e){ return err(400,'Send the report as a form upload.'); }
    const file=form.get('file'); let text=String(form.get('text')||''); let name=String(form.get('name')||'').slice(0,140);
    if(file&&typeof file!=='string'){
      if(file.size>8*1024*1024) return err(400,'Files up to 8 MB please.');
      name=name||String(file.name||'').slice(0,140);
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(/\.docx$/i.test(file.name||'')){ if(!deps.fflate) return err(501,'Word support is not available on this server.'); try{ text=docxParas(docxOpen(deps.fflate,bytes).xml).map(p=>p.text).join('\n'); }catch(e){ return err(400,'Could not read that file: '+e.message); } }
      else if(/\.(txt|csv)$/i.test(file.name||'')) text=new TextDecoder().decode(bytes);
      else return err(400,'Upload the CashCalc report as a PDF, a Word .docx or a text file.');
    }
    text=text.replace(/\r/g,'').trim();
    if(text.length<200) return err(400,'That report has almost no text in it. If it is a scanned PDF, export it again from CashCalc.');
    if(c.cashcalc) await textDelete(store,'cc.'+c.id,c.cashcalc.chunks);
    const chunks=await textWrite(store,'cc.'+c.id,text);
    c.cashcalc={name:name||'CashCalc report',chars:text.length,chunks,at:new Date().toISOString(),by:who,figures:figuresOf(text).length};
    if(c.findings){ c.findings=null; c.score=null; c.checks=null; c.approval=null; c.overrides=[]; if(c.status==='checked-ready'||c.status==='checked-issues'||c.status==='approved') c.status='uploaded'; }
    touch(c); logEv(c,'CashCalc report attached: '+c.cashcalc.name+' ('+Math.round(text.length/1000)+'k characters, '+c.cashcalc.figures+' figures)');
    await store.put('rwlcases',c.id,c);
    return json({cashcalc:c.cashcalc});
  }
  if(action==='cashcalc'&&method==='DELETE'){
    if(c.cashcalc){ await textDelete(store,'cc.'+c.id,c.cashcalc.chunks); c.cashcalc=null; touch(c); logEv(c,'CashCalc report removed'); await store.put('rwlcases',c.id,c); }
    return json({ok:true});
  }
  if(action==='precheck'&&method==='POST'){
    const rb=await loadRules(store);
    const report=c.cashcalc?await textRead(store,'cc.'+c.id,c.cashcalc.chunks):'';
    let r; try{ r=await rwlPrecheck(deps,rb,c.letter,report.slice(0,REPORT_MAX)); }catch(e){ return err(502,e.message||'The reviewer could not be reached.'); }
    const cc=codeChecks(c.letter,{template:c.template,report});
    const all=r.data.findings.concat(cc.checks);
    c.findings={ready_to_submit:!all.some(f=>f.severity==='must'),summary:r.data.summary,findings:all,ai:r.data.findings.length,code:cc.checks.length,cashflow:cc.cashflow};
    c.checks=cc.checks; c.readability=cc.readability; c.score=scoreOf(all); c.overrides=[]; c.approval=null;
    c.status=c.findings.ready_to_submit?'checked-ready':'checked-issues';
    touch(c); logEv(c,'pre-check run ('+r.model+(r.fellBack?', backup model':'')+'): '+r.data.findings.length+' reviewer finding(s) + '+cc.checks.length+' automatic check(s), score '+c.score);
    await store.put('rwlcases',c.id,c);
    return json({findings:c.findings,score:c.score,readability:c.readability,usage:r.usage});
  }
  if(action==='revise'&&method==='POST'){
    const b=await readJson(req,200000);
    const email=String(b.email||'').trim();
    if(email.length<40) return err(400,'Paste the compliance email first.');
    const rb=await loadRules(store);
    let r; try{ r=await rwlPlan(deps,rb,c.letter,email); }catch(e){ return err(502,e.message||'The reviewer could not be reached.'); }
    const bytes=await fileRead(store,c.id,'original');
    const doc=docxOpen(deps.fflate,bytes);
    const dry=docxRedline(doc.xml,r.data.edits,{author:deps.rwlAuthor});
    c.email=email; c.plan=r.data; c.status='edits-proposed';
    c.returns=c.returns||[]; c.returns.push({at:new Date().toISOString(),points:(r.data.points||[]).map(p=>({n:p.n,rule:p.rule||'',summary:p.summary,new_rule:p.new_rule||''}))});
    c.result={dry:{applied:dry.applied.map(a=>a.k),skipped:dry.skipped.map(s=>({k:s.k,why:s.why}))}};
    touch(c); logEv(c,'compliance points mapped ('+r.model+(r.fellBack?', backup model':'')+'): '+r.data.edits.length+' edit(s), '+dry.skipped.length+' could not be placed');
    await store.put('rwlcases',c.id,c);
    return json({plan:r.data,dry:c.result.dry,usage:r.usage});
  }
  if(action==='apply'&&method==='POST'){
    if(!c.plan) return err(400,'Work out the changes first.');
    const b=await readJson(req,20000);
    const skip=new Set(Array.isArray(b.skip)?b.skip.map(Number):[]);
    const edits=c.plan.edits.filter((e,k)=>!skip.has(k));
    const bytes=await fileRead(store,c.id,'original');
    const doc=docxOpen(deps.fflate,bytes);
    const out=docxRedline(doc.xml,edits,{author:deps.rwlAuthor});
    await fileWrite(store,c.id,'redlined',docxSave(deps.fflate,doc,out.xml));
    c.result={at:new Date().toISOString(),insertions:out.insertions,deletions:out.deletions,applied:out.applied.length,
      skipped:out.skipped.map(s=>({edit:s.edit,why:s.why})),skippedByUser:[...skip],merge:out.merge};
    c.status='redlined';
    touch(c); logEv(c,'redline written: '+out.applied.length+' edit(s) as '+out.insertions+' insertions / '+out.deletions+' deletions');
    await store.put('rwlcases',c.id,c);
    return json(c.result);
  }

  /* ---- the gate: nothing is marked as sent without a check, and every "must"
     finding is cleared or overridden with a reason by someone other than the
     person who prepared it ---- */
  if(action==='approve'&&method==='POST'){
    if(!c.findings) return err(400,'Run the check first.');
    const b=await readJson(req,40000);
    const ov=(Array.isArray(b.overrides)?b.overrides:[]).map(o=>({k:Number(o.k),reason:String(o.reason||'').trim().slice(0,400)})).filter(o=>!isNaN(o.k)&&o.reason.length>=10);
    const open=(c.findings.findings||[]).map((f,k)=>({f,k})).filter(x=>x.f.severity==='must'&&!ov.some(o=>o.k===x.k));
    if(open.length) return err(400,open.length+' "must" finding'+(open.length===1?'':'s')+' still open. Fix the letter and re-check, or give a reason (10+ characters) to override each one.');
    if(c.createdBy===who&&!user.admin) return err(403,'Four eyes: the letter was uploaded by you, so a colleague has to approve it. An admin can override.');
    c.overrides=ov; c.approval={by:who,at:new Date().toISOString(),hash:await sha256(c.letter),score:c.score,overrides:ov,fourEyes:c.createdBy!==who};
    c.status='approved'; touch(c); logEv(c,'approved for submission by '+who+(ov.length?' with '+ov.length+' override(s)':'')+(c.createdBy===who?' (admin self-approval)':''));
    await store.put('rwlcases',c.id,c); return json({ok:true,approval:c.approval});
  }
  if(action==='submit'&&method==='POST'){
    const b=await readJson(req,10000);
    const btRef=String(b.btRef||'').trim().slice(0,80);
    const resub=c.status==='redlined';
    if(!resub&&c.status!=='approved') return err(400,'Approve the letter first.');
    if(!resub&&c.approval&&c.approval.hash!==await sha256(c.letter)) return err(409,'The letter changed after it was approved. Re-check and approve again.');
    c.submissions=c.submissions||[]; c.submissions.push({at:new Date().toISOString(),by:who,btRef,kind:resub?'resubmission':'first'});
    c.status=resub?'resubmitted':'submitted'; touch(c); logEv(c,(resub?'resubmitted':'submitted')+' to Blacktower'+(btRef?' ('+btRef+')':''));
    await store.put('rwlcases',c.id,c); return json({ok:true,status:c.status});
  }
  if(action==='close'&&method==='POST'){
    const b=await readJson(req,10000);
    const outcome=b.outcome==='withdrawn'?'withdrawn':'approved';
    c.closed={at:new Date().toISOString(),by:who,outcome}; c.status='closed'; touch(c); logEv(c,'closed: '+(outcome==='approved'?'approved by Blacktower':'withdrawn'));
    await store.put('rwlcases',c.id,c); return json({ok:true});
  }
  if(action==='reopen'&&method==='POST'){
    c.closed=null; c.status=c.result&&c.result.insertions!=null?'redlined':(c.approval?'approved':(c.findings?'checked-issues':'uploaded')); touch(c); logEv(c,'reopened');
    await store.put('rwlcases',c.id,c); return json({ok:true,status:c.status});
  }
  if(action==='audit'&&method==='GET'){
    const rows=[['when','who','what']];
    (c.events||[]).forEach(e=>rows.push([e.at,e.who,e.what]));
    if(c.approval) rows.push([c.approval.at,c.approval.by,'approval record: score '+c.approval.score+', letter hash '+c.approval.hash+(c.approval.overrides.length?', overrides: '+c.approval.overrides.map(o=>'#'+o.k+' '+o.reason).join(' | '):'')]);
    (c.submissions||[]).forEach(sb=>rows.push([sb.at,sb.by,sb.kind+(sb.btRef?' ref '+sb.btRef:'')]));
    const csv=rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
    return new Response('\ufeff'+csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="'+c.ref.replace(/"/g,'')+' - audit.csv"','cache-control':'no-store'}});
  }
  if(action==='download'&&method==='GET'){
    const which=new URL(req.url).searchParams.get('which')==='original'?'original':'redlined';
    const bytes=await fileRead(store,c.id,which);
    if(!bytes) return err(404,'No '+which+' file yet.');
    const base=(c.originalName||'RWL').replace(/\.docx$/i,'');
    const name=(which==='original'?c.originalName:base+' - redlined.docx').replace(/"/g,'');
    logEv(c,'downloaded '+which); touch(c); await store.put('rwlcases',c.id,c);
    return new Response(bytes,{headers:{'content-type':DOCX_TYPE,'content-disposition':'attachment; filename="'+name+'"','cache-control':'no-store'}});
  }
  return err(404,'Not found');
}

const SJB_RWL={rwlHandle,docxOpen,docxSave,docxParas,docxNumbered,docxRedline,RWL_RUBRIC,mockEdits,mockFindings,codeChecks,scoreOf,cashflowCheck,cashflowParas,figuresOf,askClaude};
if(typeof module!=='undefined'&&module.exports) module.exports=SJB_RWL;
else globalThis.SJB_RWL=SJB_RWL;
