/* Builds a FICTIONAL mail-merge RWL template with real MERGEFIELD codes, the
   way the MADS-driven templates work, so the engine can be tested for
   merge-field safety. No real client or field names from the firm. */
const fs=require('fs'); const path=require('path');
const {Document,Packer,Paragraph,TextRun,HeadingLevel,SimpleMailMergeField}=require('docx');
const P=(parts,o={})=>new Paragraph({children:parts.map(p=>typeof p==='string'?new TextRun({text:p,bold:!!o.bold}):p),heading:o.h});
const B=parts=>new Paragraph({children:parts.map(p=>typeof p==='string'?new TextRun(p):p),bullet:{level:0}});
const MF=n=>new SimpleMailMergeField(n);
const doc=new Document({sections:[{children:[
  P([MF('Client_Title'),' ',MF('Client_First'),' ',MF('Client_Surname')],{bold:true}),
  P([MF('Address_1')]),
  P([MF('Letter_Date')]),
  P(['Dear ',MF('Client_Title'),' ',MF('Client_Surname')]),
  P(['Reasons Why Letter: Your Retirement Plan'],{h:HeadingLevel.HEADING_1}),
  P(['Thank you for meeting me on ',MF('Meeting_Date'),'. This report is based on the information you gave me at that meeting, when we completed a fact find and a risk profile questionnaire.']),
  P(['Your Objectives'],{h:HeadingLevel.HEADING_2}),
  P([MF('Objectives_Text')]),
  P(['Cashflow Report'],{h:HeadingLevel.HEADING_2}),
  P(['We recently went through a Cashflow report outlining whether or not you are on track to reach your retirement goals. The forecast assumes your income of ',MF('Income_Annual'),' a year continues throughout the forecast period and your expenditure remains at ',MF('Expenditure_Annual'),' a year.']),
  P(['Based on this cashflow forecast, your investment assets are sufficient to meet your retirement income target in every year of the forecast.']),
  P(['Recommendation'],{h:HeadingLevel.HEADING_2}),
  P(['The reason we are doing this recommendation is because the cashflow shows that consolidating your pension will help you reach your retirement goals.']),
  P(['Retaining your existing scheme does not meet your needs for the following reasons:']),
  B(['You plan to retire outside of the UK and would like to receive advice throughout retirement']),
  B(['Greater investment options']),
  B(['Better Performance']),
  P(['I therefore recommend you transfer your ',MF('Ceding_Scheme'),' (current value ',MF('Transfer_Value'),') to the ',MF('Receiving_Scheme'),' and invest in the ',MF('Portfolio_Name'),', which matches your ',MF('Risk_Profile'),' risk profile.']),
  P(['Charges'],{h:HeadingLevel.HEADING_2}),
  P(['The initial advice fee is ',MF('Initial_Fee_Pct'),' (',MF('Initial_Fee_Amount'),'). The ongoing adviser fee is ',MF('Ongoing_Fee_Pct'),' a year.']),
  P(['The initial and ongoing fees outlined in this letter differ from our standard fee schedule. Following our discussions, we have agreed to apply a reduced fee structure so that the fees remain proportionate to your circumstances.']),
  P(['Risk Warnings'],{h:HeadingLevel.HEADING_2}),
  P(['The value of investments can fall as well as rise and you may get back less than you invest.']),
  P(['Yours sincerely']),
  P([MF('Adviser_Name')])
]}]});
const out=path.join(__dirname,'fixture-template.docx');
Packer.toBuffer(doc).then(b=>{ fs.writeFileSync(out,b); console.log('wrote',out,b.length,'bytes'); });
