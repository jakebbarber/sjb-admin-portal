/* Align the RWL templates with the BT Sales Process Manual (v9, July 2026)
   using the portal's own Word engine (tracked changes, merge-field safe).
   Rules are anchored on paragraphs each template actually has, so one rule
   set covers a family. Nothing is written that would drop a merge field: the
   engine refuses such a replace, and every output is re-counted afterwards.
   Usage: node align.cjs <templates dir> <work dir> <out dir> */
const fs=require('fs'),path=require('path'); const [IN,W,OUT]=process.argv.slice(2);
const fflate=require(path.join(__dirname,'..','node_modules','fflate'));
const R=require(path.join(__dirname,'..','..','sjb-portal','server','rwl_server.js'));
const AUTHOR='SJB Admin Portal – manual alignment';
const inv=JSON.parse(fs.readFileSync(path.join(W,'inventory.json'))).filter(r=>!/Old - SJB EU/.test(r.rel));
const SKIP={'COA RWLs/4. RWL - EU - Utmost COA Letter.docx':'a provider change-of-adviser letter, not an RWL; it also carries a real client name and policy number, which must come out of the template folder',
  'DB RWLs/RWL3/US - v4 - DNP RWL 3.docx':'a DB transfer declaration form and guidance note, not an RWL; the manual\'s RWL rules do not apply to it'};
const TAX_CAVEAT='Blacktower are not tax experts and due to the complexities of the tax system and your aims and objectives it is highly advisable that you seek an independent tax opinion. You are fully aware that Blacktower are not Tax Advisers and as such cannot be held responsible should the applicable tax authority raise a claim against you for any future taxes.';
const WILLS='You should consider whether you have a valid and up-to-date Will in place. A Will helps ensure that your estate is distributed in accordance with your wishes. If you do not have a Will, the distribution of your estate may be determined in accordance with the laws of the relevant jurisdiction. As Blacktower does not provide legal advice, you may wish to seek advice from a suitably qualified legal professional.';
const OVER80='[Include where the client is aged 80 or over, or where any vulnerability was identified:] I have suggested that you may wish to involve a trusted family member, friend or other independent person when considering the recommendations contained within this letter. Whether you choose to do so is entirely your decision. With your consent, and where a valid Power of Attorney is in place authorising that person to act on your behalf, I would be happy to discuss my recommendations with such a person. Alternatively, you may wish to share this letter and the accompanying documents with them. I will contact you on [DATE] to answer any questions you may have. In the meantime, if you are comfortable with the recommendations and wish to proceed, please contact me or follow the instructions outlined in this letter.';
const WARN=[
  ['circumstances','My recommendations are based on your circumstances, objectives, risk profile, capacity for loss and investment time horizon at the time this advice is given. They may no longer be suitable if any of these change in the future.',/at the time (this )?advice is given|may (not|no longer) be suitable if/i],
  ['taxcirc','Tax treatment depends on your individual circumstances and may change in the future.',/tax treatment depends on (your )?individual circumstances/i],
  ['income','Income from investments is not guaranteed unless specifically stated by the product provider and may fluctuate.',/income from investments is not guaranteed/i],
  ['esg','Where ESG or sustainability characteristics are referred to, they should not be regarded as a guarantee of investment performance.',/ESG[^.]{0,80}guarantee/i],
  ['costs','Costs and charges will have an impact on investment returns over time.',/charges will (reduce returns|have an impact)|costs and charges will have an impact/i],
];

/* ------------------------------------------------------------------ helpers */
const paraList=xml=>R.docxParas(xml);
function inTableMap(xml){ /* paragraph start offset -> inside a table? */
  const marks=[]; const re=/<w:tbl>|<\/w:tbl>/g; let m; while((m=re.exec(xml))) marks.push([m.index,m[0]==='<w:tbl>'?1:-1]);
  return start=>{ let d=0; for(const [i,v] of marks){ if(i>start) break; d+=v; } return d>0; };
}
function fieldSet(xml){ return new Set(R.docxParas(xml).flatMap(p=>[...p.text.matchAll(/«([^»]+)»/g)].map(x=>x[1]))); }
const F=(fields,name,fallback)=>fields.has(name)?'«'+name+'»':fallback;
const anchorText=p=>p.text.trim().slice(0,60);
function makeCtx(xml){
  const P=paraList(xml); const inT=inTableMap(xml); const fields=fieldSet(xml); const edits=[]; const notes=[]; const used=new Set(); const replaced=new Map(); const rules=[];
  const find=(re,from)=>P.find(p=>p.i>=(from||0)&&p.text.trim()&&re.test(p.text.trim()));
  const findLast=re=>[...P].reverse().find(p=>p.text.trim()&&re.test(p.text.trim()));
  const bodyAfter=p=>{ let q=p; while(q&&inT(q.start)){ q=P[q.i+1]; } return q; };   /* never insert inside a table cell */
  const insertAfter=(p,lead,text,why)=>{ if(!p) return false; const q=bodyAfter(p); if(!q||used.has('i'+q.i)) return false; used.add('i'+q.i);
    edits.push({op:'insert_after',para:q.i,anchor:replaced.has(q.i)?replaced.get(q.i).slice(0,60):anchorText(q),lead:lead||'',text,point:0,reason:why}); rules.push((why.match(/^[AB]\d+/)||[''])[0]); notes.push('Added after ['+q.i+'] "'+anchorText(q).slice(0,40)+'…": '+(lead||text.slice(0,50))+' — '+why); return true; };
  const replace=(p,text,why)=>{ if(!p||used.has('r'+p.i)) return false; used.add('r'+p.i); replaced.set(p.i,text); edits.push({op:'replace',para:p.i,anchor:anchorText(p),lead:'',text,point:0,reason:why}); rules.push((why.match(/^[AB]\d+/)||[''])[0]); notes.push('Replaced ['+p.i+'] "'+anchorText(p).slice(0,40)+'…" — '+why); return true; };
  const has=re=>P.some(p=>re.test(p.text));
  return {P,fields,edits,notes,rules,find,findLast,insertAfter,replace,has,F:(n,fb)=>F(fields,n,fb)};
}

/* ------------------------------------------------------- family A: v4 RWLs */
function familyA(c){
  const {find,findLast,insertAfter,replace,has,F}=c;
  /* A1 capacity for loss, time horizon, liquidity: after the risk-profile result */
  const rp=find(/^Your chosen attitude to risk for this particular investment is/i)||find(/^«Why_change_in_risk_profile»$/)||find(/attitude to risk is «RPQ_ATR_Result»/i);
  if(rp&&!has(/capacity for loss/i)){
    const cash=c.fields.has('FPR_Current_value_from_Cash')?'You hold '+F('CURRENCY_OF_FACT_FIND','[currency]')+' «FPR_Current_value_from_Cash» in cash, which is approximately [X] months of your expenditure of '+F('CURRENCY_OF_FACT_FIND','[currency]')+' '+F('Expenditure_Individual_Total_Annual_Expe','[annual expenditure]')+' a year.':'You hold [amount] in readily accessible cash, which is approximately [X] months of your annual expenditure of [amount].';
    insertAfter(rp,'Capacity for loss.','Attitude to risk is the level of investment risk you are willing to take. Capacity for loss is the fall in value you could absorb without it affecting your standard of living. Based on the fact find and our discussion, your capacity for loss is '+F('UK_RPQ_Capacity_for_loss','[state it, for example: a fall of up to 20% in the value of this pension would not affect your income in retirement because …]')+'. For a growth or speculative strategy this means you could see significant short-term falls in value; [state the potential scale of loss and why that remains acceptable given your wider wealth and retirement plans].\n\n'
      +'Investment time horizon. You intend to retire at '+F('Retirement_Age','[age]')+', so the money in this arrangement is invested for [the number of years until benefits are first needed] and will then be drawn over [the expected period in retirement]. The recommended strategy is appropriate for that period.\n\n'
      +'Liquidity and emergency fund. '+cash+' Blacktower\'s guidance is to keep readily accessible funds equal to at least three to six months\' expenditure. [Confirm this is met and that the money in this recommendation is not needed for any short-term commitment.] [State any penalties, restrictions or surrender charges that would apply if the investment were withdrawn, cancelled or encashed earlier than intended.]','A1 Manual 9.5, 10.1, 13 and 13.2: capacity for loss, time horizon and liquidity must be stated in the RWL (checklist R8); the second and third paragraphs carry their own bold lead');
  }
  /* A2 cashflow: what it shows, and the assumptions, in the same figures as the report */
  const cf=find(/^Whilst the cashflow modelling identifies a potential shortfall/i)||find(/^«Cashflow_plan_analysis»$/);
  if(cf) insertAfter(cf,'What the cashflow forecast does and does not show.','The cashflow forecast illustrates whether your current and planned assets could support your target income. It is a projection built on assumptions, not a guarantee, and the actual outcome will differ. [Where the forecast shows your retirement objective is met with or without this transfer, say so plainly here: the transfer is then not recommended to improve the forecast but to meet the objectives set out in this letter.]\n\n'
      +'Key assumptions behind the forecast. The forecast assumes [your main income of '+F('CURRENCY_OF_FACT_FIND','[currency]')+' '+F('Income_Individual_Total_Gross_Income_fr','[amount]')+' a year continues until retirement at '+F('Retirement_Age','[age]')+'], expenditure of '+F('CURRENCY_OF_FACT_FIND','[currency]')+' '+F('Expenditure_Individual_Total_Annual_Expe','[amount]')+' a year, investment growth of [X]% a year and inflation of '+F('FPR__Inflation_Rate','[X]%')+'. The single largest driver of the result is [name it]. If that assumption fails, [say what happens to the outcome]. These figures are the same as those in the attached cashflow report and in the summary of your circumstances above.','A2 Manual 13 ("any material assumptions") and checklist R2, R3, R16, R19: the summary must say what the forecast shows and must match the report');
  /* A3 rationale: objectives-led, and why not the existing plan */
  const why=find(/^The reason we are doing this recommendation is because/i);
  if(why) insertAfter(why,'How the recommendation meets your objectives.','Taking each objective in turn: [objective 1] is met by [what the recommended arrangement provides that the existing one cannot]; [objective 2] is met by […]. Consolidation and receiving ongoing advice are valid reasons but are not sufficient on their own. The reasons that carry this recommendation are [state the strongest: for example, your country of residence and where benefits will be drawn, access to the recommended investment strategy, the death benefits you want, the currency you spend in, an ongoing advisory relationship].','A3 Checklist R1 and R17, from the bounce-backs of 13 Oct 2026: the strongest reasons must be the stated rationale');
  const weak=find(/^You could leave the existing plan where it is however, retaining your existing schemes does not meet with some of your objectives/i);
  if(weak){ replace(weak,'You could leave your existing scheme(s) where they are. The table above shows what each already provides: [flexible drawdown, death benefits, access as a non-UK resident, no exit penalty, as applicable]. What they cannot provide is [state precisely]. Where an existing scheme can receive cross-border advice and could accept the other plans, I have considered consolidating into it; it is not recommended because [state why]. Retaining the existing scheme(s) is therefore not recommended for these reasons, and not because of past or expected investment performance.','A3 Manual 13.9 and checklist R4, R7, R17: say what the existing scheme already provides, what it cannot, and why not consolidate into it');
    insertAfter(weak,'Costs, penalties and benefits given up on transfer.','Any exit fee or bonus and any guarantees on each existing plan are shown in the table above. [State here, for each plan, any guarantee, protected tax-free cash, employer contribution, death benefit or other protection that will be lost, the cost of moving, and why the benefits of transferring still match or outweigh staying.]','A3 Manual 13.9: costs, penalties and benefits lost must be stated (checklist R4, R20)'); }
  /* A4 tax residence and local tax advice */
  const iht=find(/^Please Note, «[^»]+» are not tax experts and would suggest/i)||find(/^Inheritance Tax \(IHT\) on Pensions/i)||find(/^Starting from April 2027, inherited pension funds/i);
  const beforeReco=iht||(()=>{ const h=find(/^Recommendation\s*:?$/); return h?c.P[h.i-1]&&c.P.slice(0,h.i).reverse().find(p=>p.text.trim()):null; })();
  if(beforeReco&&!has(/double taxation/i)) insertAfter(beforeReco,'Your tax residence and how benefits will be taxed.','You are currently tax resident in '+F('Country_of_tax_resident','[country]')+'. How your pension income and any lump sums are taxed depends on where you are tax resident when you draw them and on the double taxation agreement between that country and the UK; it is not determined by where the pension is held. [If you may retire in a different country, name it and say that the tax treatment there will differ.] [Where the tax treatment in your country of residence is uncertain or outside our knowledge, say so here.] You should obtain local tax advice before proceeding and again before drawing benefits.','A4 Manual 10 and 13.5 (Tax Considerations): tax residence, unknown treatment disclosed, local tax advice (checklist R5, R6)');
  /* A5 total ongoing cost, justified */
  const exante=find(/^Please note the below has been calculated using a 5% growth rate/i)||find(/^ADD IN EX-ANTE TABLES HERE/i)||find(/^Annual Fund Fees$/i);
  if(exante) insertAfter(exante,'Total ongoing cost and why it is justified.','Adding together the trustee, platform, adviser and fund charges above, the total ongoing cost of the recommendation is approximately [X]% a year ([currency] [X]). Your existing scheme(s) charge '+F('UK_PI_DC_1_Annual_Charges','[existing annual charge]')+' a year. [State the difference in cash and percentage, what you receive for it (the ongoing advice and servicing listed above, access to the recommended strategy, consolidation), and why that is proportionate to the size of the fund and your wider wealth.] [Where saving costs is one of your objectives, show the current fund and adviser charges beside the new ones and state the saving.] Costs and charges will have an impact on investment returns over time.','A5 Manual 11.7 and 13 (costs and charges, value for money) and checklist R9, R18, R21, from the bounce-backs of 13 Oct 2026');
  /* A6 standard risk warnings (13.2) and the exact tax caveat (13.5) */
  const taxlaw=find(/^Tax law (may|could) change in the future/i)||findLast(/^Information about past investment performance should not be taken as a guide/i)||find(/^Blacktower are not tax experts and due to the complexities/i);
  if(taxlaw){ const missing=WARN.filter(w=>!has(w[2])).map(w=>w[1]); if(missing.length) insertAfter(taxlaw,'',missing.join('\n\n'),'A6 Manual 13.2: standard risk warnings the template did not carry');
    if(!has(/cannot be held responsible should the applicable tax authority/i)) insertAfter(taxlaw,'',TAX_CAVEAT,'A6 Manual 13.5: the caveat that must be included in all RWLs, in its exact words'); }
  /* A7 reduced fee keeps the servicing proposition */
  const fee=find(/^The initial and ongoing fees outlined in this Reason Why Letter differ from Blacktower’s standard fee schedule/i)||find(/^The initial and ongoing fees outlined in this Reason Why Letter differ from Blacktower's standard fee schedule/i);
  if(fee&&!/does not reduce the service/i.test(fee.text)) replace(fee,fee.text.trim()+' This does not reduce the service you receive: the full servicing proposition set out below continues unchanged.','A7 Checklist R10, from the first bounce-back: a reduced fee must confirm the servicing proposition continues');
  /* A8 wills wording, A9 clients over 80 or vulnerable */
  const will=find(/^«APPS_OUT_1_ADMIN_If_will_is_in_diferent_»$/)||find(/^Is your will up to date\?/i);
  if(will&&!has(/valid and up-to-date Will/i)) insertAfter(will,'',WILLS,'A8 Manual 13.13: the example Will wording');
  const health=find(/^Your state of health is/i);
  if(health&&!has(/trusted family member/i)) insertAfter(health,'',OVER80,'A9 Manual 9.7: optional paragraph for clients aged 80 and over or vulnerable, in the manual\'s words; delete where it does not apply');
  /* A10 target market */
  const reco=find(/^We cannot \(under our regulations\) recommend a transfer into an alternative arrangement/i)||find(/^We cannot \(under (our )?regulations\) recommend/i);
  if(reco&&!has(/target market/i)) insertAfter(reco,'','The recommended product and investment strategy are on the approved panel for '+F('APPS_OUT_1__Please_use_IDD__MIFID_Lis','the licensed Blacktower entity')+' and fall within the manufacturer\'s target market for a client with your objectives, risk profile, capacity for loss and investment time horizon. [Where any part of the recommendation falls outside the target market, say so; it must have been referred to Compliance first.]','A10 Manual 13.1: product governance and target market');
  /* A11 addendum link to the original */
  const add=find(/^I write this letter as an addendum to the report dated/i);
  if(add) insertAfter(add,'','This addendum should be read in conjunction with the original Reasons Why Letter dated [DD/MM/YYYY], which continues to apply except where it is changed below. [State the change in your circumstances, objectives or instructions that led to this revision, and the reasons for the revised advice.] [Confirm that your risk profile, capacity for loss and time horizon are unchanged, or state what has changed.]','A11 Manual 13.11: an addendum must outline the change, the reasons, and say it is read with the original RWL');
}

/* ------------------------------------------- family B: BFM UK suitability */
function familyB(c){
  const {P,find,insertAfter,replace,has,F}=c;
  /* B1 exact tax caveat everywhere the shorter one appears */
  P.filter(p=>/Blacktower are not tax advisers and due to the complexities of the tax system/i.test(p.text)&&!/cannot be held responsible/i.test(p.text)).forEach(p=>replace(p,'Please note that whilst my recommendations are based on our current understanding of tax law, '+TAX_CAVEAT,'B1 Manual 13.5: the caveat must appear in its exact words in all RWLs'));
  /* B2 risk warnings */
  const pp=find(/^Past performance should only be used as a guide\. It is no guarantee of future performance/i);
  if(pp) replace(pp,'Past performance is not a reliable indicator of future results and must not be relied on as a guide to future performance.','B2 Manual 13.5: past performance wording');
  const law=find(/^My advice and recommendations are based on my understanding of current law and taxation/i);
  if(law){ const missing=WARN.filter(w=>!has(w[2])).map(w=>w[1]); if(missing.length) insertAfter(law,'',missing.join('\n\n'),'B2 Manual 13.2: standard risk warnings the template did not carry'); }
  /* B3 performance is not a reason to switch */
  const perf=find(/^The current investment strategy has not performed satisfactorily when compared to other options/i);
  if(perf) replace(perf,'The current investment strategy does not match your agreed risk profile and objectives: [state specifically what it lacks, for example no access to the recommended strategy, no ongoing advice, higher cost, the wrong currency]. Past or expected investment performance is not a reason for this recommendation.','B3 Manual 13.5 and 13.9 (switching must not be based on past performance) and checklist R7');
  /* B4 the weak rationale: higher fees for ongoing advice */
  const fees=find(/^Your recurring fees are going to go up/i);
  if(fees) replace(fees,'Your recurring charges will be higher than on your existing plan(s): [state the existing total and the new total side by side, and the difference in cash and percentage]. Receiving ongoing advice is one reason for accepting this, but on its own it is not sufficient: [state what else the recommended plan provides that the existing plan(s) cannot, and why the extra cost is proportionate to the size of the fund and your wider wealth].','B4 Manual 11.7 and 13 (value for money) and checklist R17, R18, from the bounce-back of 13 Oct 2026');
  /* B5 benefits given up, B6 why not the existing plan */
  const initial=find(/^You will incur a new set of initial charges on reinvestment/i);
  if(initial&&!has(/protected tax-free cash/i)) insertAfter(initial,'Benefits, guarantees or protections given up.','[For each existing plan, state any guarantee, protected tax-free cash, employer contribution, death benefit, protected retirement age or other feature that will be lost on transfer, and any exit penalty, and confirm that the benefits of the recommended plan match or outweigh those given up.] The review of your existing plans above shows any guarantees or bonuses they carry.','B5 Manual 13.9: guarantees, benefits or protections that may be lost (checklist R4, R20)');
  const cannot=find(/^The plan cannot facilitate the recommended investment strategy/i);
  if(cannot) insertAfter(cannot,'','Your existing plan(s) already provide [flexible retirement options, death benefits, no exit penalty, as applicable; see the review above]. What they cannot provide is [state precisely]. [Where an existing plan could accept the other plans and receive ongoing advice, say why consolidating into it is not recommended.]','B6 Manual 13.9 and checklist R4, R17: what the existing plan already provides and what it cannot');
  /* B7 total ongoing cost */
  const est=find(/^The charge in monetary terms is an estimate based on the amount being invested into the plan/i);
  if(est) insertAfter(est,'Total ongoing cost and why it is justified.','The total ongoing cost of the recommendation, adding together the product, platform, adviser and investment charges above, is '+F('Total_ongoing_costs_as_a_percentage','[X]%')+' a year (£'+F('UK_Total_Ongoing_fees_post_inital','[X]')+'), compared with '+(c.fields.has('Total_monetary_charges')?'£«Total_monetary_charges»':'[X]')+' a year on your existing plan(s). [State the difference in cash and percentage, what you receive for it, and why that is proportionate to the size of the plan and your wider wealth. Where saving costs is one of your objectives, show the current and new charges side by side and state the saving.]','B7 Manual 11.7 and 13 and checklist R9, R18, R21');
  /* B8 moving abroad */
  const abroad=find(/^«UK_move_abroad»$/);
  if(abroad) insertAfter(abroad,'','[If you intend to move abroad, or may draw benefits while resident outside the UK, state the country, that the tax treatment of withdrawals will depend on your residence at the time and the relevant double taxation agreement, and that you should take local tax advice before proceeding and before drawing benefits.]','B8 Manual 10 and 13.5 (Tax Considerations) and checklist R5');
  /* B9 time horizon and scale of loss */
  const cap=find(/your maximum capacity for loss is «UK_RPQ_Capacity_for_loss»/i)||find(/^Your capacity for loss can be summarised as follows/i);
  if(cap&&!has(/investment time horizon\./i)) insertAfter(cap,'Investment time horizon.','You intend to retire at '+F('Retirement_Age','[age]')+', so [state the number of years until benefits are first needed and how long they will be drawn]. The recommended strategy is appropriate for that period. For a growth or high-risk strategy you could see significant short-term falls in value; [state the potential scale of loss and why that remains acceptable given your capacity for loss and wider wealth].','B9 Manual 13 and 13.2 and checklist R8');
  /* B10 target market */
  const suit=find(/^It is the most suitable solution given your circumstances/i);
  if(suit&&!has(/target market/i)) insertAfter(suit,'','It is on Blacktower\'s approved panel and falls within the manufacturer\'s target market for a client with your objectives, risk profile, capacity for loss and investment time horizon.','B10 Manual 13.1: product governance and target market');
  /* B11 addenda */
  const add=find(/^I write this letter as an addendum to the report dated/i)||find(/^This addendum is based on the original suitability report/i);
  if(add) insertAfter(add,'','This addendum should be read in conjunction with the original suitability report dated [DD/MM/YYYY], which continues to apply except where it is changed below. [State the change in your circumstances, objectives or instructions that led to this revision, and the reasons for the revised advice.] [Confirm that your risk profile, capacity for loss and time horizon are unchanged, or state what has changed.]','B11 Manual 13.11');
  /* B12 Bed and ISA: a capital-at-risk warning */
  const bed=find(/^I have completed a rough calculation and whilst I can see there may be a small capital gain/i);
  if(bed&&!has(/fall as well as rise|get back less/i)) insertAfter(bed,'','The value of investments can fall as well as rise and you may get back less than you invest. While the holdings are sold in the General Investment Account and repurchased in the ISA you will be out of the market for a short period, during which you will not benefit from any rise in value, nor suffer any fall.','B12 Manual 13.2: capital at risk');
}

/* ----------------------------------------------------------------- run */
fs.mkdirSync(OUT,{recursive:true}); const summary=[];
for(const r of inv){
  if(SKIP[r.rel]){ summary.push({rel:r.rel,skipped:SKIP[r.rel]}); continue; }
  const bytes=fs.readFileSync(path.join(IN,r.rel)); const doc=R.docxOpen(fflate,bytes);
  const c=makeCtx(doc.xml); const fam=/UK - Suitability|BFM UK|Bed and ISA|Addendum Suitability Report - Template UK/.test(r.rel)?'B':'A';
  (fam==='A'?familyA:familyB)(c);
  if(!c.edits.length){ summary.push({rel:r.rel,family:fam,edits:0,note:'no anchor matched; needs a hand review'}); continue; }
  const out=R.docxRedline(doc.xml,c.edits,{author:AUTHOR});
  const dest=path.join(OUT,r.rel.replace(/\.docx$/i,' - aligned.docx')); fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,R.docxSave(fflate,doc,out.xml));
  /* independent re-count of the fields after accept-all, from the file as written */
  const back=fflate.strFromU8(fflate.unzipSync(fs.readFileSync(dest))['word/document.xml']);
  const acc=back.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g,'').replace(/<\/?w:ins\b[^>]*>/g,'');
  const count=x=>[...x.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)].map(m=>m[1]).concat([...x.matchAll(/w:fldSimple w:instr="([^"]*)"/g)].map(m=>m[1])).filter(s=>/MERGEFIELD/.test(s)).length;
  const before=count(doc.xml), after=count(acc);
  const placeholders=(c.edits.map(e=>e.text).join(' ').match(/\[[^\]]{3,}\]/g)||[]).length;
  const notes='# '+r.rel+'\n\nAligned with the BT Sales Process Manual v9 (July 2026) on '+new Date().toISOString().slice(0,10)+'. Every change is a tracked change by "'+AUTHOR+'"; open in Word, Review → Track Changes, and accept or reject each one.\n\n'
    +'Mail merge: '+before+' merge fields before, '+after+' after accepting every change'+(out.merge.missing.length?' — MISSING: '+out.merge.missing.join(', '):' — all present')+'.\n\n'
    +'## Changes ('+out.applied.length+' applied'+(out.skipped.length?', '+out.skipped.length+' could not be placed':'')+')\n\n'+c.notes.map(n=>'- '+n).join('\n')+'\n\n'
    +(out.skipped.length?'## Could not be placed\n\n'+out.skipped.map(s=>'- '+s.why+': '+s.edit.reason).join('\n')+'\n\n':'')
    +'## What the adviser fills in per letter\n\nText in [square brackets] is a prompt for the adviser and must be replaced or deleted before the letter goes out; the pre-check (C5) flags any that are left. Merge fields «like_this» fill from the MADS as before.\n';
  fs.writeFileSync(dest.replace(/\.docx$/,' - notes.md'),notes);
  summary.push({rel:r.rel,family:fam,rules:[...new Set(c.rules)].join(' '),edits:c.edits.length,applied:out.applied.length,skipped:out.skipped.map(s=>s.why),ins:out.insertions,del:out.deletions,fieldsBefore:before,fieldsAfter:after,missing:out.merge.missing,placeholders});
}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,1));
summary.forEach(s=>console.log(s.skipped&&typeof s.skipped==='string'?'SKIPPED '+s.rel+' — '+s.skipped:s.rel+' | '+s.family+' | '+s.rules+' | edits '+s.edits+' applied '+s.applied+(s.skipped&&s.skipped.length?' NOT PLACED '+s.skipped.length+' ('+s.skipped.join('; ')+')':'')+' | ins '+s.ins+' del '+s.del+' | fields '+s.fieldsBefore+' → '+s.fieldsAfter+(s.missing&&s.missing.length?' MISSING '+s.missing.join(','):' ✓')));
