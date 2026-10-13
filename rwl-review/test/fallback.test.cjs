/* The outage fallback in askClaude, with fetch stubbed: retry once on the
   main model, then the backup; our own bad requests are not retried. */
const R=require('../../sjb-portal/server/rwl_server.js');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('  FAIL '+m);} };
const deps={claudeKey:'test-key',retryWait:0}; const rb={rubricText:'',manual:''}; const schema={type:'object'};
const good=model=>({ok:true,json:async()=>({model,stop_reason:'end_turn',content:[{type:'text',text:'{"a":1}'}],usage:{input_tokens:1}})});
const bad=status=>({ok:false,status,json:async()=>({error:{message:'status '+status}})});
async function run(seq){ const calls=[]; globalThis.fetch=async(url,o)=>{ const m=JSON.parse(o.body).model; calls.push(m); const r=seq.shift(); if(r==='net') throw new TypeError('fetch failed'); return typeof r==='function'?r(m):r; }; let out,err; try{ out=await R.askClaude(deps,rb,'s','u',schema);}catch(e){ err=e; } return {calls,out,err}; }
(async()=>{
  let r=await run([good]); ok(r.out&&r.out.model==='claude-opus-5-5'&&r.calls.length===1&&!r.out.fellBack,'a good answer first time: one call, main model');
  r=await run([bad(529),good]); ok(r.out&&r.calls.join()==='claude-opus-5-5,claude-opus-5-5'&&!r.out.fellBack,'overloaded once: retried on the main model, no fallback flag');
  r=await run([bad(529),bad(503),good]); ok(r.out&&r.calls[2]==='claude-sonnet-5-5'&&r.out.fellBack===true,'down twice: the backup model answers and is flagged');
  r=await run(['net','net',good]); ok(r.out&&r.calls.length===3,'network failures are treated as transient');
  r=await run([bad(400)]); ok(r.err&&r.calls.length===1&&/status 400/.test(r.err.message),'a bad request is not retried');
  r=await run([bad(401)]); ok(r.err&&r.calls.length===1,'a bad key is not retried');
  r=await run([bad(529),bad(529),bad(529)]); ok(r.err&&r.calls.length===3&&/main and backup/.test(r.err.message),'all three fail: a clear error naming both');
  const d2={...deps,claudeModel:'claude-opus-5-5',claudeFallbackModel:'claude-opus-5-5'}; globalThis.fetch=async()=>bad(529); let n=0; globalThis.fetch=async()=>{n++; return bad(529);}; try{ await R.askClaude(d2,rb,'s','u',schema);}catch(e){} ok(n===2,'backup same as main: no third call');
  console.log(pass+' passed, '+fail+' failed'); process.exit(fail?1:0);
})();
