/* Builds a FICTIONAL Reason Why Letter in Word format for testing. No real
   client appears here; the shape mirrors a typical network RWL (fact find
   summary, cashflow, recommendation bullets, fees, servicing). */
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

const P = (t, o = {}) => new Paragraph({ children: [new TextRun({ text: t, bold: !!o.bold })], heading: o.h, style: o.style });
const B = t => new Paragraph({ children: [new TextRun(t)], bullet: { level: 0 } });

const doc = new Document({ sections: [{ children: [
  P('Ms Dana Hale', { bold: true }),
  P('14 Rue Imaginaire, 69000 Lyon, France'),
  P('12/10/2026'),
  P('Dear Ms Hale'),
  P('Reasons Why Letter: Your Retirement Plan', { h: HeadingLevel.HEADING_1 }),
  P('Thank you for meeting me on 01/10/2026. This report is based on the information you gave me at that meeting, when we completed a fact find and a risk profile questionnaire.'),
  P('Your Objectives', { h: HeadingLevel.HEADING_2 }),
  P('You wish to consolidate your UK workplace pension into a single arrangement that can be managed from France, you require your pension to be invested in an ethical fund range, and you want to be advised throughout retirement by an adviser who understands cross-border issues. You intend to retire at 65 and spend your time between France and Portugal.'),
  P('Cashflow Report', { h: HeadingLevel.HEADING_2 }),
  P('We recently went through a Cashflow report outlining whether or not you are on track to reach your retirement goals. The forecast assumes your consultancy income of approximately EUR 90,000 a year continues throughout the forecast period and your expenditure remains at EUR 48,000 a year.'),
  P('Based on this cashflow forecast, your investment assets are sufficient to meet your retirement income target in every year of the forecast, with or without the proposed transfer.'),
  P('Recommendation', { h: HeadingLevel.HEADING_2 }),
  P('The reason we are doing this recommendation is because the cashflow shows that consolidating your pension will help you reach your retirement goals.'),
  P('Retaining your existing scheme does not meet your needs for the following reasons:'),
  B('You plan to retire outside of the UK and would like to receive advice throughout retirement'),
  B('Greater investment options'),
  B('Better Performance'),
  B('Online access to valuations'),
  P('I therefore recommend you transfer your Acme Workplace Pension (current value GBP 310,000) to the Example International SIPP and invest in the Ethical Balanced Portfolio, which matches your Balanced (5/10) risk profile.'),
  P('Charges', { h: HeadingLevel.HEADING_2 }),
  P('The initial advice fee is 2% (GBP 6,200). The ongoing adviser fee is 1% a year. The SIPP provider charges GBP 180 a year and the portfolio has an ongoing charge of 0.65%. Your existing scheme charges 0.45% a year and has no exit penalty.'),
  P('The initial and ongoing fees outlined in this letter differ from our standard fee schedule. Following our discussions, we have agreed to apply a reduced fee structure so that the fees remain proportionate to your circumstances.'),
  P('Servicing', { h: HeadingLevel.HEADING_2 }),
  P('For the ongoing fee you will receive an annual review meeting, investment reviews and fund switches, liaison with the provider on your behalf, and access to me throughout the year.'),
  P('Risk Warnings', { h: HeadingLevel.HEADING_2 }),
  P('The value of investments can fall as well as rise and you may get back less than you invest. Currency movements between sterling and the euro will affect the value of your pension in the currency you spend.'),
  P('Yours sincerely'),
  P('A. N. Adviser')
] }] });

const out = path.join(__dirname, 'fixture-rwl.docx');
Packer.toBuffer(doc).then(b => { fs.writeFileSync(out, b); console.log('wrote', out, b.length, 'bytes'); });
