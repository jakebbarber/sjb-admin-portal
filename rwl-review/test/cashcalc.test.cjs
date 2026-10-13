/* The cashflow reconciliation in the portal engine: C8 (figures) and the
   paragraphs it picks as the cashflow summary. Fictional letter and report. */
const fs=require('fs'); const path=require('path');
const fflate=require('fflate');
const R=require('../../sjb-portal/server/rwl_server.js');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('  FAIL '+m);} };
const text=f=>{ const z=fflate.unzipSync(fs.readFileSync(path.join(__dirname,f))); return fflate.strFromU8(z['word/document.xml']); };
const letter=R.docxNumbered(text('fixture-rwl.docx'));
const report=R.docxParas(text('fixture-cashcalc.docx')).map(p=>p.text).join('\n');

const paras=R.cashflowParas(letter);
ok(paras.length>=3,'picks the cashflow section and the recommendation sentence that cites it ('+paras.length+')');
ok(paras.some(p=>/EUR 90,000/.test(p.text)),'the cashflow paragraph with the figures is in');
ok(!paras.some(p=>/initial advice fee/.test(p.text)),'the charges paragraph is not');

const f=R.figuresOf('Income EUR 90,000 a year; growth 4.0%; retire at age 65 in 2040; value £310k; the meeting on 01/10/2026; risk 5/10.');
ok(f.some(x=>x.kind==='amount'&&x.v===90000),'amount with currency code');
ok(f.some(x=>x.kind==='amount'&&x.v===310000),'£310k expands to 310000');
ok(f.some(x=>x.kind==='percent'&&x.v===4),'percentage');
ok(f.some(x=>x.kind==='age'&&x.v===65),'age');
ok(f.some(x=>x.kind==='year'&&x.v===2040),'year');
ok(!f.some(x=>x.v===2026||x.v===1||x.v===10),'a date and a risk score are not figures');

const none=R.cashflowCheck(letter,'');
ok(none.findings.length===1&&none.findings[0].rule==='C8'&&none.findings[0].severity==='should','no report attached: one should-level C8');
const m=R.cashflowCheck(letter,report);
ok(m.compared>=2,'figures compared ('+m.compared+')');
ok(m.missing.some(x=>/90,000/.test(x)),'EUR 90,000 is caught as not in the report: '+JSON.stringify(m.missing));
ok(!m.missing.some(x=>/48,000/.test(x)),'EUR 48,000 (in both) is not flagged');
ok(m.findings.every(x=>x.rule==='C8'&&x.severity==='must'&&x.paragraph>0),'mismatches are must-level C8 findings on a paragraph');
const agree=R.cashflowCheck(letter.replace('EUR 90,000','EUR 85,000'),report);
ok(agree.findings.length===0,'a summary that matches the report has no C8 findings');
const cc=R.codeChecks(letter,{report});
ok(cc.checks.some(x=>x.rule==='C8')&&cc.cashflow.attached&&cc.cashflow.missing.length===m.missing.length,'codeChecks carries C8 and the cashflow summary');
const mock=R.mockFindings(letter,report);
ok(mock.findings.some(x=>x.rule==='R16'),'the sandbox mock raises R16 when the report shows a shortfall the letter does not');
ok(!R.mockFindings(letter,'').findings.some(x=>x.rule==='R16'),'and not without a report');
console.log(pass+' passed, '+fail+' failed'); process.exit(fail?1:0);
