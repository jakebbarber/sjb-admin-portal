/* Build a runnable harness page: the whole portal, then the test script.
   node mkfull.js fftest learntest applytest ...
   A harness that reads #tplB64 or #madsB64 gets that workbook inlined. */
const fs=require('fs');
const app=fs.readFileSync('server/public/app.html','utf8');
const INLINE={tplB64:'novia_b64.txt',madsB64:'mads28_b64.txt'};
process.argv.slice(2).forEach(n=>{
  const t=fs.readFileSync(n+'.html','utf8');
  let extra='';
  Object.keys(INLINE).forEach(id=>{ if(t.indexOf(id)>=0)
    extra+='<pre id="'+id+'" style="display:none">'+fs.readFileSync(INLINE[id],'utf8').trim()+'</pre>\n'; });
  const out=app+'\n'+extra+t;
  fs.writeFileSync(n+'_full.html',out);
  console.log(n+'_full.html  '+Math.round(out.length/1024)+' KB');
});
