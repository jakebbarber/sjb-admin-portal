/* Builds a FICTIONAL CashCalc-style cashflow report in Word format for testing
   the cashflow reconciliation (C8 and R16). Dana Hale is invented. The report
   deliberately disagrees with the fixture letter: income EUR 85,000 (the letter
   says 90,000), and a shortfall from 2049 without the transfer (the letter says
   the target is met in every year), so the check has something to find. */
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const P = (t, o = {}) => new Paragraph({ children: [new TextRun({ text: t, bold: !!o.bold })], heading: o.h });
const doc = new Document({ sections: [{ children: [
  P('Cashflow Forecast Report', { h: HeadingLevel.HEADING_1 }),
  P('Prepared for Ms Dana Hale · Prepared by A. N. Adviser · 05/10/2026'),
  P('Summary', { h: HeadingLevel.HEADING_2 }),
  P('This forecast models your finances from today to age 95 in euros. Two scenarios are compared: retaining the Acme Workplace Pension (Scenario A) and transferring it to the Example International SIPP (Scenario B).'),
  P('Assumptions', { h: HeadingLevel.HEADING_2 }),
  P('Consultancy income: EUR 85,000 a year, continuing until retirement at age 65 in 2040.'),
  P('Expenditure: EUR 48,000 a year, rising with inflation at 2.5% a year.'),
  P('Investment growth: 4.0% a year net of fund charges. Inflation: 2.5% a year.'),
  P('Pension value today: GBP 310,000 (EUR 361,000 at 1.165). State pension from age 67.'),
  P('Results', { h: HeadingLevel.HEADING_2 }),
  P('Scenario A (retain): your assets meet the retirement income target until 2049. From 2049 there is a shortfall of approximately EUR 6,500 a year, met by drawing on the property.'),
  P('Scenario B (transfer): your assets meet the retirement income target in every year of the forecast, with EUR 92,000 remaining at age 95.'),
  P('Key risks', { h: HeadingLevel.HEADING_2 }),
  P('The result is most sensitive to the consultancy income continuing to age 65. If it stops at age 60, both scenarios show a shortfall from 2046.')
] }] });
const out = path.join(__dirname, 'fixture-cashcalc.docx');
Packer.toBuffer(doc).then(b => { fs.writeFileSync(out, b); console.log('wrote', out, b.length, 'bytes'); });
