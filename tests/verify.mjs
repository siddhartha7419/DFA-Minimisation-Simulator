// Automated correctness check for the DFA Minimisation Simulator.
// Loads the real script.js with a tiny fake DOM, then:
//  1. runs the built-in example and prints every partition step;
//  2. minimises 500 random DFAs and checks the minimal DFA accepts exactly
//     the same strings as the original (all strings up to length 8), and that
//     its state count equals the number of Myhill-Nerode classes.
// Run: node tests/verify.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'DFA_minimisation_Sim');
const els = {};
const fakeEl = () => ({ value: '', innerHTML: '', textContent: '', hidden: false, disabled: false,
  addEventListener() {}, querySelectorAll: () => [], classList: { toggle() {} } });
const ctx = { document: { getElementById: id => (els[id] ??= fakeEl()) }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'script.js'), 'utf8'), ctx);
const { refine, reachableStates } = ctx;

// ---------- 1. Built-in example ----------
const ex = vm.runInContext('parseDFA()', ctx);
const reach = reachableStates(ex);
const { groups, history } = refine(ex, reach);
console.log('Example DFA: states', ex.states.join(','), '| finals', ex.finals.join(','));
console.log('Unreachable:', ex.states.filter(s => !reach.includes(s)).join(',') || 'none');
history.forEach((h, i) => console.log(`  P${i} ${h.title}: ` + h.groups.map(g => '{' + g.join(',') + '}').join(' ')));
console.log(`Minimal DFA has ${groups.length} states\n`);

// ---------- 2. Random DFAs ----------
const accepts = (dfa, w) => { let s = dfa.start; for (const c of w) s = dfa.transitions[s][c]; return dfa.finals.includes(s); };
const allStrings = (alpha, n) => { const out = ['']; let layer = ['']; for (let i = 0; i < n; i++) { layer = layer.flatMap(w => alpha.map(a => w + a)); out.push(...layer); } return out; };
function quotient(dfa, groups) {
  const name = new Map(); groups.forEach((g, i) => g.forEach(s => name.set(s, 'Q' + i)));
  const t = {}; groups.forEach((g, i) => { t['Q' + i] = {}; dfa.alphabet.forEach(a => t['Q' + i][a] = name.get(dfa.transitions[g[0]][a])); });
  return { states: groups.map((_, i) => 'Q' + i), alphabet: dfa.alphabet, start: name.get(dfa.start),
    finals: groups.map((g, i) => g.some(s => dfa.finals.includes(s)) ? 'Q' + i : null).filter(Boolean), transitions: t };
}
function nerodeClasses(dfa, reach, words) { // brute force: states with the same accept-pattern on all suffixes are equivalent
  const sig = s => words.map(w => { let q = s; for (const c of w) q = dfa.transitions[q][c]; return dfa.finals.includes(q) ? 1 : 0; }).join('');
  return new Set(reach.map(sig)).size;
}
let pass = 0, fail = 0;
for (let trial = 0; trial < 500; trial++) {
  const n = 2 + Math.floor(Math.random() * 7), alphabet = Math.random() < 0.5 ? ['0', '1'] : ['a', 'b', 'c'];
  const states = Array.from({ length: n }, (_, i) => 'S' + i);
  const transitions = {}; states.forEach(s => { transitions[s] = {}; alphabet.forEach(a => transitions[s][a] = states[Math.floor(Math.random() * n)]); });
  const finals = states.filter(() => Math.random() < 0.4);
  const dfa = { states, alphabet, start: 'S0', finals, transitions };
  const r = reachableStates(dfa), { groups } = refine(dfa, r), min = quotient(dfa, groups);
  const words = allStrings(alphabet, alphabet.length === 2 ? 8 : 5);
  const sameLang = words.every(w => accepts(dfa, w) === accepts(min, w));
  const minimal = groups.length === nerodeClasses(dfa, r, words);
  if (sameLang && minimal) pass++; else { fail++; console.log('FAIL', JSON.stringify(dfa)); }
}
console.log(`Random DFA tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
