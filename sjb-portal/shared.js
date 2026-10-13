/* ===========================================================================
   SJB FACT FIND
   A working replacement for the planning spreadsheet. Everything is stored in
   this browser (localStorage) and never leaves it unless you export a file or
   press a button that opens an email.
   ========================================================================= */
const CFG = {
  org:'SJB Global', app:'SJB Fact Find', network:'Blacktower Financial Management',
  version:'1.0', schema:'3.26',
  adminEmail:'admin@sjb-global.com',        /* where work requests go */
  portalBase:'https://my.sjb-global.example/',
  storeKey:'sjb.factfind.v1',
  /* The two places this tool lives. They keep separate data — see Settings. */
  publishedUrl:'https://claude.ai/code/artifact/7c3300b8-d63f-4e17-a2c6-116e0b469524',
  localFile:'sjb-factfind.html'
};
const CCY_SYM={GBP:'£',EUR:'€',USD:'$',CHF:'CHF ',AUD:'A$',CAD:'C$',SEK:'kr ',NOK:'kr ',SGD:'S$',AED:'AED ',ZAR:'R '};
const CURRENCIES=['GBP','EUR','USD','CHF','AUD','CAD','SEK','NOK','SGD','AED','ZAR'];

/* -------------------------------- utils --------------------------------- */
/* Stamped by the build script. Shown in the rail so it is obvious at a
   glance whether the browser is running the copy that was deployed. */
const BUILD='2026-10-13 11:58';
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const d2=n=>String(n).padStart(2,'0');
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function D(s){ if(s instanceof Date)return s; if(!s)return null;
  if(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
  const d=new Date(s); return isNaN(d)?null:d; }
function iso(d){ d=D(d)||new Date(); return d.getFullYear()+'-'+d2(d.getMonth()+1)+'-'+d2(d.getDate()); }
function fdate(s){ const d=D(s); return d? d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear():'—'; }
function fdateS(s){ const d=D(s); return d? d.getDate()+' '+MONS[d.getMonth()]+' '+d.getFullYear():'—'; }
function fdt(s){ const d=D(s); return d? fdateS(d)+', '+d2(d.getHours())+':'+d2(d.getMinutes()):'—'; }
function age(dob){ const d=D(dob); if(!d)return null; const t=new Date();
  let a=t.getFullYear()-d.getFullYear(); const m=t.getMonth()-d.getMonth();
  if(m<0||(m===0&&t.getDate()<d.getDate()))a--; return a; }
function money(v,c){ if(v==null||v===''||isNaN(v))return '—';
  return (CCY_SYM[c||'GBP']||((c||'')+' '))+Number(v).toLocaleString('en-GB',{maximumFractionDigits:0}); }
const sum=(a,f)=>a.reduce((t,x)=>t+(Number(f?f(x):x)||0),0);
const grp=(a,f)=>a.reduce((m,x)=>{const k=f(x);(m[k]=m[k]||[]).push(x);return m;},{});
function initials(n){ return String(n||'?').split(/[\s&]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
let _n=0; const uid=p=>(p||'id')+'-'+Date.now().toString(36)+'-'+(++_n);
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

/* -------------------------------- icons --------------------------------- */
const IC={
  home:'M3 10.5 12 3l9 7.5V21H3z|M9 21v-7h6v7',
  users:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8|M22 20v-2a4 4 0 0 0-3-3.9|M16 3.1a4 4 0 0 1 0 7.8',
  user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  clip:'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M9 2h6v4H9z|M9 14l2 2 4-4',
  send:'M22 2 11 13|M22 2l-7 20-4-9-9-4z',
  mail:'M2 5h20v14H2z|M2 6l10 7 10-7',
  dl:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  up:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12',
  plus:'M12 5v14|M5 12h14',
  x:'M18 6 6 18|M6 6l12 12',
  check:'M20 6 9 17l-5-5',
  checkc:'M22 11.1V12a10 10 0 1 1-5.9-9.1|M22 4 12 14.1l-3-3',
  alert:'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z|M12 9v4|M12 17h.01',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20|M12 16v-4|M12 8h.01',
  chev:'M9 18l6-6-6-6', chevL:'M15 18l-6-6 6-6', chevD:'M6 9l6 6 6-6',
  search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16|M21 21l-4.3-4.3',
  cog:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6|M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.4 18l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 12.6H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5.6 6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.6 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1',
  trash:'M3 6h18|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6',
  copy:'M9 9h11v11H9z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  sliders:'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  brief:'M3 7h18v14H3z|M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2|M3 13h18',
  build:'M3 21h18|M5 21V7l7-4 7 4v14|M9 9h.01|M15 9h.01|M9 13h.01|M15 13h.01|M9 17h.01|M15 17h.01',
  wallet:'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5|M16 12h.01',
  pig:'M4 12a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3h2v-4|M4 12H2v4h2|M7 20v-2|M15 20v-2|M14 9h.01',
  chart:'M3 21h18|M6 17V9|M11 17V5|M16 17v-6|M21 17v-9',
  scale:'M12 3v18|M5 7h14|M5 7 2 14h6zM19 7l-3 7h6z',
  umbr:'M12 22a2 2 0 0 1-2-2v-8|M2 12a10 10 0 0 1 20 0z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  globe:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20|M2 12h20|M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20',
  sun:'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10|M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4',
  route:'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6|M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6|M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3',
  file:'M13 2H6v20h12V8z|M13 2v6h5',
  key:'M15 2a7 7 0 1 0-6.7 9L11 13.7V17h3v3h3l3-3v-3l-4.8-4.8A7 7 0 0 0 15 2z',
  link:'M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.5 3.5l-1.7 1.7|M14 11a5 5 0 0 0-7.5-.5l-3 3A5 5 0 0 0 10.5 20.5l1.7-1.7',
  leaf:'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8a7 7 0 0 1-7 7z|M2 21c0-3 1.9-5.4 5-6',
  swap:'M7 16H3l4-4|M3 16h13a4 4 0 0 0 0-8h-1|M17 8h4l-4-4|M21 8H8a4 4 0 0 0 0 8h1',
  save:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z|M17 21v-8H7v8|M7 3v5h8'
};
function ic(n,s){ const p=IC[n]; if(!p) return '';
  const z=s||16;
  return '<svg width="'+z+'" height="'+z+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + p.split('|').map(d=>'<path d="'+d+'"/>').join('')+'</svg>'; }
const LOGO='data:image/webp;base64,UklGRr4EAABXRUJQVlA4TLIEAAAvdwAUEAdBmG1UgcM9/88gBAIpTmS7BQJJ/k4DbEUgQNED/V/JAgleR4uh3QOLwIKWbNtOKmptokgQBBHlCKv/3eSwT7i88BnR/wmAvqnyVMKXOD7pe8J5LadZXrUI+SgTifNh+UaQnh2T28NXX0qsJY5PhqvF+dZ7aRKJNektawSpmySNh5vEW+E4MVwtXu9OpcSb9BYTQepHSoebRFzhODFcLb5rVSMRJ73FRJB6k1bRJzFVOE4MV4v/tD8rJeKkt5gI0gBSnTwk5grHieFqCZn0ttIhrzv8RePk2NWpTu62RJU0+KOBANx1qaURbdLhqtCp5HGoVA2uC5WqPuSaDFeGVHM7pJr7td00+UG03bU1IXBtbYju2hqnRFNf280p1xSX1iea6nDTSHtllWjrQ6NK++uqRf049CrJuquqRJ3BWqhEbt0V9K3rLRX93dY6iCS5c1E1fWSthE16G3IXz0VzIRVOuyhE0uYqUiirOESK/hoqDfJIJO0uQW6aPotEku4SpFSgzyORpLsEqRTALRLJ+kuQVoM2jUNu15D2GqDOopDuEqTSAV2VR5BfQ9I7HPvWuS4d5BGB3ybXyd2D10ehu/0RoElUWRxAqcr+DDqVPCJBppHeB+NApWpiaVWth1E1hECiqWJBqrl7eKsQtNSU0ZSaysOmMWHumjyaKshM7RKm/QtliGFTjWGqv5Bq7k5fajeELTS3WFrRti5vqpcwD9FWsWSq3uFD/TNMoWojKUWbQf001H8RtBI1onwUor5pnh867s8QfSHqwjZM9sOjda1LcXwAeE/T9Fp+dF4APFq/TZmIvrF9aZ8BtBI4BzDT8w9An0qUKawTz58AskAdAONpfwK4SZyNzShWAHWYG4CJnkcArcSZwzpR+wQeQbIegPE0A+jTOJLeZlQzgCRA0gF40+v+AoBM4uxgnaheAOT+kg7AuHvZRgAoJcqkhn2LJ+0ADD/6XAcAKCXKpIN9ZjRFD2D40eM2AUBfSJT5A6ebwxtA5idtAGD40f0349hlEmNa43ym4whAfBY1rMPbOGyfEdZ7IhEWNbSr0a8Auty1qJoe2mFaPua4Lq8nTqs8fNX0+B9wXFZzPp4ty7L4GJdlWV4Oz8U+D6plWZbRx7wsy3TyNFRPZyTpNm207m/VxNN91JDkb/BgSC62eWc8M5WrF+5PB36CjDuPP3PcA01Uf73w7cIpxI8kPwOsH2PGEBvJfQaehiSnM/uwklyctsHfRJIfePXwIskRxx/J1QUfkm8nrv4WkvuASRliIfmFdSK5n43muJHcBze+vK0kDTDzdA1hSM42kOTZxPM3HL4k9yEQZts+/C3ODpMhufpaSO4A8LG8EOJD8mMbdaOxbiT3wWEkybenF0m+AWAmuSLITHJ/WlaS5uz8R3JywIfk/vSDjSTfwHMn9yHMsJP8jcDwJcnZadh8DDtJ42k6cDMbyRecjDFmPsObx5/ZSfKH89FYd5J86r7LYkjy7bIZYwwwH6wr3I6LAt+D/TcoJioNdCQXQ5KjgxXAtNn2IRze+8k6wMtvcNqH8fDzBMzrRm4vOJrTWYXhvRpjPiPUozmdoTXWF/A2xpjX2cecAg==';
function logo(h,dark){ h=h||26;
  return '<img src="'+LOGO+'" alt="'+CFG.org+'" style="display:block;height:'+h+'px;width:auto'
    +(dark?';filter:brightness(0) invert(1)':'')+'">'; }

/* ------------------------- controlled vocabularies ---------------------- */
const L={
  title:['Mr','Mrs','Miss','Ms','Dr','Prof','Sir','Lady'],
  marital:['Single','Married','Civil partnership','Living with partner','Separated','Divorced','Widowed'],
  gender:['Male','Female','Prefer not to say'],
  health:['Excellent','Good','Average','Poor'],
  smoker:['Non-smoker','Smoker','Ex-smoker (2+ years)'],
  employment:['Employed','Self-employed','Company director','Contractor','Retired','Semi-retired','Homemaker','Unemployed','Student'],
  country:['United Kingdom','Spain','France','Portugal','Cyprus','Malta','Gibraltar','Ireland','Italy','Germany',
    'Netherlands','Belgium','Switzerland','Sweden','Norway','Denmark','United States','Canada','Australia',
    'New Zealand','South Africa','United Arab Emirates','Qatar','Saudi Arabia','Singapore','Hong Kong','Thailand','Other'],
  nationality:['British','Irish','American','Spanish','French','Portuguese','German','Dutch','Italian','Swedish',
    'Swiss','Australian','Canadian','South African','New Zealander','Dual nationality','Other'],
  yn:['Yes','No'], ynna:['Yes','No','Not applicable'],
  owner:['Applicant 1','Applicant 2','Joint'],
  ownerSingle:['Applicant 1','Applicant 2'],
  accountType:['Current account','Deposit / savings','Notice account','Fixed-term deposit','NS&I','Premium Bonds',
    'Offshore deposit','Multi-currency / FX account'],
  investType:['ISA','GIA','Onshore bond','Offshore bond','Unit trust / OEIC','Investment trust','Direct equities',
    'Managed portfolio (DFM)','Structured product','VCT / EIS','Brokerage (US)','Other'],
  pensionType:['Personal pension','SIPP','Workplace pension (DC)','Group personal pension','QROPS','QNUPS','SSAS',
    'Section 32 / buy-out','AVC','Drawdown arrangement','Annuity in payment','401(k)','IRA','Roth IRA','Other'],
  dbStatus:['Deferred','In payment','Active (still accruing)'],
  propertyType:['Main residence','Buy-to-let','Holiday property','Commercial','Land','Second home'],
  mortgageType:['Repayment','Interest only','Part & part','Offset','No mortgage'],
  loanType:['Personal loan','Car finance / HP','Student loan','Business loan','Bridging loan','Family loan','Other'],
  protectionType:['Life assurance','Life & critical illness','Critical illness only','Income protection',
    'Family income benefit','Accidental death','Whole of life','Business protection','Key person'],
  relationship:['Spouse','Civil partner','Partner','Son','Daughter','Mother','Father','Brother','Sister',
    'Grandchild','Trust','Charity','Other'],
  dependent:['Dependent','Non-dependent'],
  capacity:['Very low','Low','Medium','High','Very high'],
  experience:['None','Limited (under 3 years)','Moderate (3–10 years)','Extensive (10+ years)','Professional'],
  horizon:['Under 3 years','3–5 years','5–10 years','10–15 years','15+ years'],
  objective:['Capital preservation','Income','Income & growth','Balanced growth','Capital growth','Aggressive growth'],
  vulnType:['None identified','Health','Life event','Resilience','Capability'],
  sow:['Employment income','Property sale','Inheritance','Pension / transfer','Business sale or dividends',
    'Investment growth','Compensation','Competition win','Gift','Maturing policy','Sale of company interest','Other'],
  clientCat:['Retail client','Professional client (elective)','Professional client (per se)','Execution only'],
  method:['Face to face','Video call','Telephone','Email / correspondence'],
  leadSource:['Existing client referral','Professional introducer','Website enquiry','Webinar','Seminar',
    'Social media','Employer scheme','Repeat business','Other'],
  comms:['Email','Telephone','Video call','Post'],
  frequency:['Monthly','Quarterly','Half-yearly','Annually','One-off'],
  esgImportance:['Not important','Slightly important','Moderately important','Very important','Essential'],
  crystallised:['Uncrystallised','Crystallised','Partially crystallised'],
  /* --- the MADS Reco tab's own drop-downs, so admin gets what it expects --- */
  ynu:['Yes','No','Not known'],
  dcReco:['Transfer','Partial transfer','Retain','Not yet decided'],
  busType:['UK Pension Transfer','International Pension (QROPS)','Lump Sum Investment','Regular Contribution',
    'Top Up','Change of Adviser','GIA','ISA','Trustee Investment','Withdrawal','Other'],
  recoType:['New business','Additional investment / top up','Switch','Change of adviser','Withdrawal',
    'Regular contribution','Rebalance'],
  feeComm:['Fee','Commission'],
  pclsTiming:['Before the initial charge is taken','After the initial charge is taken','Not applicable'],
  withdrawFreq:['Annually','Semi-annually','Quarterly','Monthly','One-off']
};
/* Blacktower attitude-to-risk scale, as used in the network's Reasons Why Letter. */
const ATR_BANDS=[
  {name:'Secure',lo:0,hi:11},{name:'Cautious',lo:12,hi:19},{name:'Balanced',lo:20,hi:28},
  {name:'Growth',lo:29,hi:35},{name:'Speculative',lo:36,hi:40}
];
function atrBand(score){ if(score==null||score==='')return null;
  const s=Number(score); return ATR_BANDS.find(b=>s>=b.lo&&s<=b.hi)||ATR_BANDS[ATR_BANDS.length-1]; }

/* =========================== FACT FIND SCHEMA ============================
   Field groups mirror the planning workbook. `per:'applicant'` sections are
   captured separately for Applicant 1 and 2; `rows:` sections are repeating
   tables. `req:1` counts toward completion.
   ======================================================================= */
function f(id,label,type,o){ return Object.assign({id,label,type:type||'text'},o||{}); }
const SECTIONS=[
{ id:'meta', name:'Fact Find details', icon:'file', group:'Client',
  desc:'Who this is for, when it was taken and the currency everything is reported in.',
  fields:[
    f('ffDate','Date of Fact Find','date',{req:1}),
    f('ffCurrency','Reporting currency','select',{list:'currency',req:1,def:'GBP'}),
    f('adviser','Adviser','text',{req:1}),
    f('adviserEmail','Adviser email','email'),
    f('reviewType','Type','select',{list:['New client','Annual review','Ad-hoc update','Change of adviser']}),
    f('introducer','Introducer / lead source','select',{list:'leadSource'}),
    f('introducerDetail','Lead source detail','text'),
    f('notes','General notes','textarea',{full:1})
  ]},
{ id:'personal', name:'Personal details', icon:'user', group:'Client', per:'applicant',
  desc:'Captured separately for each applicant.',
  fields:[
    f('title','Title','select',{list:'title',req:1}),
    f('firstName','First name','text',{req:1}),
    f('middleName','Middle name(s)','text'),
    f('surname','Surname','text',{req:1}),
    f('previousNames','Previous names','text',{hint:'Several ceding schemes ask for this.'}),
    f('dob','Date of birth','date',{req:1}),
    f('gender','Gender','select',{list:'gender'}),
    f('marital','Marital status','select',{list:'marital',req:1}),
    f('nationality','Nationality','select',{list:'nationality',req:1}),
    f('birthCountry','Country of birth','select',{list:'country',req:1}),
    f('mobile','Mobile','tel',{req:1}),
    f('email','Email','email',{req:1}),
    f('comms','Preferred contact','select',{list:'comms'}),
    f('residence','Country of residence','select',{list:'country',req:1}),
    f('taxResidence','Country of tax residence','select',{list:'country',req:1}),
    f('taxResidentSince','Tax resident since (year)','number'),
    f('leftUK','Date left the UK (if applicable)','date'),
    f('ukCitizen','UK citizen','select',{list:'yn'}),
    f('nino','UK National Insurance number','text'),
    /* Not required: someone moving to a new country often has not been issued
       one yet, and a form that will not let them past is worse than a gap. */
    f('tin','Tax identification number','text',
      {hint:'If you have not been given one yet, leave this blank and tell your adviser.'}),
    f('returnUK','Intends to return to the UK','select',{list:'ynna'}),
    f('health','State of health','select',{list:'health',req:1}),
    f('healthNotes','Health notes','textarea',{full:1}),
    f('smoker','Smoker','select',{list:'smoker',req:1})
  ]},
{ id:'addresses', name:'Address history', icon:'home', group:'Client', rows:1,
  desc:'Applications commonly need three years of history.',
  cols:[ f('owner','Applies to','select',{list:['Applicant 1','Applicant 2','Both'],w:120}),
    f('line1','Address','text',{req:1,w:220}), f('city','Town / city','text',{w:130}),
    f('postcode','Postcode','text',{w:100}), f('country','Country','select',{list:'country',w:140}),
    f('from','From','date',{w:130}), f('to','To','date',{w:130}) ]},
{ id:'dependants', name:'Family & dependants', icon:'users', group:'Client', rows:1,
  cols:[ f('name','Full name','text',{req:1,w:180}), f('dob','Date of birth','date',{w:140}),
    f('relationship','Relationship','select',{list:'relationship',w:130}),
    f('dependent','Dependency','select',{list:'dependent',w:130}),
    f('notes','Notes','text',{w:200}) ]},
{ id:'employment', name:'Employment & income', icon:'brief', group:'Client', per:'applicant',
  fields:[
    f('status','Employment status','select',{list:'employment',req:1}),
    f('occupation','Occupation / job title','text',{req:1}),
    f('employer','Employer','text'),
    f('employerAddress','Employer address','textarea',{full:1}),
    f('industry','Industry','text'),
    f('since','Employed since','date'),
    f('salaryCcy','Salary currency','select',{list:'currency',def:'GBP'}),
    f('salary','Gross annual salary','number',{req:1}),
    f('bonus','Gross annual bonus','number'),
    f('prevOccupation','Previous occupation (if retired)','text'),
    f('retiredDate','Date retired','date'),
    f('changes','Any changes expected','textarea',{full:1})
  ]},
{ id:'journey', name:'Objectives & priorities', icon:'route', group:'Planning',
  desc:'The client’s own words matter here — keep them separate from your summary.',
  fields:[
    f('priorities','What are your financial priorities?','textarea',{req:1,full:1,own:1}),
    f('motivation','Biggest financial motivation right now','textarea',{full:1,own:1}),
    f('plan05','0–5 year plan','textarea',{full:1,own:1}),
    f('plan510','5–10 year plan','textarea',{full:1,own:1}),
    f('plan10','10+ year plan','textarea',{full:1,own:1}),
    f('adviserSummary','Adviser summary of objectives','textarea',{full:1}),
    f('achievable','Is the stated plan achievable?','select',{list:'ynna'})
  ]},
{ id:'retirement', name:'Retirement', icon:'sun', group:'Planning', per:'applicant',
  fields:[
    f('retireCountry','Where will you retire?','select',{list:'country',req:1}),
    f('retireAge','Intended retirement age','number',{req:1}),
    f('incomeCcy','Desired income currency','select',{list:'currency',def:'GBP'}),
    f('desiredIncome','Desired net retirement income (annual)','number',{req:1}),
    f('covers','Income covers','select',{list:['Individual','Joint / household']}),
    f('laterLife','Later-life spending (from 80)','number'),
    f('currentIncome','Current retirement income (if retired)','number'),
    f('care','Long-term care thoughts','textarea',{full:1}),
    f('notes','Additional retirement information','textarea',{full:1})
  ]},
{ id:'estate', name:'Estate planning', icon:'shield', group:'Planning', per:'applicant',
  fields:[
    /* Three plain questions. Everything else is a follow-up that only appears
       once the answer calls for it (`only:`) — asking someone with no will
       which country it was made in is what made this screen a maze. The
       inheritance-tax judgements are ours to make, not the client's. */
    f('will','Do you have a will?','select',{list:'yn',req:1}),
    f('willCountry','Which country was it made in?','select',{list:'country',only:{f:'will',is:['Yes']}}),
    f('willCurrent','Is it still up to date?','select',{list:'ynna',only:{f:'will',is:['Yes']}}),
    f('willProvision','In a sentence, who does it leave things to?','textarea',{full:1,
      only:{f:'will',is:['Yes']},
      hint:'For example: “Everything to my wife, then split equally between our two children.”'}),
    f('poa','Has anyone been given power of attorney for you?','select',{list:'yn',req:1,
      hint:'Someone appointed to make decisions for you if you could not make them yourself.'}),
    f('poaWho','Who is it?','text',{only:{f:'poa',is:['Yes']}}),
    f('poaCountries','In which country or countries?','text',{only:{f:'poa',is:['Yes']}}),
    f('inheritance','Are you expecting to inherit anything?','select',{list:'yn',req:1}),
    f('inheritanceWhen','Roughly when?','text',{only:{f:'inheritance',is:['Yes']},
      hint:'A rough answer is fine — “in the next few years”.'}),
    f('inheritanceCcy','Currency','select',{list:'currency',def:'GBP',only:{f:'inheritance',is:['Yes']}}),
    f('inheritanceAmount','Roughly how much?','number',{only:{f:'inheritance',is:['Yes']}}),
    f('ihtUK','UK IHT liability','select',{list:'ynna',adviser:1}),
    f('ihtLocal','IHT liability where resident','select',{list:'ynna',adviser:1})
  ]},
{ id:'properties', name:'Property', icon:'build', group:'Assets', rows:1,
  desc:'Every property, in the currency it is actually held in.',
  cols:[ f('owner','Owner','select',{list:'owner',w:120}), f('type','Type','select',{list:'propertyType',w:140}),
    f('location','Location','text',{req:1,w:180}), f('ccy','Currency','select',{list:'currency',w:100}),
    f('value','Current value','number',{req:1,w:130}), f('purchased','Year bought','number',{w:110}),
    f('purchasePrice','Purchase price','number',{w:130}), f('mortgage','Mortgage outstanding','number',{w:140}),
    f('mortgageType','Mortgage type','select',{list:'mortgageType',w:130}),
    f('rate','Rate (%)','number',{w:90}), f('term','Term left (yrs)','number',{w:110}),
    /* The client gives their mortgage and loan costs once, as yearly figures,
       on the spending screen. Asking again per property is the duplication
       the advisers flagged, so it stays here for us and off their form. */
    f('monthly','Monthly payment','number',{w:130,adviser:1}),
    f('rental','Monthly rent received','number',{w:150}),
    f('notes','Notes','text',{w:200}) ]},
{ id:'cash', name:'Cash', icon:'wallet', group:'Assets', rows:1,
  cols:[ f('owner','Owner','select',{list:'owner',w:120}), f('bank','Bank','text',{req:1,w:170}),
    f('type','Account type','select',{list:'accountType',w:160}), f('ccy','Currency','select',{list:'currency',w:100}),
    f('amount','Amount','number',{req:1,w:130}), f('rate','Interest rate (%)','number',{w:120}),
    f('location','Held in','select',{list:'country',w:150}), f('earmarked','Earmarked for','text',{w:170}) ]},
{ id:'investments', name:'Investments', icon:'chart', group:'Assets', rows:1,
  cols:[ f('owner','Owner','select',{list:'owner',w:120}), f('provider','Provider','text',{req:1,w:170}),
    f('type','Type','select',{list:'investType',w:150}), f('policyNo','Policy number','text',{w:150}),
    f('location','Held in (country)','select',{list:'country',w:150}),
    f('ccy','Currency','select',{list:'currency',w:100}), f('value','Current value','number',{req:1,w:130}),
    f('valuedAt','Valued on','date',{w:130}), f('contribution','Annual contribution','number',{w:150}),
    f('ocf','Fund OCF (%)','number',{w:110}), f('adviserFee','Adviser fee (%)','number',{w:120}),
    f('notes','Notes','text',{w:180}) ]},
{ id:'dcPensions', name:'DC pensions, SIPP & QROPS', icon:'pig', group:'Assets', rows:1,
  /* Everything here except the owner, the provider, the policy number, the
     currency and the value comes back from the provider in reply to the letter
     of authority — so `adviser:1` keeps it off the client's form. We still need
     the provider and the policy number from them, because that is what the LOA
     is addressed with. */
  cols:[ f('owner','Owner','select',{list:'ownerSingle',w:120}), f('name','Scheme / provider','text',{req:1,w:190}),
    f('type','Type','select',{list:'pensionType',w:150,adviser:1}),
    f('policyNo','Policy number','text',{w:150}),
    f('ccy','Currency','select',{list:'currency',w:100}), f('value','Current value','number',{req:1,w:130}),
    f('valuedAt','Valued on','date',{w:130,adviser:1}),
    f('tvq','Transfer value','number',{w:130,adviser:1}),
    f('tvqDate','Date of TVQ','date',{w:130,adviser:1}),
    f('employerContrib','Employer contribution (pa)','number',{w:170,adviser:1}),
    f('personalContrib','Personal contribution (pa)','number',{w:170,adviser:1}),
    f('crystallised','Crystallised status','select',{list:'crystallised',w:150,adviser:1}),
    f('nmpa','Access age','number',{w:100,adviser:1}),
    f('amc','Annual charges (%)','number',{w:130,adviser:1}),
    f('exitFee','Exit fee / bonus','text',{w:140,adviser:1}),
    f('guarantees','Guarantees or bonuses','text',{w:170,adviser:1}),
    f('notes','Notes','text',{w:180,adviser:1}),
    /* --- ceding-scheme answers the MADS Reco tab asks for, one column per plan.
       Filled from the provider's reply to the LOA — by hand, or by reading the
       document in the Recommendation section. --- */
    f('dcReco','Recommendation','select',{list:'dcReco',w:150,reco:1}),
    f('partialAmount','If partial, amount transferring','number',{w:190,reco:1}),
    f('fundSelection','Fund selection','textarea',{w:220,reco:1}),
    f('performance','What has the performance been?','textarea',{w:220,reco:1}),
    f('bidOffer','Bid/offer spread (%)','number',{w:150,reco:1}),
    f('retOptionsUK','Retirement options in the UK','textarea',{w:230,reco:1}),
    f('retOptionsNonUK','Retirement options as a non-UK resident','textarea',{w:230,reco:1}),
    f('deathUK','Death benefits as a UK resident','textarea',{w:230,reco:1}),
    f('deathNonUK','Death benefits as a non-UK resident','textarea',{w:230,reco:1}),
    f('crystallisedPct','If part crystallised, % crystallised','number',{w:190,reco:1}),
    f('adviserFeePct','UK only — annual adviser fee on the plan (%)','number',{w:230,reco:1}),
    f('mpaa','MPAA triggered?','select',{list:'ynu',w:140,reco:1}) ]},
{ id:'dbPensions', name:'Defined benefit pensions', icon:'pig', group:'Assets', rows:1,
  cols:[ f('owner','Owner','select',{list:'ownerSingle',w:120}), f('name','Scheme','text',{req:1,w:200}),
    f('status','Status','select',{list:'dbStatus',w:130}), f('nra','Normal retirement age','number',{w:150}),
    f('ccy','Currency','select',{list:'currency',w:100}), f('income','Income at NRA (pa)','number',{req:1,w:150}),
    /* The CETV and what surrounds it come from the scheme, not the member. */
    f('cetv','CETV','number',{w:130,adviser:1}), f('cetvDate','CETV dated','date',{w:130,adviser:1}),
    f('cetvExpiry','CETV expires','date',{w:130,adviser:1}),
    f('transferable','Transferable','select',{list:'ynna',w:120,adviser:1}),
    f('gmp','GMP','number',{w:110,adviser:1}), f('spouse','Spouse benefit','text',{w:140,adviser:1}),
    f('notes','Notes','text',{w:180}) ]},
{ id:'statePensions', name:'State pensions', icon:'globe', group:'Assets', rows:1,
  cols:[ f('owner','Owner','select',{list:'ownerSingle',w:120}), f('country','Country','select',{list:'country',req:1,w:160}),
    f('years','Qualifying years','number',{w:130}), f('spa','State pension age','number',{req:1,w:140}),
    f('inPayment','In payment','select',{list:'yn',w:110}), f('ccy','Currency','select',{list:'currency',w:100}),
    f('amount','Estimated annual amount','number',{req:1,w:170}), f('notes','Notes','text',{w:180}) ]},
{ id:'liabilities', name:'Loans & credit cards', icon:'scale', group:'Assets', rows:1,
  cols:[ f('owner','Owner','select',{list:'owner',w:120}), f('type','Type','select',{list:'loanType',w:140}),
    f('lender','Lender','text',{req:1,w:170}), f('ccy','Currency','select',{list:'currency',w:100}),
    f('balance','Balance','number',{req:1,w:130}),
    f('monthly','Monthly payment','number',{w:140,adviser:1}),   /* asked once, on spending */
    f('rate','Rate (%)','number',{w:100}), f('term','Term left (yrs)','number',{w:120}),
    f('notes','Notes','text',{w:180}) ]},
{ id:'protection', name:'Protection & healthcare', icon:'umbr', group:'Assets', rows:1,
  cols:[ f('owner','Owner','select',{list:'owner',w:120}), f('provider','Provider','text',{req:1,w:170}),
    f('type','Type','select',{list:'protectionType',w:170}), f('lifeAssured','Life assured','text',{w:150}),
    f('ccy','Currency','select',{list:'currency',w:100}), f('sumAssured','Sum assured','number',{w:130}),
    f('premium','Monthly premium','number',{req:1,w:140}), f('term','Term (yrs)','number',{w:100}),
    f('ends','End date','date',{w:130}), f('inTrust','In trust','select',{list:'ynna',w:110}),
    f('notes','Notes','text',{w:180}) ]},
{ id:'incomeExp', name:'Expenditure', icon:'swap', group:'Assets',
  desc:'Annual figures in the reporting currency — the same four numbers the MADS asks for.',
  fields:[
    f('expTotal','Total regular living expenditure (per year)','number',{req:1,
      hint:'Everything day-to-day — food, utilities, transport, holidays — excluding the items below.'}),
    f('expMortgage','Mortgage or rent payments (per year)','number'),
    f('expLoans','Loan repayments (per year)','number'),
    f('expCards','Credit card payments (per year)','number'),
    f('savings','Regular savings (per year, excluding pensions)','number'),
    f('notes','Notes on income and expenditure','textarea',{full:1})
  ]},
{ id:'risk', name:'Attitude to risk', icon:'sliders', group:'Suitability', per:'applicant',
  desc:'Scored on the network’s 0–40 scale. Capacity for loss is assessed separately.',
  fields:[
    f('atrScore','ATR questionnaire score (0–40)','number',{req:1,hint:'Secure 0–11 · Cautious 12–19 · Balanced 20–28 · Growth 29–35 · Speculative 36–40'}),
    f('atrChosen','Chosen risk category','select',{list:['Secure','Cautious','Balanced','Growth','Speculative'],req:1}),
    f('atrOverride','Reason if different from the score','textarea',{full:1}),
    f('capacity','Capacity for loss','select',{list:'capacity',req:1}),
    f('loss1y','Acceptable loss over 1 year (%)','number'),
    f('loss5y','Acceptable loss per year over 5 years (%)','number'),
    f('experience','Investment experience','select',{list:'experience',req:1}),
    f('knowledge','Investment knowledge','select',{list:'experience',req:1}),
    f('objective','Investment objective','select',{list:'objective',req:1}),
    f('horizon','Time horizon','select',{list:'horizon',req:1}),
    f('withdrawIncome','Intending to withdraw income','select',{list:'yn',req:1}),
    f('liquidity','Liquidity requirements','textarea',{full:1}),
    f('exclusions','Investments to exclude','textarea',{full:1}),
    f('cashMonths','Months of expenditure held in cash','number')
  ]},
{ id:'esg', name:'Sustainability & ESG', icon:'leaf', group:'Suitability',
  desc:'Required where the client is in an EU or Cyprus jurisdiction.',
  fields:[
    f('consider','Should sustainability be considered?','select',{list:'yn',req:1}),
    f('importance','How important?','select',{list:'esgImportance'}),
    f('discussion','Summary of the discussion','textarea',{full:1,own:1}),
    f('minimum','Minimum sustainable proportion (%)','number'),
    f('taxonomy','EU Taxonomy alignment (%)','number'),
    f('pai','Principal Adverse Impact preferences','textarea',{full:1}),
    f('excluded','Excluded sectors','textarea',{full:1}),
    f('noMatch','If no product meets every preference','textarea',{full:1})
  ]},
{ id:'kyc', name:'KYC & due diligence', icon:'key', group:'Compliance', per:'applicant',
  fields:[
    f('category','Client categorisation','select',{list:'clientCat',req:1}),
    f('executionOnly','Execution only','select',{list:'yn'}),
    f('pep','Politically exposed person','select',{list:'yn',req:1}),
    f('pepDetail','If yes, details','textarea',{full:1}),
    f('method','How was the business conducted','select',{list:'method',req:1}),
    f('idHeld','Proof of identity held','select',{list:'yn',req:1}),
    f('idExpiry','ID expiry date','date'),
    f('addressHeld','Proof of address held','select',{list:'yn',req:1}),
    f('addressDated','Proof of address dated','date'),
    f('sow','Source of wealth','select',{list:'sow',req:1}),
    f('sowDetail','How wealth was accumulated','textarea',{full:1,own:1}),
    f('sof','Source of funds for this investment','select',{list:'sow',req:1}),
    f('sofDetail','Where these specific funds came from','textarea',{full:1,own:1}),
    f('sowYears','Years accumulated','number'),
    f('sowInstitution','Institution where held','text')
  ]},
{ id:'vulnerability', name:'Vulnerability', icon:'heart', group:'Compliance', per:'applicant',
  desc:'A structured record, not a yes/no box. Treat as sensitive.',
  fields:[
    f('identified','Vulnerability identified','select',{list:'yn',req:1}),
    f('type','Type','select',{list:'vulnType'}),
    f('date','Date identified','date'),
    f('permanence','Temporary or permanent','select',{list:['Temporary','Permanent','Unknown']}),
    f('description','Nature of the vulnerability','textarea',{full:1}),
    f('adjustments','Adjustments we will make','textarea',{full:1}),
    f('review','Review date','date')
  ]},
{ id:'beneficiaries', name:'Beneficiaries', icon:'users', group:'Compliance', rows:1,
  desc:'Percentages should total 100%.',
  cols:[ f('name','Full name (as on passport)','text',{req:1,w:200}),
    f('relationship','Relationship','select',{list:'relationship',w:140}), f('dob','Date of birth','date',{w:140}),
    f('pct','Benefit (%)','number',{req:1,w:110}), f('nationality','Nationality','select',{list:'nationality',w:140}),
    f('email','Email','email',{w:180}), f('phone','Telephone','tel',{w:150}),
    f('address','Address','text',{w:220}) ]},
{ id:'bank', name:'Bank details', icon:'wallet', group:'Compliance', rows:1,
  desc:'Held for applications. Treat as sensitive.',
  cols:[ f('owner','Owner','select',{list:'owner',w:120}), f('bank','Bank','text',{req:1,w:170}),
    f('accountName','Account name','text',{req:1,w:170}), f('ccy','Currency','select',{list:'currency',w:100}),
    f('iban','IBAN','text',{w:200}), f('bic','BIC / SWIFT','text',{w:140}),
    f('sortCode','Sort code','text',{w:110}), f('accountNo','Account number','text',{w:140}),
    f('heldSince','Held since','text',{w:130}), f('proof','Proof held','select',{list:'yn',w:110}) ]},
{ id:'recommendation', name:'Recommendation', icon:'check', group:'Advice',
  desc:'Everything the MADS Reco sheet asks for, so admin can process the application from this alone. Blocks open themselves when they apply; the rest stay folded away.',
  fields:[
    f('adviceType','Type of advice','select',{req:1,
      list:['Lump sum only','UK pension transfer (DB & DC)','Change of adviser (COA)','GIA','ISA','Other']}),
    f('busType','Type of business','select',{list:'busType',
      hint:'Reco sheet, “Type of Business” — what admin files it under.'}),
    f('recoType','Type of recommendation','select',{list:'recoType'}),
    f('provider','Provider / platform','text',{req:1}),
    f('product','Product','text',{req:1,hint:'e.g. International SIPP — Novia Global'}),
    f('ccy','Currency','select',{list:'currency',def:'GBP'}),
    f('amount','Investment amount','number',{req:1,hint:'Reco “PREMIUM INVESTED”.'}),
    f('source','Where the money is coming from','text',{hint:'e.g. transfer of the existing QROPS'}),
    f('discounted','Providers considered and discounted','textarea',{full:1,
      hint:'Who else you looked at and why they were set aside — the network expects this.'}),

    /* ------------------------- platform & charges ------------------------- */
    f('platformCcy','Currency of the platform','select',{list:'currency',sub:'Platform & charges',
      subHint:'Reco rows 48–56. These drive the charge comparison the MADS builds.'}),
    f('initial','Initial adviser fee (%)','number'),
    f('ongoing','Ongoing adviser fee (% per year)','number'),
    f('platformFee','Platform annual fee (%)','number'),
    f('platformInitial','Platform initial fee (%)','number'),
    f('platformQuarterly','Platform quarterly admin fee','number',{hint:'Number only — no currency symbol.'}),
    f('feeComm','Fee or commission?','select',{list:'feeComm'}),
    f('feeSchedule','Fee schedule chosen','text'),

    /* ---------------------------- investment ------------------------------ */
    f('strategy','Investment recommendation / portfolio','text',{sub:'Investment',
      subHint:'From FE Analytics. If it is bespoke, the purchase portfolio still goes on the Questionnaire tab.'}),
    f('investCcy','Currency of the investment recommendation','select',{list:'currency'}),
    f('ocf','Fund OCF / expense ratio (%)','number'),
    f('dfmFee','DFM annual fee (%)','number',{hint:'Leave blank if there is no discretionary manager.'}),
    f('fiveYearReturn','5-year cumulative return (%)','number'),

    /* ------------------------ regular contributions ----------------------- */
    f('regular','Regular contribution amount','number',{sub:'Regular contributions',
      subHint:'Leave the block empty if there is no regular premium.'}),
    f('regCcy','Currency of the regular contribution','select',{list:'currency'}),
    f('regFrequency','How often would this be paid?','select',{list:'withdrawFreq'}),
    f('regInitial','Initial adviser fee on the regular premium (%)','number'),
    f('regStrategy','Investment recommendation for the regular premium','text'),
    f('regInvestCcy','Currency of that investment recommendation','select',{list:'currency'}),

    /* ---------------------------- withdrawals ----------------------------- */
    f('withdrawing','Is the client taking a withdrawal?','select',{list:'yn',sub:'Withdrawals',
      subHint:'Reco rows 65–70, plus the two Apps Out questions about taking income and PCLS immediately.'}),
    f('withdrawAmount','Amount of withdrawal & currency','text',{hint:'e.g. GBP 10,000'}),
    f('withdrawFrequency','Frequency','select',{list:'withdrawFreq'}),
    f('pclsTiming','Take PCLS before or after the initial charge?','select',{list:'pclsTiming'}),
    f('incomeImmediate','Is income to be taken immediately?','select',{list:'yn'}),
    f('pclsImmediate','Is PCLS to be taken immediately?','select',{list:'yn'}),
    f('withdrawReason','What is the reason for the withdrawal?','textarea',{full:1,own:1,
      hint:'In the client’s words — e.g. “I am buying a house”.'}),

    /* ------------------------------ top up -------------------------------- */
    f('topupPolicyNo','Existing policy number','text',{sub:'Top up business only'}),
    f('topupCcy','Currency of the policy','select',{list:'currency'}),
    f('topupAmount','Policy amount','number'),

    /* ----------------------------- trustee -------------------------------- */
    f('trustName','Trust name','text',{sub:'UK pension & trustee business only'}),
    f('trusteeCcy','Currency of the trustee','select',{list:'currency'}),
    f('trusteeInitial','Trustee initial charge','number'),
    f('trusteeAnnual','Trustee annual charge','number',{hint:'Number only.'}),

    /* ------------------------- DB business only --------------------------- */
    f('dbAiaWriter','AIA report writer chosen','text',{sub:'DB pension business only',
      subHint:'Only needed where a defined benefit transfer is involved.'}),
    f('dbAiaCcy','Currency of the AIA fee','select',{list:'currency'}),
    f('dbAiaCost','AIA report cost','number'),
    f('dbAiaPaid','Has the client paid the AIA fee to the provider?','select',{list:'yn'}),
    f('dbAiaInvoice','Where is the AIA invoice for this fee?','text'),
    /* --- the four blocks the Apps Out sheet asks for, verbatim --- */
    f('lumpSumFactors','In the client’s own words, what would be the most important factor(s) for investing this money?','textarea',
      {full:1,own:1,sub:'Summary of advice — the Apps Out narrative',open:1,
       subHint:'These four boxes go straight into the MADS Apps Out sheet and into the suitability report. Build them from the Fact Find with the button below.',
       hint:'Also cover: alternative products in their country and why yours was chosen; any tax planning; why the risk profile differs from the product if it does; and why they are content to pay higher fees.'}),
    f('retirementOnTrack','Are their retirement goals achievable?','select',{list:['On track','Not on track']}),
    f('retirementNarrative','Retirement goals — the paragraph for the MADS','textarea',{full:1}),
    f('mainObjectives','Main objectives','textarea',{full:1,
      hint:'Keep only the points that are true for this client, and add your own.'}),
    f('ukNarrative','UK advice paragraph (UK business only)','textarea',{full:1,
      hint:'Retirement plans and where; who you recommended and who you discounted; when they retire and pre/post-retirement sustainability; which pots the income comes from.'}),
    f('reason','Anything else that belongs in the file','textarea',{full:1})
  ]},
];
const SECTION_GROUPS=['Client','Planning','Assets','Suitability','Compliance','Advice'];
function sectionById(id){ return SECTIONS.find(s=>s.id===id); }
function listFor(key){ if(key==='currency') return CURRENCIES; return L[key]||[]; }

/* =========================== PRIVACY NOTICE ===============================
   Every link that asks a client for personal data has to tell them who is
   asking, why, on what basis, who else sees it, how long it is kept and what
   they can do about it. That is Articles 13 and 14, and it has to be given
   AT THE POINT OF COLLECTION — not buried in a policy somewhere else.

   Everything here is built from the practice's own settings. Nothing is
   invented: where a firm has not filled something in, the notice says so
   plainly rather than printing a plausible-looking placeholder, because a
   privacy notice with a made-up retention period is worse than none.

   The wording is a starting point for a compliance officer to approve, not
   legal advice — the portal shows that caveat to the adviser, never to
   the client.
   ========================================================================= */
function dpSettings(settings){
  const d=(settings&&settings.dp)||{};
  return {
    controller:(d.controller||'').trim(),
    address:(d.address||'').trim(),
    email:(d.email||settings&&settings.adviserEmail||'').trim(),
    regulator:(d.regulator||'').trim(),
    icoNumber:(d.icoNumber||'').trim(),
    policyUrl:(d.policyUrl||'').trim(),
    retainYears:Number(d.retainYears)||0,
    joint:(d.joint||'').trim()
  };
}
/* What is still missing before a link should really go out. */
function dpGaps(settings){
  const d=dpSettings(settings), gaps=[];
  if(!d.controller) gaps.push('the legal name of the firm');
  if(!d.email) gaps.push('an email address for data protection questions');
  if(!d.retainYears) gaps.push('how long records are kept');
  if(!d.address) gaps.push('a postal address');
  return gaps;
}
/* `kind` is 'factfind' or 'kyc' — they collect different things and rest
   on different grounds, so the notice differs. */
function privacyNotice(settings,kind){
  const d=dpSettings(settings);
  const who=d.controller||'The firm you are working with';
  const keep=d.retainYears?(d.retainYears+' years after our relationship ends')
    :'the period set out in our privacy policy';
  const S=[];
  S.push({h:'Who is asking',
    p:who+(d.address?', '+d.address:'')+' is responsible for the information you give here'
      +(d.joint?', together with '+d.joint:'')+'.'
      +(d.icoNumber?' Registered with '+(d.regulator||'the supervisory authority')+' under '+d.icoNumber+'.':'')});
  if(kind==='kyc'){
    S.push({h:'What we are collecting',
      p:'Proof of your identity and address, your bank details, your tax number, and details of the people you '
       +'want to benefit from your policies \u2014 including their names and contact details.'});
    S.push({h:'Why',
      p:'To confirm who you are and to submit applications on your behalf. We are required by anti-money-laundering '
       +'law to check the identity of everyone we advise, so this part is a legal obligation rather than a choice.'});
    S.push({h:'What allows us to use it',
      p:'Complying with our legal obligations under money-laundering regulations, and performing the agreement '
       +'between us. Where you give us details of another person, such as a beneficiary, please make sure they know.'});
  } else {
    S.push({h:'What we are collecting',
      p:'Your contact and family details, where you live and have lived, your work and income, what you own and '
       +'owe, your pensions and what you would like your retirement to look like. We also ask about your health '
       +'and whether you smoke.'});
    S.push({h:'Why',
      p:'To understand your circumstances well enough to give you suitable advice. Without it we cannot recommend '
       +'anything responsibly, and our regulator expects us to have it on file.'});
    S.push({h:'What allows us to use it',
      p:'Taking steps at your request before entering into an agreement, and our legitimate interest in advising '
       +'you properly. Health information is treated separately \u2014 we ask for your explicit consent below, and '
       +'you can say no and still complete the rest.'});
  }
  S.push({h:'Who else sees it',
    p:'Your adviser and the administrators who prepare your paperwork. Where you ask us to look into an existing '
     +'pension or policy, we pass what is needed to that provider so they will answer us. Our systems are hosted '
     +'by Cloudflare, who store the data on our behalf and do not use it for anything else. We do not sell your '
     +'information or use it for advertising.'});
  S.push({h:'Where it is held',
    p:'Your answers travel over an encrypted connection and are held in our secure system. Some of our providers '
     +'operate internationally, so information may be processed outside the country you live in, protected by '
     +'standard contractual safeguards.'});
  S.push({h:'How long we keep it',p:'We keep your records for '+keep+'.'});
  S.push({h:'Your rights',
    p:'You can ask for a copy of what we hold, have anything wrong corrected, ask us to delete it, ask us to '
     +'restrict or stop using it, and ask for it in a portable form. Where we rely on your consent you can '
     +'withdraw it at any time. Some information we must keep for a period even if you ask us to erase it, '
     +'because the law requires us to.'});
  S.push({h:'Questions or complaints',
    p:(d.email?('Write to us at '+d.email+'. '):'Speak to your adviser. ')
     +'If you are not happy with our answer you can complain to your data protection regulator'
     +(d.regulator?(' \u2014 '+d.regulator):'')+'.'
     +(d.policyUrl?(' Our full privacy policy is at '+d.policyUrl+'.'):'')});
  return S;
}
/* The consent wording, kept next to the notice so the two cannot drift. */
const DP_CONSENT={
  factfind:'I have read how my information will be used. I am giving these answers so that '
    +'my adviser can advise me, and I confirm they are accurate as far as I know.',
  health:'I agree that my adviser may use the information I have given about my health and '
    +'whether I smoke. I understand I can say no and still complete the rest of the form.',
  kyc:'I have read how my information will be used, and I confirm the documents and details '
    +'I am sending are my own and are genuine.'
};


/* ===========================================================================
   Shared between the server, the portal and the client form.
   Everything above this line is the schema (generated from the portal parts).
   ========================================================================= */
/* The sections a client is asked to fill in. Beneficiaries and bank details
   are deliberately absent: the advisers asked for them off the Fact Find. Both
   are better taken in conversation, and a bank account is not something to ask
   anyone to type into a link. Both stay in the portal, so the MADS still gets
   them. */
const CLIENT_SECTION_IDS=['personal','addresses','dependants','employment','retirement',
  'estate','properties','cash','investments','dcPensions','dbPensions','statePensions',
  'liabilities','protection','incomeExp'];
/* Fields marked `adviser:` come from the provider or from our own judgement —
   a transfer value, a CETV, an exit fee, an IHT position. On the client's form
   they are noise at best and unanswerable at worst. `reco:` is the same for the
   ceding-scheme questions the admin needs to make the application. */
function clientFields(list){ return (list||[]).filter(f=>!f.adviser&&!f.reco); }
const CLIENT_COPY={
  personal:{t:'About you',d:'The basics — who you are and how to reach you.'},
  addresses:{t:'Where you live',d:'Your current address, and anywhere else you have lived in the last three years.'},
  dependants:{t:'Family',d:'Children and anyone else who depends on you financially.'},
  employment:{t:'Work & income',d:'What you do and what you earn. Round figures are fine.'},
  retirement:{t:'Retirement',d:'When you would like to stop working, where, and on what income.'},
  estate:{t:'Wills & estate',d:'Three short questions: your will, power of attorney, and anything you expect to inherit.'},
  properties:{t:'Property',d:'Your home and any other property, in the currency it is valued in.'},
  cash:{t:'Bank & savings accounts',d:'Where your cash sits. Approximate balances are fine.'},
  investments:{t:'Investments',d:'ISAs, investment accounts, bonds — anything invested.'},
  dcPensions:{t:'Pensions',d:'Just the provider, the policy number and roughly what each pot is worth. We write to the providers for everything else, so do not worry about the detail.'},
  dbPensions:{t:'Final salary pensions',d:'Pensions that promise an income rather than a pot. Skip if you have none.'},
  statePensions:{t:'State pensions',d:'From any country where you have made contributions.'},
  liabilities:{t:'Loans & credit cards',d:'Anything you owe, other than mortgages (those were covered under Property).'},
  protection:{t:'Insurance',d:'Life cover, illness cover, income protection, private healthcare.'},
  incomeExp:{t:'Your spending',d:'A few yearly figures — close estimates are fine. This is the only place we ask about what you spend.'}
};
function emptyFor(s){ return s.rows?[]:(s.per?{a1:{},a2:{}}:{}); }
/* What the client's form is pre-filled with. It carries only what they are
   being asked about: a transfer value we obtained from the provider, an IHT
   position, our own workings — none of that should be sitting in a page served
   to whoever holds the link, even though no field on it would show them. */
function clientSubsetData(record){
  const d={};
  const keep=(obj,fields)=>{ const o={}; clientFields(fields).forEach(fd=>{
    if(obj&&obj[fd.id]!=null&&obj[fd.id]!=='') o[fd.id]=obj[fd.id]; }); return o; };
  CLIENT_SECTION_IDS.forEach(id=>{
    const s=sectionById(id), had=(record.data&&record.data[id])||emptyFor(s);
    if(s.rows) d[id]=(Array.isArray(had)?had:[]).map(r=>keep(r,s.cols));
    else if(s.per) d[id]={a1:keep(had.a1,s.fields),a2:keep(had.a2,s.fields)};
    else d[id]=keep(had,s.fields);
  });
  return d;
}
function recordName(record){
  const p=(record.data&&record.data.personal)||{}, a=p.a1||{}, b=p.a2||{};
  const n1=[a.firstName,a.surname].filter(Boolean).join(' ');
  const n2=[b.firstName,b.surname].filter(Boolean).join(' ');
  if(n1&&n2) return a.surname&&a.surname===b.surname? a.firstName+' & '+b.firstName+' '+a.surname : n1+' & '+n2;
  return n1||n2||record.name||'Unnamed client';
}
let _mid=0;
function mergeId(){ return 'r-'+Date.now().toString(36)+'-'+(++_mid); }
/* Pure merge of a client's submitted answers into their record. Non-empty
   answers win. Returns a human summary of what changed.

   Repeating tables are merged, never replaced. The client's form no longer
   carries the transfer value, the CETV, the exit fee or the ceding-scheme
   answers, so rebuilding a table from their reply would throw away everything
   the adviser and the admin had already put in. Entries are matched on their
   policy number or name and updated in place; anything the client did not
   mention is left alone, because it may be an entry only we know about. */
function mergeSubmission(record,data){
  const summary=[];
  record.data=record.data||{};
  const norm=v=>String(v==null?'':v).toLowerCase().replace(/[^a-z0-9]/g,'');
  CLIENT_SECTION_IDS.forEach(id=>{
    const inc=data&&data[id]; if(inc==null) return;
    const s=sectionById(id); if(!s) return;
    if(s.rows){
      if(Array.isArray(inc)&&inc.length){
        const cols=s.cols||[];
        const keyCol=['policyNo','name','lender','bank','provider','address','scheme']
          .find(k=>cols.some(x=>x.id===k)) || (cols.find(x=>x.req)||{}).id;
        const had=Array.isArray(record.data[id])?record.data[id].slice():[];
        const claimed={}, out=[];
        inc.forEach(r=>{
          let row=null;
          if(keyCol&&norm(r&&r[keyCol])){
            for(let i=0;i<had.length;i++){
              if(!claimed[i]&&norm(had[i][keyCol])===norm(r[keyCol])){ row=had[i]; claimed[i]=1; break; }
            }
          }
          if(!row) row={_id:mergeId()};
          clientFields(cols).forEach(fd=>{ const v=r&&r[fd.id];
            if(v!=null&&String(v).trim()!=='') row[fd.id]=String(v).slice(0,2000); });
          out.push(row);
        });
        let kept=0;
        had.forEach((e,i)=>{ if(!claimed[i]&&out.indexOf(e)<0){ out.push(e); kept++; } });
        record.data[id]=out;
        summary.push(s.name+': '+inc.length+' entr'+(inc.length===1?'y':'ies')
          +(kept?', '+kept+' of yours kept':''));
      }
      return;
    }
    let n=0;
    const into=(dst,src)=>{ if(!src||typeof src!=='object') return;
      clientFields(s.fields).forEach(fd=>{ const v=src[fd.id];
        if(v!=null&&String(v).trim()!==''&&String(v)!==String(dst[fd.id]||'')){ dst[fd.id]=String(v).slice(0,4000); n++; } }); };
    if(s.per==='applicant'){
      record.data[id]=record.data[id]||{a1:{},a2:{}};
      record.data[id].a1=record.data[id].a1||{}; record.data[id].a2=record.data[id].a2||{};
      into(record.data[id].a1,inc.a1); into(record.data[id].a2,inc.a2);
    } else { record.data[id]=record.data[id]||{}; into(record.data[id],inc); }
    if(n) summary.push(s.name+': '+n+' answer'+(n===1?'':'s'));
  });
  record.name=recordName(record);
  record.status='Fact Find returned';
  record.updated=new Date().toISOString();
  return summary;
}
const SJB_SHARED={CFG,SECTIONS,L,CURRENCIES,CCY_SYM,sectionById,listFor,
  CLIENT_SECTION_IDS,CLIENT_COPY,clientFields,clientSubsetData,recordName,mergeSubmission,emptyFor,
  dpSettings,dpGaps,privacyNotice,DP_CONSENT};
if(typeof module!=='undefined'&&module.exports) module.exports=SJB_SHARED;
else if(typeof globalThis!=='undefined') globalThis.SJB_SHARED=SJB_SHARED;
