/* Mail-merge safety tests for the PORTAL engine (sjb-portal/server/rwl_server.js).
   Run from the rwl-review folder (it has fflate and docx installed):
     node test/make_template.cjs && node test/merge.test.cjs
   The templates are MADS mail-merge documents, so every MERGEFIELD must
   survive every edit. These tests are the proof. */
const fs=require('fs'); const path=require('path');
const fflate=require('fflate');
const R=require('../../sjb-portal/server/rwl_server.js');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('FAIL',m); } };

const bytes=fs.readFileSync(path.join(__dirname,'fixture-template.docx'));
const doc=R.docxOpen(fflate,bytes);
const letter=R.docxNumbered(doc.xml);
ok(/«Client_Surname»/.test(letter),'the reviewer sees fields as «tokens»');
const paras=R.docxParas(doc.xml);
const idx=s=>paras.findIndex(p=>p.text.includes(s));
const nFields=xml=>(xml.match(/MERGEFIELD/g)||[]).length;
const before=nFields(doc.xml);
ok(before>=18,'fixture has merge fields: '+before);

const edits=[
  /* keeps both fields: allowed, fields rebuilt as real MERGEFIELDs */
  {op:'replace',para:idx('Dear «Client_Title»'),anchor:'Dear',lead:'',text:'Dear «Client_Title» «Client_Surname», thank you for your time.',point:1,reason:'keep fields'},
  /* drops Income_Annual: must be refused */
  {op:'replace',para:idx('We recently went through a Cashflow'),anchor:'We recently went through a Cashflow report',lead:'',text:'We prepared a cashflow forecast for you.',point:2,reason:'would lose fields'},
  /* new paragraph using an existing field: field rebuilt */
  {op:'insert_after',para:idx('Based on this cashflow forecast'),anchor:'Based on this cashflow forecast',lead:'Key assumptions behind the forecast.',text:'The forecast assumes your income of «Income_Annual» a year continues. That is the single largest driver of the result.',point:3,reason:'R3'},
  /* delete a bullet with no fields: fine */
  {op:'delete',para:idx('Better Performance'),anchor:'Better Performance',lead:'',text:'',point:4,reason:'R7'}
];
const r=R.docxRedline(doc.xml,edits,{author:'Test Author',date:new Date('2026-10-13T09:00:00Z')});
ok(r.applied.length===3,'three edits applied, got '+r.applied.length);
ok(r.skipped.length===1&&/would remove the mail-merge field/.test(r.skipped[0].why)&&/Income_Annual/.test(r.skipped[0].why),'the field-dropping replace is refused with a reason: '+(r.skipped[0]&&r.skipped[0].why));
ok(r.merge&&r.merge.missing.length===0,'no field missing after edits: '+JSON.stringify(r.merge&&r.merge.missing));
ok(r.merge.after===r.merge.before+1,'accepted view has one more field (the new paragraph reuses Income_Annual): '+r.merge.before+' -> '+r.merge.after);
const instr=(r.xml.match(/<w:instrText[^>]*> MERGEFIELD Client_Surname[^<]*<\/w:instrText>/g)||[]);
ok(instr.length>=1,'rebuilt Client_Surname field has a real MERGEFIELD code ('+instr.length+' found)');
ok((r.xml.match(/<w:delInstrText[^>]*> MERGEFIELD Client_Title[^<]*<\/w:delInstrText>/g)||[]).length>=1,'the replaced paragraph has its old field code deleted as delInstrText');
ok(!/<w:fldSimple/.test((r.xml.match(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g)||[]).join('')),'no simple field left inside a deletion');
const begins=(r.xml.match(/w:fldCharType="begin"/g)||[]).length, ends=(r.xml.match(/w:fldCharType="end"/g)||[]).length;
ok(begins===ends,'field begin/end balanced: '+begins+'/'+ends);
const out=R.docxSave(fflate,doc,r.xml);
fs.writeFileSync(path.join(__dirname,'fixture-template-redlined.docx'),out);
ok(R.docxOpen(fflate,out).xml===r.xml,'round trip through zip');
console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
