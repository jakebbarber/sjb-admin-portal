const fs=require('fs'),path=require('path'); const [W]=process.argv.slice(2);
const inv=JSON.parse(fs.readFileSync(path.join(W,'inventory.json'))); const hdr=JSON.parse(fs.readFileSync(path.join(W,'mads-headers.json')));
/* Word's merge-field name for a MADS header: letters, digits and spaces kept (spaces -> _), everything else dropped, cut at 40 */
const wordName=h=>String(h).replace(/[^A-Za-z0-9 ]/g,'').replace(/ /g,'_').slice(0,40).toLowerCase();
const wn=new Set(hdr.map(wordName)); const wn2=new Set(hdr.map(h=>String(h).replace(/[^A-Za-z0-9]/g,'_').slice(0,40).toLowerCase()));
const fflate=require(path.join(__dirname,'..','node_modules','fflate'));
const IN=path.join(W,'..','rwl-in','AO1 - RWLs');
const CHECKS={
  taxCaveat:/not tax (experts|advisers?)[^.]{0,200}(independent tax (opinion|advice))/i,
  taxCaveatExact:/Blacktower are not tax experts and due to the complexities of the tax system/i,
  capacityForLoss:/capacity for loss/i, timeHorizon:/(investment )?time horizon|investment term/i, liquidity:/liquidity|emergency fund|readily accessible|three to six months/i,
  riskFallRise:/fall as well as rise|get back less|may receive back less|capital (is|may be) at risk/i, inflation:/inflation/i, incomeNotGuaranteed:/income[^.]{0,60}not guaranteed/i,
  suitabilityMayChange:/(may not|no longer) be suitable if[^.]{0,80}change/i, esgNoGuarantee:/ESG|sustainab/i, taxMayChange:/tax treatment depends on (your )?individual circumstances|tax (rules|treatment) (may|can|could) change/i,
  fxRisk:/exchange rate|currency (risk|movement|fluctuation)/i, costsImpact:/charges (will|may) (have an )?impact|impact (of|on)[^.]{0,40}(charges|returns)/i,
  guarantees:/guarantee/i, pastPerf:/past performance is not (a reliable|a guide|an indicator)/i, perfAsReason:/\b(better|improved|superior|stronger|higher) (investment )?(performance|returns)\b/i,
  marketingWords:/\b(secure|safe|capital protected|risk.free|guaranteed growth)\b/i, inMyOpinion:/in my opinion/i,
  feesPct:/\d+(\.\d+)?\s?%/, feesMoney:/(£|€|\$|GBP|EUR|USD)\s?\d|«[^»]*(fee|charge)[^»]*monetary[^»]*»/i, totalOngoing:/total (ongoing|annual) (cost|charge)/i,
  whyExistingNotSuitable:/(existing|current) (arrangement|scheme|plan|pension|policy)[^.]{0,120}(no longer|does not|not meet|unsuitable|not suitable)/i,
  benefitsLost:/(benefits?|guarantees?|protections?)[^.]{0,60}(lost|forfeit|give up|given up|loss of)/i, penalties:/exit (fee|penalt|charge)|surrender (penalt|charge|value)|early (exit|encashment)/i,
  alternatives:/alternative(s)? (considered|we considered|discounted)|other options|we also considered|do nothing|retain(ing)? (the|your) existing/i,
  servicing:/ongoing (service|servicing|advice|review)|annual review/i, assumptions:/assum(e|ption)/i, cashflowCaveat:/cash\s?flow[^.]{0,120}(does not|is not a|not a guarantee|illustrat|projection)/i,
  crossBorderTax:/tax resident|country of (tax )?residence|resident (in|for tax)/i, localTaxAdvice:/(local|independent|professional) tax advice/i,
  wills:/\bwill\b[^.]{0,60}(up.to.date|valid|in place)/i, ageOver80:/trusted family member|power of attorney/i,
  cooling:/cancellation|cooling.off/i, targetMarket:/target market/i, clientCategory:/retail client/i, addendumLink:/read in conjunction with/i, consumerDuty:/consumer duty/i,
};
const MUST=['taxCaveatExact','capacityForLoss','timeHorizon','liquidity','riskFallRise','inflation','taxMayChange','fxRisk','costsImpact','guarantees','feesPct','pastPerf','whyExistingNotSuitable','benefitsLost','penalties','alternatives','servicing','crossBorderTax','localTaxAdvice','targetMarket'];
const rows=[]; const groups={};
for(const r of inv){ if(/Old - SJB EU/.test(r.rel)) continue; const text=fs.readFileSync(path.join(W,r.slug+'.txt'),'utf8');
  const res={}; for(const k in CHECKS) res[k]=CHECKS[k].test(text);
  /* field names, matched Word's way */
  const xml=fflate.strFromU8(fflate.unzipSync(fs.readFileSync(path.join(IN,r.rel)))['word/document.xml']);
  const codes=[...xml.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)].map(m=>m[1]).concat([...xml.matchAll(/w:fldSimple w:instr="([^"]*)"/g)].map(m=>m[1])).join(' ').replace(/\s+/g,' ');
  const names=[...new Set([...codes.matchAll(/MERGEFIELD\s+"?([^"\\]+?)"?\s*(?=\\|MERGEFIELD|$)/g)].map(m=>m[1].trim()))];
  const missing=names.filter(n=>!wn.has(n.toLowerCase())&&!wn2.has(n.toLowerCase())&&!wn.has(n.toLowerCase().slice(0,40)));
  rows.push({rel:r.rel,slug:r.slug,paras:r.paras,fields:names.length,missing,gaps:MUST.filter(k=>!res[k]),bad:['perfAsReason','marketingWords','inMyOpinion'].filter(k=>res[k]),res});
}
fs.writeFileSync(path.join(W,'audit.json'),JSON.stringify(rows,null,1));
rows.forEach(r=>console.log(r.rel+'\n   fields '+r.fields+(r.missing.length?' · NOT IN MADS V.28: '+r.missing.join(', '):' · all in MADS')+'\n   MISSING: '+(r.gaps.join(', ')||'none')+(r.bad.length?'\n   FLAGGED: '+r.bad.join(', '):'')));
const tally={}; rows.forEach(r=>r.gaps.forEach(g=>tally[g]=(tally[g]||0)+1)); console.log('\nGAP TALLY over '+rows.length+' templates:',JSON.stringify(tally));
