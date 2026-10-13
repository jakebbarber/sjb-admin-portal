/* ===== MADS build test harness — runs against the real workbook ===== */
async function __runMadsTest(){
  const out={ok:false,steps:[]};
  const say=s=>out.steps.push(s);
  try{
    // 1. rebuild the real workbook file from base64
    const b64=document.getElementById('madsB64').textContent.trim();
    const bin=atob(b64); const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const file=new File([bytes],'real-mads.xlsm');
    say('source bytes='+bytes.length);

    // 2. baseline: which parts are XML-parseable in the original
    const orig=readZip(bytes.buffer.slice(0));
    say('orig entries='+orig.length);
    const dp=new DOMParser();
    const isXml=n=>/\.(xml|rels)$/i.test(n);
    const badOrig=[];
    for(const e of orig){ if(!isXml(e.name)) continue;
      const t=await entryText(e);
      if(dp.parseFromString(t,'application/xml').querySelector('parsererror')) badOrig.push(e.name);
    }
    say('orig unparseable xml (baseline, expect none): '+JSON.stringify(badOrig));

    // 3. rich fictional client touching many mapped fields
    const c=blankClient('Test Person');
    const r=()=>uid('r');
    c.data.meta={ffDate:'2026-08-21',ffCurrency:'GBP',adviser:'Dion Angove',adviserEmail:'dion.angove@sjb-global.com'};
    c.data.personal.a1={title:'Mrs',firstName:'Testa',surname:'Person',dob:'1962-04-11',marital:'Married',
      nationality:'British',birthCountry:'United Kingdom',mobile:'+34 600 000 001',email:'testa@example.com',
      taxResidence:'Spain',taxResidentSince:'2015',health:'Good',smoker:'Non-smoker',nino:'QQ123456C'};
    c.data.personal.a2={title:'Mr',firstName:'Testo',surname:'Person',dob:'1959-09-02',nationality:'British',
      birthCountry:'United Kingdom',mobile:'+34 600 000 002',email:'testo@example.com',taxResidence:'Spain',
      health:'Good',smoker:'Non-smoker'};
    c.data.employment.a1={status:'Employed',occupation:'Engineer',employer:'Acme SL',salary:'80000',bonus:'5000',salaryCcy:'EUR',since:'2016-03-01'};
    c.data.employment.a2={status:'Retired',prevOccupation:'Teacher',retiredDate:'2020-06-30'};
    c.data.retirement.a1={retireCountry:'Spain',retireAge:'65',incomeCcy:'EUR',desiredIncome:'42000',covers:'Joint / household'};
    c.data.addresses=[{_id:r(),owner:'Both',line1:'12 Calle Prueba',city:'Marbella',postcode:'29600',country:'Spain',from:'2018-01-01'}];
    c.data.dependants=[{_id:r(),name:'Childa Person',dob:'1998-03-14',relationship:'Daughter',dependent:'Non-dependent'},
                       {_id:r(),name:'Childo Person',dob:'2001-07-22',relationship:'Son',dependent:'Non-dependent'}];
    c.data.properties=[{_id:r(),owner:'Joint',type:'Main residence',location:'Marbella, Spain',ccy:'EUR',value:'620000',
      purchased:'2018',purchasePrice:'480000',mortgage:'145000',mortgageType:'Repayment',rate:'2.1',term:'14',monthly:'1180'},
      {_id:r(),owner:'Applicant 1',type:'Buy-to-let',location:'Leeds, UK',ccy:'GBP',value:'240000',rental:'950'}];
    c.data.cash=[{_id:r(),owner:'Joint',bank:'Santander',type:'Current account',ccy:'EUR',amount:'85000',location:'Spain'},
                 {_id:r(),owner:'Applicant 1',bank:'HSBC',type:'Deposit / savings',ccy:'GBP',amount:'22000',location:'United Kingdom'}];
    c.data.investments=[{_id:r(),owner:'Applicant 1',provider:'Quilter',type:'GIA',ccy:'GBP',value:'150000'}];
    c.data.dcPensions=[{_id:r(),owner:'Applicant 1',name:'Utmost QROPS',type:'QROPS',ccy:'GBP',value:'410000',nmpa:'55',personalContrib:'6000'}];
    c.data.statePensions=[{_id:r(),owner:'Applicant 1',country:'United Kingdom',years:'30',spa:'67',amount:'9800',ccy:'GBP'}];
    c.data.liabilities=[{_id:r(),owner:'Applicant 2',type:'Personal loan',lender:'BBVA',ccy:'EUR',balance:'12000',monthly:'350',term:'3'}];
    c.data.protection=[{_id:r(),owner:'Applicant 1',provider:'Zurich',type:'Life assurance',ccy:'EUR',sumAssured:'200000',premium:'85'}];
    c.data.risk.a1={atrScore:'24',atrChosen:'Balanced',capacity:'Medium',experience:'Moderate (3-10 years)',
      objective:'Balanced growth',horizon:'10-15 years',withdrawIncome:'No',cashMonths:'8'};
    c.data.esg={consider:'Yes',discussion:'Discussed at first meeting.',excluded:'None'};
    c.data.kyc.a1={pep:'No',sow:'Employment income',sof:'Pension / transfer',method:'Video call'};
    c.data.beneficiaries=[{_id:r(),name:'Childa Person',relationship:'Daughter',dob:'1998-03-14',pct:'50',email:'childa@example.com'},
                          {_id:r(),name:'Childo Person',relationship:'Son',dob:'2001-07-22',pct:'50'}];
    c.data.bank=[{_id:r(),owner:'Joint',bank:'Santander',accountName:'T and T Person',ccy:'EUR',iban:'ES91 0000 0000 0000 0000 0000',bic:'BSCHESMM',heldSince:'2018',proof:'Yes'}];

    const plan=madsCellPlan(c);
    say('plan sheets: '+Object.keys(plan.plan).map(k=>k+'='+Object.keys(plan.plan[k]).length).join(' '));
    say('unmapped: '+plan.unmapped.length+(plan.unmapped.length?' -> '+plan.unmapped.join(' | '):''));

    // 4. build
    const t0=performance.now();
    const res=await buildMads(file,c);
    say('buildMads ms='+Math.round(performance.now()-t0));
    say('written='+res.written+' skipped='+res.skipped+' missing='+JSON.stringify(res.missing));
    say('touched='+res.touched.join(' | '));
    say('out bytes='+res.blob.size);

    // 5. validate output: every XML part must parse; entry sets must match
    const buf=await res.blob.arrayBuffer();
    const back=readZip(buf);
    say('out entries='+back.length+' (orig '+orig.length+', minus calcChain = '+(orig.length-1)+')');
    const badOut=[];
    for(const e of back){ if(!isXml(e.name)) continue;
      const t=await entryText(e);
      const doc=dp.parseFromString(t,'application/xml');
      const pe=doc.querySelector('parsererror');
      if(pe) badOut.push(e.name+' :: '+pe.textContent.slice(0,200).replace(/\s+/g,' '));
    }
    say('OUT unparseable xml parts: '+(badOut.length?JSON.stringify(badOut):'NONE'));

    // 6. structural checks on each patched sheet
    const wbx=await entryText(back.find(e=>e.name==='xl/workbook.xml'));
    const relx=await entryText(back.find(e=>e.name==='xl/_rels/workbook.xml.rels'));
    const smap=sheetPaths(wbx,relx);
    for(const sn of Object.keys(plan.plan)){
      const p=smap[sn]; if(!p){ say('CHECK '+sn+': no path'); continue; }
      const t=await entryText(back.find(e=>e.name===p));
      const rows=[...t.matchAll(/<row[^>]*\br="(\d+)"/g)].map(m=>+m[1]);
      const rowsSorted=rows.every((v,i,a)=>i===0||a[i-1]<v);
      const cells=[...t.matchAll(/<c[^>]*\br="([A-Z]+\d+)"/g)].map(m=>m[1]);
      const dup=cells.filter((v,i,a)=>a.indexOf(v)!==i);
      say('CHECK '+sn+': rows='+rows.length+' ascending='+rowsSorted+' dupCells='+(dup.length?dup.slice(0,8).join(','):'none'));
      let orderOk=true, badRow='';
      for(const rm of t.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)){
        const refs=[...rm[2].matchAll(/<c[^>]*\br="([A-Z]+\d+)"/g)].map(m=>m[1]);
        for(let i=1;i<refs.length;i++){
          if(colIdx(refs[i])<=colIdx(refs[i-1])){ orderOk=false; badRow=rm[1].slice(0,40)+' :: '+refs[i-1]+'>'+refs[i]; break; }
        }
        if(!orderOk) break;
      }
      say('CHECK '+sn+': cell order ok='+orderOk+(badRow?' at '+badRow:''));
    }
    out.ok=badOut.length===0;
    // hand the built workbook back for OS-level validation
    let s=''; const u=new Uint8Array(buf);
    const CH=0x8000; for(let i=0;i<u.length;i+=CH){ s+=String.fromCharCode.apply(null,u.subarray(i,Math.min(i+CH,u.length))); }
    out.b64=btoa(s);
  }catch(e){ out.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' ~ '); }
  return out;
}
