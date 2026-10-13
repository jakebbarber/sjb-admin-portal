/* The automatic checks added from the bounce-back pattern of 13 Oct 2026:
   C1 surname near-miss, C9 the same figure everywhere, C10 a plan valued two
   ways. Fictional letters built inline (Peter Marlow is invented). */
const R=require('../../sjb-portal/server/rwl_server.js');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('  FAIL '+m);} };
const L=lines=>lines.map((t,i)=>'['+i+'] '+t).join('\n');
const by=(cc,rule)=>cc.checks.filter(f=>f.rule===rule);
const base=['Mr Peter Marlow','Dear Mr Marlow','{Heading2} Your circumstances','Your gross income is EUR 300,000 a year and your expenditure is EUR 150,000 a year.','{Heading2} Cashflow Report','The cashflow assumes employment income of £250,000 a year and expenditure of £128,000 a year.','{Heading2} Recommendation','I recommend you transfer your Acme pension to the Example SIPP.','Yours sincerely'];

let cc=R.codeChecks(L(base),{});
const c9=by(cc,'C9');
ok(c9.some(f=>/income/.test(f.issue)&&f.severity==='should'),'C9: income in EUR and in GBP in different sections is a should-level finding');
ok(c9.some(f=>/expenditure/.test(f.issue)),'C9: expenditure too');
ok(!by(cc,'C1').length,'C1: no false surname finding on a consistent letter');

cc=R.codeChecks(L(base.map(t=>t.replace('£250,000','EUR 250,000'))),{});
ok(by(cc,'C9').some(f=>/income/.test(f.issue)&&f.severity==='must'),'C9: same currency, different figure, is a must');

cc=R.codeChecks(L(base.map(t=>t.replace('The cashflow assumes employment income of £250,000','The cashflow assumes employment income of £250,000 (EUR 300,000 converted at the exchange rate used in the plan)'))),{});
ok(!by(cc,'C9').some(f=>/income/.test(f.issue)),'C9: a sentence that states the conversion is not flagged');

cc=R.codeChecks(L(base.concat(['Mr Marlowe has also asked about his ISA.'])),{});
ok(by(cc,'C1').some(f=>/Marlowe/.test(f.issue)&&f.severity==='must'),'C1: Marlow / Marlowe is caught as a misspelt surname');
cc=R.codeChecks(L(base.concat(['The Market in Lyon is busy.','Marlborough Street is nearby.'])),{});
ok(!by(cc,'C1').length,'C1: ordinary words a few letters off are not flagged');

const val=['Mr Peter Marlow','Dear Mr Marlow','The transfer value of your Acme pension is £245,000.','{Heading2} Comparison','The fund value is £261,000 and the transfer value is £245,000.'];
cc=R.codeChecks(L(val),{});
ok(by(cc,'C10').length===1&&/245,000.*261,000/.test(by(cc,'C10')[0].issue),'C10: transfer value and fund value differ with no reason given');
cc=R.codeChecks(L(val.concat(['The fund value includes a protected benefit of £16,000 that does not transfer, which is why the transfer value is lower.'])),{});
ok(!by(cc,'C10').length,'C10: not flagged when the letter explains the difference');

ok(R.RWL_RUBRIC.some(r=>r.id==='R17')&&R.RWL_RUBRIC.some(r=>r.id==='R18')&&R.RWL_RUBRIC.some(r=>r.id==='R19'),'rubric carries R17, R18, R19');
ok(/capacity for loss must be its own/i.test(R.RWL_RUBRIC.find(r=>r.id==='R8').rule),'R8 asks for capacity for loss as its own statement');
console.log(pass+' passed, '+fail+' failed'); process.exit(fail?1:0);
