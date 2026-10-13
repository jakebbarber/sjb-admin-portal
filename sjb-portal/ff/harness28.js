/* ===== V.28 blank: build three recalculation variants and validate ===== */
async function __runMads28(){
  const out={steps:[],b64:{}};
  const say=s=>out.steps.push(s);
  try{
    const b64=document.getElementById('madsB64').textContent.trim();
    const bin=atob(b64); const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    say('blank bytes='+bytes.length);
    const c=blankClient('Test Person'); const r=()=>uid('r');
    c.data.meta={ffDate:'2026-08-22',ffCurrency:'GBP',adviser:'Dion Angove',adviserEmail:'dion.angove@sjb-global.com'};
    c.data.personal.a1={title:'Mrs',firstName:'Testa',surname:'Person',dob:'1962-04-11',marital:'Married',nationality:'British',
      birthCountry:'United Kingdom',mobile:'+34 600 000 001',email:'testa@example.com',taxResidence:'Spain',taxResidentSince:'2015',health:'Good',smoker:'Non-smoker'};
    c.data.personal.a2={title:'Mr',firstName:'Testo',surname:'Person',dob:'1959-09-02',nationality:'Irish',birthCountry:'Ireland',
      mobile:'+34 600 000 002',email:'testo@example.com',taxResidence:'Spain',health:'Good',smoker:'Non-smoker'};
    c.data.employment.a1={status:'Employed',occupation:'Engineer',employer:'Acme SL',salary:'80000',bonus:'5000',salaryCcy:'EUR'};
    c.data.retirement.a1={retireCountry:'Spain',retireAge:'65',incomeCcy:'EUR',desiredIncome:'42000'};
    c.data.dependants=[{_id:r(),name:'Childa Person',dob:'1998-03-14',relationship:'Daughter'}];
    c.data.properties=[{_id:r(),owner:'Joint',type:'Main residence',location:'Marbella, Spain',ccy:'EUR',value:'620000',mortgage:'145000',mortgageType:'Repayment'},
      {_id:r(),owner:'Applicant 1',type:'Buy-to-let',location:'Leeds, UK',ccy:'GBP',value:'240000',rental:'950'}];
    c.data.cash=[{_id:r(),owner:'Joint',bank:'Santander',type:'Current account',ccy:'EUR',amount:'85000',location:'Spain'}];
    c.data.investments=[{_id:r(),owner:'Applicant 1',provider:'Quilter',type:'GIA',ccy:'GBP',value:'150000'}];
    c.data.dcPensions=[{_id:r(),owner:'Applicant 1',name:'Utmost QROPS',type:'QROPS',ccy:'GBP',value:'410000'}];
    c.data.statePensions=[{_id:r(),owner:'Applicant 1',country:'United Kingdom',years:'30',spa:'67',amount:'9800',ccy:'GBP'}];
    c.data.risk.a1={atrScore:'24',atrChosen:'Balanced',capacity:'Medium'};
    c.data.kyc.a1={pep:'No',sow:'Employment income',sof:'Pension / transfer'};
    c.data.beneficiaries=[{_id:r(),name:'Childa Person',relationship:'Daughter',dob:'1998-03-14',pct:'100'}];
    c.data.bank=[{_id:r(),owner:'Joint',bank:'Santander',accountName:'T Person',ccy:'EUR',iban:'ES91 0000',bic:'BSCHESMM'}];
    const dp=new DOMParser();
    for(const calc of ['full','none','chain']){
      const file=new File([bytes],'blank.xlsm');
      const t0=performance.now();
      const res=await buildMads(file,c,{calc});
      say(calc+': ms='+Math.round(performance.now()-t0)+' map='+res.mapInfo.source+'/'+res.mapInfo.count+' written='+res.written+' skipped='+res.skipped+' unmapped='+res.unmapped.length+(res.unmapped.length?' ['+res.unmapped.slice(0,6).join(' | ')+']':''));
      const buf=await res.blob.arrayBuffer();
      const back=readZip(buf); let bad=0;
      for(const e of back){ if(!/\.(xml|rels)$/i.test(e.name)) continue; const t=await entryText(e); if(dp.parseFromString(t,'application/xml').querySelector('parsererror')) bad++; }
      say(calc+': entries='+back.length+' badXml='+bad+' bytes='+buf.byteLength);
      let s=''; const u=new Uint8Array(buf); for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,Math.min(i+0x8000,u.length)));
      out.b64[calc]=btoa(s);
    }
  }catch(e){ out.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' ~ '); }
  return out;
}
