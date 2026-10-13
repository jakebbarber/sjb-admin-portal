/* rubric.js — what Blacktower Compliance checks a Reason Why Letter against.
   Distilled from the BT Sales Manual (the document Compliance feeds to
   Copilot) and from the pattern of objections that come back. Each rule is a
   question the letter must answer, with the manual section it comes from.
   Add a rule here the next time a new type of objection appears; the reviewer
   reads this list on every run. */
export const RUBRIC = [
  { id: 'R1', section: 'RWL contents', severity: 'must',
    rule: 'The recommendation must rest on stated client objectives recorded in the fact find, and the letter must explain why the recommended action meets them. The strongest reasons (for example cross-border residence, where benefits will be drawn, religious or ethical investment requirements, an ongoing advisory relationship) must be the stated rationale, not an afterthought.' },
  { id: 'R2', section: 'Cashflow', severity: 'must',
    rule: 'If a cashflow forecast is included, the letter must say what it does and does not show. If the forecast shows the client meets their retirement objective with or without the transaction, the letter must say so plainly and must not present the cashflow as the reason for the recommendation.' },
  { id: 'R3', section: 'Cashflow', severity: 'must',
    rule: 'Material assumptions behind a cashflow forecast (continuing business or employment income, contribution levels, growth, inflation, expenditure, retirement age) must be stated prominently, with the single largest driver named, and the letter must say what happens to the outcome if that assumption fails.' },
  { id: 'R4', section: '13.9 Switching and transfers', severity: 'must',
    rule: 'A switch or transfer must explain why the existing arrangement no longer meets the client needs, the costs of moving, and any benefits lost (guarantees, protected tax-free cash, employer contributions, death benefits), and must confirm the benefits of moving match or outweigh staying.' },
  { id: 'R5', section: 'Cross-border tax', severity: 'must',
    rule: 'Where the client lives in a different country from the pension or may retire in a third country, the letter must state the current country of tax residence, explain that taxation on withdrawal depends on residence at the time benefits are drawn (including the relevant double taxation treaty), and must not assume a future retirement country as fact.' },
  { id: 'R6', section: '13.5 Tax caveat', severity: 'must',
    rule: 'The letter must include the mandatory tax caveat: tax treatment depends on individual circumstances and may change; the firm is not a tax adviser; the client should obtain local tax advice before proceeding and before drawing benefits.' },
  { id: 'R7', section: '13.5 Past performance', severity: 'must',
    rule: 'Past or expected investment performance must never be given as a reason for a recommendation and must not be implied (for example a bullet such as "better performance"). Future performance cannot be guaranteed and the letter must not suggest otherwise.' },
  { id: 'R8', section: 'Risk', severity: 'must',
    rule: 'The letter must state the client attitude to risk, capacity for loss and investment horizon, and show the recommended investment matches them. Specific risks of the recommendation (investment, currency, liquidity, provider, regulatory) must be described in plain language.' },
  { id: 'R9', section: 'Costs', severity: 'must',
    rule: 'All initial and ongoing charges (adviser, platform or provider, fund, and any exit charges on the existing plan) must be disclosed in cash and percentage terms, compared with the existing arrangement, and the total cost of advice stated.' },
  { id: 'R10', section: 'Servicing and fees', severity: 'must',
    rule: 'Where a reduced or non-standard fee is agreed, the letter must say so and must confirm that the full agreed servicing proposition continues unchanged, listing what the client will receive for the ongoing fee.' },
  { id: 'R11', section: 'Alternatives', severity: 'should',
    rule: 'Alternatives considered (do nothing, retain and alter, alternative products or providers) must be listed with the reason each was not recommended.' },
  { id: 'R12', section: 'Scope and shortfalls', severity: 'should',
    rule: 'Where advice is limited at the client request, the limitation and any resulting shortfalls in other areas must be recorded.' },
  { id: 'R13', section: 'Consistency', severity: 'must',
    rule: 'Figures, dates, names, currencies and objectives must be consistent across the letter (fact find summary, cashflow, recommendation, charges). Any contradiction is a finding.' },
  { id: 'R14', section: 'Plain language', severity: 'should',
    rule: 'Statements must be evidenced from the fact find or cashflow, free of marketing language, and must not overstate benefits or certainty.' },
  { id: 'R15', section: 'Four Eyes', severity: 'should',
    rule: 'The letter must be ready for a second-person approval: no placeholders, template text or unresolved highlights left in.' }
];

export const rubricText = () => RUBRIC.map(r => r.id + ' [' + r.section + '] (' + r.severity + '): ' + r.rule).join('\n');
