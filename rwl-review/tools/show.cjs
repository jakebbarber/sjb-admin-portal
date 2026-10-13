const path=require('path');
const fs=require('fs'); const fflate=require(path.join(__dirname,'..','node_modules','fflate')); const R=require(path.join(__dirname,'..','..','sjb-portal','server','rwl_server.js'));
const [f,pat]=process.argv.slice(2); const xml=fflate.strFromU8(fflate.unzipSync(fs.readFileSync(f))['word/document.xml']);
const acc=xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g,'').replace(/<\/?w:ins\b[^>]*>/g,'');
const P=R.docxParas(acc).filter(p=>p.text.trim()); const re=new RegExp(pat,'i');
P.forEach((p,k)=>{ if(re.test(p.text)){ const prev=P[k-1]; console.log('   …'+(prev?prev.text.trim().slice(0,90):'')+'\n>> '+p.text.trim().slice(0,420)+'\n'); } });
