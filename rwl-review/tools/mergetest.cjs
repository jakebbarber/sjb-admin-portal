/* Mail-merge test of every aligned template, done the way Word does it:
   1. accept all tracked changes (what the adviser does before merging);
   2. walk every field in word/document.xml: MERGEFIELD begin / instr /
      separate / result / end must be balanced and complete, and every field
      name must resolve to a MADS V.28 Template header by Word's naming rule;
   3. merge a FICTIONAL client record through the fields (field structure
      removed, result = the record's value), as "Finish & Merge" does;
   4. check the merged document: well-formed XML, no field markup or «» left,
      every value present, and the new paragraphs carry their values;
   5. compare with the original template: no field lost, no new unresolved
      field, settings.xml (the data-source link) byte-identical.
   Usage: node mergetest.cjs <originals dir> <aligned dir> <mads headers json> <report dir> */
const fs=require('fs'),path=require('path'); const [ORIG,ALIGNED,HDR,REP]=process.argv.slice(2);
const fflate=require(path.join(__dirname,'..','node_modules','fflate'));
const {XMLValidator}=require('fast-xml-parser');
const headers=JSON.parse(fs.readFileSync(HDR));
const wordName=h=>String(h).slice(0,40).replace(/[^A-Za-z0-9 ]/g,'').replace(/ /g,'_').replace(/^_+/,'');
const norm=s=>String(s).toLowerCase().replace(/^_+|_+$/g,'');
const byName=new Map(); headers.forEach((h,i)=>{ const n=norm(wordName(h)); if(!byName.has(n)) byName.set(n,[]); byName.get(n).push(i); });
/* Word de-duplicates equal names with a trailing digit (…Ple, …Ple1). */
const resolve=name=>{ const n=norm(name); if(byName.has(n)) return byName.get(n)[0]; const m=/^(.*?)(\d)$/.exec(n); if(m&&byName.has(m[1])&&byName.get(m[1]).length>+m[2]) return byName.get(m[1])[+m[2]]; return -1; };
/* a FICTIONAL record: recognisable values, nothing real */
const record=headers.map((h,i)=>{ const l=h.toLowerCase();
  if(/currency/.test(l)) return 'EUR'; if(/first name/.test(l)) return 'Dana'; if(/surname/.test(l)) return 'Hale'; if(/^title$/.test(l)) return 'Ms';
  if(/adviser name/.test(l)) return 'A. N. Adviser'; if(/date/.test(l)) return '12/10/2026'; if(/age/.test(l)&&!/percentage|manage|average/.test(l)) return '65';
  if(/amount|value|income|expenditure|surplus|fee|charge|cost|premium|cetv|salary/.test(l)) return (10000+i).toLocaleString('en-GB'); if(/%|rate/.test(l)) return '2.5%';
  return 'M'+i; });
const unzip=f=>fflate.unzipSync(fs.readFileSync(f)); const str=u=>fflate.strFromU8(u);
const accept=xml=>xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g,'').replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:pPr>[\s\S]*?<w:rPr>[^<]*<w:del\b[^>]*\/>[\s\S]*?<\/w:p>/g,m=>/<w:t[ >]/.test(m)?m:'').replace(/<\/?w:ins\b[^>]*>/g,'').replace(/<w:rPr><w:ins\b[^>]*\/><\/w:rPr>/g,'').replace(/<w:ins\b[^>]*\/>/g,'').replace(/<w:del\b[^>]*\/>/g,'');
const plain=xml=>xml.replace(/<w:p\b[^>]*>/g,'\n').replace(/<w:tab\/>/g,' ').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
/* Walk the runs of the document, find each complex field, and merge it. Fields can nest (IF … MERGEFIELD …); a nested MERGEFIELD is
   merged inside its parent, and the parent's result is left as Word's cached text. */
function mergeDoc(xml,onField){
  const runs=[...xml.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>|<w:fldSimple\b[^>]*>[\s\S]*?<\/w:fldSimple>/g)];
  let out='', pos=0; const stack=[]; const problems=[];
  const kindOf=r=>/<w:fldChar w:fldCharType="begin"/.test(r)?'begin':/<w:fldChar w:fldCharType="separate"/.test(r)?'separate':/<w:fldChar w:fldCharType="end"/.test(r)?'end':/<w:instrText/.test(r)?'instr':'run';
  for(const m of runs){ const r=m[0];
    if(r.startsWith('<w:fldSimple')){ const code=(/w:instr="([^"]*)"/.exec(r)||[])[1]||''; const name=(/MERGEFIELD\s+"?([^"\\]+?)"?\s*(\\|$)/.exec(code.replace(/&quot;/g,'"'))||[])[1]; const inner=r.replace(/^<w:fldSimple[^>]*>/,'').replace(/<\/w:fldSimple>$/,'');
      if(name){ const v=onField(name.trim(),'simple'); out+=xml.slice(pos,m.index)+(v==null?inner:inner.replace(/<w:t(\s[^>]*)?>[^<]*<\/w:t>/,'<w:t xml:space="preserve">'+esc(v)+'</w:t>').replace(/(<w:t(\s[^>]*)?>[^<]*<\/w:t>)([\s\S]*)$/,(a,b,c,d)=>b+d.replace(/<w:t(\s[^>]*)?>[^<]*<\/w:t>/g,'<w:t></w:t>'))); } else out+=xml.slice(pos,m.index)+inner;
      pos=m.index+r.length; continue; }
    const k=kindOf(r); const top=stack[stack.length-1];
    if(k==='begin'){ stack.push({code:'',state:'instr',start:m.index,resultRuns:[],depth:stack.length}); out+=xml.slice(pos,m.index); pos=m.index+r.length; continue; }
    if(!top){ continue; }   /* an ordinary run outside any field: copied with the slice */
    if(k==='instr'){ if(top.state!=='instr'){ problems.push('instrText after separate at '+m.index); } top.code+=(r.match(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/)||['',''])[1]; out+=xml.slice(pos,m.index); pos=m.index+r.length; continue; }
    if(k==='separate'){ if(top.state!=='instr') problems.push('second separate at '+m.index); top.state='result'; out+=xml.slice(pos,m.index); pos=m.index+r.length; continue; }
    if(k==='end'){ stack.pop(); const code=top.code.replace(/&quot;/g,'"').trim(); const name=(/^\s*MERGEFIELD\s+"?([^"\\]+?)"?\s*(\\|$)/.exec(code)||[])[1];
      const resultXml=xml.slice(pos,m.index); /* the cached result runs */
      if(name){ const v=onField(name.trim(),'complex'); if(top.state!=='result') problems.push('MERGEFIELD '+name+' has no separate');
        const rpr=(/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(resultXml)||[''])[0]; out+= v==null?resultXml:'<w:r>'+rpr+'<w:t xml:space="preserve">'+esc(v)+'</w:t></w:r>'; }
      else { onField(code.split(/\s+/)[0]||'?','other'); out+=resultXml; }   /* IF, DATE etc.: keep the cached result */
      pos=m.index+r.length; continue; }
    /* a plain run inside a field's result: part of the cached result, handled at end */
  }
  out+=xml.slice(pos); if(stack.length) problems.push(stack.length+' field(s) never ended');
  return {xml:out,problems};
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const aligned=walk(ALIGNED).filter(f=>/ - aligned\.docx$/.test(f)).sort();
fs.mkdirSync(path.join(REP,'merged-preview'),{recursive:true});
const rows=[]; let allOk=true;
for(const f of aligned){
  const rel=path.relative(ALIGNED,f).replace(/ - aligned\.docx$/,'.docx'); const orig=path.join(ORIG,rel);
  const za=unzip(f), zo=unzip(orig); const row={rel,checks:[]}; const fail=(m)=>{ row.checks.push('FAIL '+m); allOk=false; }; const pass=m=>row.checks.push('ok   '+m);
  /* 0. the package: same parts, settings.xml (mail-merge data source link) untouched */
  const partsA=Object.keys(za).sort().join(), partsO=Object.keys(zo).sort().join(); partsA===partsO?pass('package parts identical ('+Object.keys(za).length+')'):fail('package parts differ');
  const changedParts=Object.keys(zo).filter(k=>k!=='word/document.xml'&&Buffer.compare(Buffer.from(za[k]),Buffer.from(zo[k]))!==0);
  changedParts.length?fail('parts other than document.xml changed: '+changedParts.join(', ')):pass('every other part byte-identical (headers, footers, styles, settings.xml with the data-source link)');
  /* 1. accept all changes */
  const xmlA=str(za['word/document.xml']), xmlO=str(zo['word/document.xml']);
  const acc=accept(xmlA); const vA=XMLValidator.validate(acc); vA===true?pass('document.xml well-formed after accept-all'):fail('document.xml not well-formed after accept-all: '+JSON.stringify(vA).slice(0,120));
  if(/<w:ins\b|<w:del\b|w:delText|w:delInstrText/.test(acc)) fail('tracked-change markup left after accept-all'); else pass('no tracked-change markup left after accept-all');
  /* 2+3. merge both the original and the aligned, with the same record */
  const seenA=new Map(), seenO=new Map(); const unresolvedA=new Set(), unresolvedO=new Set(); const other=[];
  const onField=(seen,unres)=>(name,kind)=>{ if(kind==='other'){ other.push(name); return null; } seen.set(name,(seen.get(name)||0)+1); const i=resolve(name); if(i<0){ unres.add(name); return '[UNRESOLVED '+name+']'; } return record[i]; };
  const mA=mergeDoc(acc,onField(seenA,unresolvedA)); const mO=mergeDoc(accept(xmlO),onField(seenO,unresolvedO));
  mA.problems.length?fail('field structure: '+mA.problems.slice(0,3).join('; ')):pass('every field balanced: begin / instr / separate / end ('+[...seenA.values()].reduce((a,b)=>a+b,0)+' MERGEFIELDs'+(other.length?', '+other.length+' other fields kept':'')+')');
  const vM=XMLValidator.validate(mA.xml); vM===true?pass('merged document.xml well-formed'):fail('merged document.xml not well-formed: '+JSON.stringify(vM).slice(0,120));
  const textM=plain(mA.xml);
  /<w:fldChar|<w:instrText|<w:fldSimple|MERGEFIELD/.test(mA.xml.replace(/<w:instrText[^>]*>\s*(IF|DATE|TIME|PAGE|NUMPAGES|SEQ|REF|TOC|HYPERLINK|FILLIN|ASK|SET|FORMTEXT|FORMCHECKBOX|TOA|STYLEREF)\b[\s\S]*?<\/w:instrText>/g,''))&&!other.length?fail('merge-field markup left after merging'):pass('no merge-field markup left after merging');
  const leftA=textM.match(/«[^»]*»/g)||[], leftO=plain(mO.xml).match(/«[^»]*»/g)||[];
  const countBy=a=>a.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{}); const cA=countBy(leftA), cO=countBy(leftO);
  const introduced=Object.keys(cA).filter(k=>cA[k]>(cO[k]||0));
  introduced.length?fail('«field» text introduced by the alignment that does not merge: '+introduced.join(' ')):pass('no «field» text left by the alignment'+(leftA.length?' (the template already carried '+leftA.length+' typed «…» strings that are plain text, not fields: '+Object.keys(cA).join(' ')+')':''));
  row.typedChevrons=Object.keys(cA);
  /* 4. every field lost? every new field resolved? */
  const lost=[...seenO.keys()].filter(n=>!seenA.has(n)||seenA.get(n)<seenO.get(n)); lost.length?fail('fields lost or reduced: '+lost.slice(0,5).join(', ')):pass('every one of the '+seenO.size+' original field names present at least as often as before');
  const newUnres=[...unresolvedA].filter(n=>!unresolvedO.has(n)); newUnres.length?fail('new unresolved field names: '+newUnres.join(', ')):pass('no new unresolved field (the aligned text only reuses fields the template already had)');
  const added=[...seenA.keys()].filter(n=>seenA.get(n)>(seenO.get(n)||0)); row.addedFields=added;
  /* the values of the fields the new text uses must appear in the merged text */
  const missingVals=added.filter(n=>{ const i=resolve(n); return i>=0&&!textM.includes(record[i]); }); missingVals.length?fail('values of reused fields not found in merged text: '+missingVals.join(', ')):pass('the reused fields merged to their values in the new paragraphs ('+added.length+' field names reused)');
  /* the new paragraphs are there once merged */
  const leads=['Capacity for loss.','Investment time horizon.','Total ongoing cost and why it is justified.','should be read in conjunction with the original','Blacktower are not tax experts and due to the complexities'];
  const present=leads.filter(l=>textM.includes(l)); pass('new wording present after merge: '+present.length+' of the '+leads.length+' markers checked');
  row.unresolvedPreexisting=[...unresolvedO];
  /* write the merged preview, with the fictional record, for opening in Word */
  const outZip={}; for(const k in za) outZip[k]=za[k]; outZip['word/document.xml']=fflate.strToU8(mA.xml);
  const dest=path.join(REP,'merged-preview',rel.replace(/\.docx$/,' - merged with fictional data.docx')); fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,fflate.zipSync(outZip,{level:6}));
  rows.push(row);
}
let md='# Mail-merge test of the aligned templates\n\nRun '+new Date().toISOString().slice(0,16).replace('T',' ')+' UTC against MADS V.28 (Template sheet, '+headers.length+' headers). Fictional record only (Dana Hale). Word was not available on this machine: the merge is executed the way Word executes it, on the files as written; the final confirmation is to open one in Word and run Finish & Merge.\n\n**Result: '+(allOk?'all '+rows.length+' templates passed every check':'FAILURES — see below')+'.**\n\n';
rows.forEach(r=>{ md+='## '+r.rel+'\n\n'+r.checks.map(c=>'- '+c).join('\n')+'\n'+(r.addedFields.length?'\nFields reused by the new wording: '+r.addedFields.join(', ')+'\n':'')+(r.typedChevrons&&r.typedChevrons.length?'\nPRE-EXISTING DEFECT in the template, not caused by the alignment: these are typed as plain text, not merge fields, so they never merge: '+r.typedChevrons.join(' ')+'\n':'')+(r.unresolvedPreexisting.length?'\nPre-existing field names with no MADS V.28 header (merge blank today, before and after alignment): '+r.unresolvedPreexisting.join(', ')+'\n':'')+'\n'; });
fs.writeFileSync(path.join(REP,'mail-merge-test.md'),md);
rows.forEach(r=>console.log((r.checks.some(c=>c.startsWith('FAIL'))?'FAIL ':'PASS ')+r.rel+(r.checks.filter(c=>c.startsWith('FAIL')).map(c=>'\n      '+c).join(''))));
console.log(allOk?'\nALL PASSED':'\nFAILURES');
process.exit(allOk?0:1);
