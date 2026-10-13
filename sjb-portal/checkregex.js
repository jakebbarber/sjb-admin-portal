/* Guards the built file against an escaping slip: a lost backslash inside a
   regex literal still parses, so it ships silently and quietly breaks
   extraction. Compared as plain strings — writing a regex to check a regex is
   how the first version of this got it wrong. */
const fs=require('fs');
const B=String.fromCharCode(92);
const Q=String.fromCharCode(39);
const src=fs.readFileSync('server/public/app.html','utf8');
let bad=0;

/* things that must be present, exactly */
[ ['PDF string tokeniser', '(?:'+B+B+'.|[^'+B+B+'()])*'],
  ['label separators',     'LABEL_SEPS=[/:/g,/'+B+'t/g'],
  ['word sanitiser',       'replace(/[^A-Za-z0-9_]/g,'+Q+Q+')'],
  ['prose guard',          'function looksLikeProse'],
  ['vertical line breaks', 'Math.abs(ty)>0.5'],
  ['wrapped-line joining', 'function unwrapLines'],
  ['colon pairing',        'function pairColonLabels']
].forEach(function(x){
  const ok=src.indexOf(x[1])>=0;
  console.log((ok?'  ok   ':'  BAD  ')+x[0]);
  if(!ok) bad++;
});

/* character classes that only exist when a backslash has been eaten */
['/s+/g','/d+/g','/w+/g','[^s]','(?:.|[^()])*','/^(pages*)?d','/n/g'].forEach(function(pat){
  if(src.indexOf(pat)>=0){ console.log('  BAD  a collapsed escape reached the build: '+pat); bad++; }
});
if(src.indexOf(String.fromCharCode(0))>=0){ console.log('  BAD  a NUL byte reached the build'); bad++; }

/* EVERY PART PARSES — the check that would have caught the CSV splitter.
   A signature list only finds damage we have already met once; asking the
   engine to parse each part finds anything that makes the file invalid. */
const vm=require('vm');
['ff/w02.html','ff/w03.html','ff/w04.html','ff/w05.html','ff/w07.html','ff/w09.html',
 'ff/w10.html','ff/wc.html','ff/wl.html','ff/wp.html','ff/wr.html','ff/wrep.html',
 'ff/wreco.html','ff/wfb.html','ff/ws.html','ff/wa.html'].forEach(function(f){
  let txt; try{ txt=fs.readFileSync(f,'utf8'); }catch(e){ return; }   /* optional parts */
  /* strip a leading <script> line if the part opens with one */
  txt=txt.replace(/^\s*<script>\s*/,'').replace(/<\/script>\s*$/,'');
  try{ new vm.Script(txt); }
  catch(e){ console.log('  BAD  '+f+' does not parse: '+e.message); bad++; }
});

console.log(bad? bad+' PROBLEM(S) — do not ship' : 'build integrity: clean');
process.exit(bad?1:0);
