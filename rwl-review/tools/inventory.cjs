const fs=require('fs'),path=require('path'); const [IN,OUT,MADS]=process.argv.slice(2);
const fflate=require(path.join(__dirname,'..','node_modules','fflate')); const R=require(path.join(__dirname,'..','..','sjb-portal','server','rwl_server.js'));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(IN).filter(f=>/\.docx$/i.test(f)&&!/\/OLD\/|NO LONGER USED|Examples of|Handwritten/i.test(f)).sort();
/* MADS Template sheet row 1 headers */
const z=fflate.unzipSync(fs.readFileSync(MADS),{filter:f=>/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(f.name)});
const str=n=>fflate.strFromU8(z[n]); const rels={}; str('xl/_rels/workbook.xml.rels').replace(/<Relationship\b[^>]*>/g,t=>{const i=/Id="([^"]+)"/.exec(t),g=/Target="([^"]+)"/.exec(t); if(i&&g) rels[i[1]]=g[1].replace(/^\/?xl\//,'').replace(/^\.\//,''); return t;});
const sheets={}; str('xl/workbook.xml').replace(/<sheet\b[^>]*>/g,t=>{const n=/name="([^"]*)"/.exec(t),r=/r:id="([^"]+)"/.exec(t); if(n&&r) sheets[n[1].replace(/&amp;/g,'&')]='xl/'+rels[r[1]]; return t;});
console.log('MADS sheets:',Object.keys(sheets).join(' | '));
const ss=[]; (str('xl/sharedStrings.xml').match(/<si>[\s\S]*?<\/si>/g)||[]).forEach(si=>ss.push((si.match(/<t[^>]*>([^<]*)<\/t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join('')));
const tx=str(sheets['Template']); const row1=/<row r="1"[^>]*>([\s\S]*?)<\/row>/.exec(tx)[1]; const hdr=[];
row1.replace(/<c r="([A-Z]+)1"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(m,col,attrs,inner)=>{ let v=''; const t=/t="([^"]+)"/.exec(attrs); const vv=/<v>([^<]*)<\/v>/.exec(inner||''); if(t&&t[1]==='s'&&vv) v=ss[+vv[1]]; else if(t&&t[1]==='inlineStr') v=((inner||'').match(/<t[^>]*>([^<]*)<\/t>/g)||[]).map(x=>x.replace(/<[^>]+>/g,'')).join(''); else if(vv) v=vv[1]; if(v) hdr.push(v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')); return m; });
console.log('MADS Template headers:',hdr.length);
const norm=s=>String(s).replace(/\s+/g,' ').trim().toLowerCase(); const hset=new Set(hdr.map(norm)); const hsetU=new Set(hdr.map(h=>norm(h).replace(/[^a-z0-9]/g,'_')));
fs.writeFileSync(path.join(OUT,'mads-headers.json'),JSON.stringify(hdr,null,1));
const rows=[];
for(const f of files){ const rel=path.relative(IN,f); let xml; try{ xml=fflate.strFromU8(fflate.unzipSync(fs.readFileSync(f))['word/document.xml']); }catch(e){ rows.push({rel,err:e.message}); continue; }
  const codes=[...xml.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)].map(m=>m[1]).concat([...xml.matchAll(/w:fldSimple w:instr="([^"]*)"/g)].map(m=>m[1]));
  const merged=codes.join(' ').replace(/\s+/g,' '); const names=[...merged.matchAll(/MERGEFIELD\s+"?([^"\\ ]+(?: [^"\\ ]+)*?)"?\s*(?:\\|MERGEFIELD|$)/g)].map(m=>m[1].trim());
  const uniq=[...new Set(names)]; const missing=uniq.filter(n=>!hset.has(norm(n))&&!hsetU.has(norm(n).replace(/[^a-z0-9]/g,'_')));
  const numbered=R.docxNumbered(xml); const paras=numbered.split('\n').length; const words=numbered.split(/\s+/).length;
  const slug=rel.replace(/[^A-Za-z0-9]+/g,'_').replace(/_docx$/,''); fs.writeFileSync(path.join(OUT,slug+'.txt'),numbered);
  rows.push({rel,slug,paras,words,fields:uniq.length,missing}); }
fs.writeFileSync(path.join(OUT,'inventory.json'),JSON.stringify(rows,null,1));
rows.forEach(r=>console.log((r.err?'ERR ':'')+r.rel+' | paras '+r.paras+' | words '+r.words+' | fields '+r.fields+(r.missing&&r.missing.length?' | NOT IN MADS: '+r.missing.slice(0,6).join('; ')+(r.missing.length>6?' (+'+(r.missing.length-6)+')':''):'')));
