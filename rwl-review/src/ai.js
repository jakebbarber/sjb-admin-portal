/* ai.js — the two Claude calls the portal makes, and nothing else.

   1. precheck(letter)            -> findings against the rubric, before the
                                     RWL is sent to Blacktower
   2. planEdits(letter, email)    -> the concrete edits that answer each point
                                     in a compliance email, plus a draft reply

   Claude only ever sees the letter text and the compliance email. It returns
   JSON matching a fixed schema; the portal (not Claude) then writes the edits
   into the Word file as tracked changes, so every change is visible and
   reversible in Word.

   Set MOCK_AI=1 in .dev.vars to run the whole portal in the sandbox without
   an API key: the mock returns a fixed, plausible answer for the test letter. */
import Anthropic from '@anthropic-ai/sdk';
import { rubricText } from './rubric.js';

export const MODEL = 'claude-opus-5-5';

const SYSTEM_PRECHECK = `You are the compliance reviewer for a regulated financial advice firm. You check a Reason Why Letter (suitability report) before it is submitted to the network's Compliance department, using the firm's review rubric below. You are rigorous, specific and fair: you only raise a finding you can point to in the letter (or a clear omission), you quote the paragraph number, and you say exactly what would satisfy the rule. You never invent client facts. Where a rule needs facts the letter does not contain (for example the client's current tax residence), say what is missing rather than guessing it.

RUBRIC
${rubricText()}`;

const SYSTEM_EDITS = `You are a senior paraplanner at a regulated financial advice firm. The network's Compliance department has returned a Reason Why Letter (suitability report) with points that must be addressed before it can be approved. Your job is to draft the precise edits that answer every point, as changes to the letter's existing paragraphs, and a short covering reply to Compliance that maps each point to the change made.

Rules you must follow:
- Use only facts that are in the letter or in the compliance email. If a point needs a fact that neither contains, do not invent it: write the sentence with a clearly marked placeholder in square brackets, e.g. [confirm current country of tax residence], and list it under "needs_adviser".
- Keep the adviser's voice and the letter's existing structure. Prefer inserting a new paragraph after an existing one, or replacing a paragraph, over rewriting whole sections.
- Each edit refers to a paragraph by its number [n] from the numbered letter, and quotes the first words of that paragraph as the anchor so the system can verify it.
- A "delete" removes a paragraph that must not be there (for example a reason that cannot be evidenced). A "replace" rewrites one paragraph. An "insert_after" adds one or more new paragraphs (separate them with a blank line) after paragraph n; an optional bold "lead" starts the first new paragraph.
- Never add promises about investment performance, never remove a risk warning, never change figures.
- Write in plain UK English, in the second person to the client, with the firm's compliance rubric below in mind so the revised letter would also pass a fresh review.

RUBRIC
${rubricText()}`;

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['ready_to_submit', 'summary', 'findings'],
  properties: {
    ready_to_submit: { type: 'boolean' },
    summary: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['rule', 'severity', 'paragraph', 'issue', 'fix'],
      properties: {
        rule: { type: 'string' }, severity: { type: 'string', enum: ['must', 'should'] },
        paragraph: { type: ['integer', 'null'] }, issue: { type: 'string' }, fix: { type: 'string' }
      } } }
  }
};

const EDITS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['points', 'edits', 'reply', 'needs_adviser'],
  properties: {
    points: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['n', 'summary'], properties: { n: { type: 'integer' }, summary: { type: 'string' } } } },
    edits: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['op', 'para', 'anchor', 'lead', 'text', 'point', 'reason'],
      properties: {
        op: { type: 'string', enum: ['replace', 'insert_after', 'delete'] },
        para: { type: 'integer' }, anchor: { type: 'string' }, lead: { type: 'string' },
        text: { type: 'string' }, point: { type: 'integer' }, reason: { type: 'string' }
      } } },
    reply: { type: 'string' },
    needs_adviser: { type: 'array', items: { type: 'string' } }
  }
};

function client(env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on this Worker (or set MOCK_AI=1 for the sandbox)');
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

async function ask(env, system, user, schema) {
  const c = client(env);
  const r = await c.beta.messages.create({
    model: env.MODEL || MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }]
  });
  if (r.stop_reason === 'refusal') throw new Error('The model declined this request' + (r.stop_details && r.stop_details.explanation ? ': ' + r.stop_details.explanation : ''));
  if (r.stop_reason === 'max_tokens') throw new Error('The answer was cut off; the letter may be too long for one pass');
  const text = r.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { data: JSON.parse(text), usage: r.usage, model: r.model };
}

export async function precheck(env, letter) {
  if (env.MOCK_AI) return { data: mockFindings(letter), usage: null, model: 'mock' };
  return ask(env, SYSTEM_PRECHECK,
    'Review the following Reason Why Letter against the rubric. Paragraphs are numbered [n].\n\n<letter>\n' + letter + '\n</letter>', FINDINGS_SCHEMA);
}

export async function planEdits(env, letter, email) {
  if (env.MOCK_AI) return { data: mockEdits(letter, email), usage: null, model: 'mock' };
  return ask(env, SYSTEM_EDITS,
    'Here is the compliance email returning the letter, then the letter with numbered paragraphs [n]. Produce the edits that answer every point, and the covering reply.\n\n<compliance_email>\n' + email + '\n</compliance_email>\n\n<letter>\n' + letter + '\n</letter>', EDITS_SCHEMA);
}

/* ------------------------------ sandbox mock ------------------------------ */
const findPara = (letter, needle) => { const m = letter.split('\n').find(l => l.toLowerCase().includes(needle.toLowerCase())); return m ? parseInt(m.slice(1), 10) : null; };
function mockFindings(letter) {
  const perf = findPara(letter, 'better performance');
  const cash = findPara(letter, 'cashflow');
  return {
    ready_to_submit: false,
    summary: 'Sandbox mock. The letter leans on the cashflow and on performance rather than on the client objectives; tax residence on withdrawal and the fee/servicing wording need attention.',
    findings: [
      { rule: 'R7', severity: 'must', paragraph: perf, issue: 'A bullet gives better performance as a reason for the transfer.', fix: 'Remove the bullet; performance cannot be evidenced or guaranteed.' },
      { rule: 'R2', severity: 'must', paragraph: cash, issue: 'The cashflow shows the objective is met either way, but the letter presents it as supporting the transfer.', fix: 'State plainly that the recommendation does not rest on retirement income need, and give the real reasons.' },
      { rule: 'R5', severity: 'must', paragraph: null, issue: 'Current country of tax residence and the tax position on withdrawal are not stated.', fix: 'Add a paragraph on current residence, withdrawal taxation and the need for local tax advice.' },
      { rule: 'R10', severity: 'should', paragraph: findPara(letter, 'reduced fee'), issue: 'Reduced fee stated without confirming the service is unchanged.', fix: 'Add that the full servicing proposition continues.' }
    ]
  };
}
function mockEdits(letter, email) {
  const perf = findPara(letter, 'better performance');
  const cash = findPara(letter, 'cashflow');
  const fee = findPara(letter, 'reduced fee');
  const edits = [];
  if (cash != null) edits.push({ op: 'insert_after', para: cash, anchor: letter.split('\n').find(l => l.startsWith('[' + cash + ']')).replace(/^\[\d+\]\s*(\{[^}]*\}\s*)?/, '').slice(0, 60), lead: 'Key assumptions behind the forecast.', text: 'The forecast assumes your business income continues at its current level throughout the forecast period. That is the single largest driver of the result. If it reduces or stops, the outcome would look materially different, and we will review this assumption with you at each annual review.', point: 1, reason: 'Assumptions must be prominent (R3).' });
  if (perf != null) edits.push({ op: 'delete', para: perf, anchor: 'better performance', lead: '', text: '', point: 2, reason: 'Performance cannot be a reason for a recommendation (R7).' });
  if (fee != null) edits.push({ op: 'replace', para: fee, anchor: letter.split('\n').find(l => l.startsWith('[' + fee + ']')).replace(/^\[\d+\]\s*(\{[^}]*\}\s*)?/, '').slice(0, 60), lead: '', text: 'Following our discussions we have agreed a reduced fee structure. This does not reduce the service you receive: you will continue to receive the full agreed servicing proposition set out below.', point: 3, reason: 'Servicing must be confirmed unchanged (R10).' });
  return {
    points: [{ n: 1, summary: 'Cashflow assumptions need prominence' }, { n: 2, summary: 'Remove better performance' }, { n: 3, summary: 'Fee reduction must confirm servicing continues' }],
    edits,
    reply: 'Thank you for the review. Point 1: a new paragraph on the key assumptions now follows the cashflow summary. Point 2: the performance bullet has been removed. Point 3: the fee paragraph now confirms the full servicing proposition continues. (Sandbox mock reply.)',
    needs_adviser: ['[confirm current country of tax residence]']
  };
}
