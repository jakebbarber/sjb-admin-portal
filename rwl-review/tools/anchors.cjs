const fs=require('fs'),path=require('path'); const W=process.argv[2];
const inv=JSON.parse(fs.readFileSync(path.join(W,'inventory.json'))).filter(r=>!/Old - SJB EU/.test(r.rel));
const hdr=JSON.parse(fs.readFileSync(path.join(W,'mads-headers.json')));
/* Word's merge-field name: cut the header at 40 characters FIRST, then drop everything but letters, digits and spaces, spaces -> _ */
const wordName=h=>String(h).slice(0,40).replace(/[^A-Za-z0-9 ]/g,'').replace(/ /g,'_').replace(/^_+/,'').toLowerCase();
const wn=new Set(hdr.map(wordName)); const strip=s=>s.toLowerCase().replace(/^_+|_+$/g,'');
const wnS=new Set([...wn].map(strip));
const fflate=require(path.join(__dirname,'..','node_modules','fflate')); const IN=path.join(W,'..','rwl-in','AO1 - RWLs');
const ANCH={risk:/^(risk warnings?|risk warning|investment risks?|risks?)\s*:?$/i,attitude:/attitude (toward|towards|to) (investment )?risk/i,charges:/^(summary of (all )?charges|charges|fees and charges|plan charges|remuneration)\s*:?$/i,recommendation:/^(my )?recommendations?\s*:?$/i,summary:/^summary and next steps/i,categorisation:/^client categorisation/i,sincerely:/^yours sincerely/i,declaration:/^client declaration/i,taxcaveat:/Blacktower are not tax experts/i,objectives:/^(your )?objectives\s*:?$/i,existing:/^(review of )?(your )?existing (pension|plans?|arrangements?)/i,alternatives:/alternatives? considered/i,servicing:/^(service proposition|ongoing service|servicing)/i,important:/^important information/i};
const text={}; inv.forEach(r=>text[r.slug]=fs.readFileSync(path.join(W,r.slug+'.txt'),'utf8'));
const paras=t=>t.split('\n').map(l=>{const m=/^\[(\d+)\](?:\s*\{[^}]*\})?\s*(.*)$/.exec(l); return m?{n:+m[1],text:m[2]}:null;}).filter(Boolean);
const sets={}; inv.forEach(r=>sets[r.slug]=new Set(paras(text[r.slug]).map(p=>p.text.trim()).filter(t=>t.length>40)));
const ref='DC_RWLs_DC_RWL_v4_BFMI_BIAAL_BFMCL';
for(const r of inv){
  const xml=fflate.strFromU8(fflate.unzipSync(fs.readFileSync(path.join(IN,r.rel)))['word/document.xml']);
  const codes=[...xml.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)].map(m=>m[1]).concat([...xml.matchAll(/w:fldSimple w:instr="([^"]*)"/g)].map(m=>m[1])).join(' ').replace(/\s+/g,' ');
  const names=[...new Set([...codes.matchAll(/MERGEFIELD\s+"?([^"\\]+?)"?\s*(?=\\|MERGEFIELD|$)/g)].map(m=>m[1].trim()))];
  const missing=names.filter(n=>{ const s=strip(n); const base=s.replace(/\d$/,''); return !wnS.has(s)&&!wnS.has(base); });
  const P=paras(text[r.slug]); const found={}; for(const k in ANCH){ const hits=P.filter(p=>ANCH[k].test(p.text)).map(p=>p.n); if(hits.length) found[k]=hits.slice(0,3).join('/'); }
  const long=P.filter(p=>p.text.trim().length>40).length; const shared=P.filter(p=>p.text.trim().length>40&&sets[ref].has(p.text.trim())).length;
  console.log(r.rel+'\n   not in MADS: '+(missing.length?missing.join(', '):'none')+'\n   shared with DC v4: '+shared+'/'+long+' long paras · anchors: '+JSON.stringify(found));
}
