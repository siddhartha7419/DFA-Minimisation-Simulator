const $ = id => document.getElementById(id);
let simulation = null;
let visibleStep = 0;

function parseList(value) {
  return [...new Set(value.split(',').map(x => x.trim()).filter(Boolean))];
}
function parseDFA() {
  const states = parseList($('states').value);
  const alphabet = parseList($('alphabet').value);
  const start = $('start').value.trim();
  const finals = parseList($('finals').value);
  const transitions = {};
  const errors = [];
  if (!states.length) errors.push('Enter at least one state.');
  if (!alphabet.length) errors.push('Enter at least one input symbol.');
  if (!states.includes(start)) errors.push(`Start state "${start}" is not in the state list.`);
  finals.forEach(s => { if (!states.includes(s)) errors.push(`Final state "${s}" is not in the state list.`); });
  states.forEach(s => transitions[s] = {});
  const lines = $('transitions').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  lines.forEach((line, index) => {
    const match = line.match(/^(.+?)\s*,\s*(.+?)\s*(?:->|→)\s*(.+?)$/);
    if (!match) { errors.push(`Line ${index + 1}: use the format "state, symbol -> destination".`); return; }
    const [, from, symbol, to] = match.map(x => x.trim());
    if (!states.includes(from)) errors.push(`Line ${index + 1}: unknown source state "${from}".`);
    else if (!alphabet.includes(symbol)) errors.push(`Line ${index + 1}: symbol "${symbol}" is not in the alphabet.`);
    else if (!states.includes(to)) errors.push(`Line ${index + 1}: unknown destination state "${to}".`);
    else if (transitions[from][symbol]) errors.push(`Line ${index + 1}: duplicate transition for ${from} on ${symbol}.`);
    else transitions[from][symbol] = to;
  });
  states.forEach(s => alphabet.forEach(a => {
    if (!transitions[s][a]) errors.push(`Missing transition: δ(${s}, ${a}).`);
  }));
  return { states, alphabet, start, finals, transitions, errors };
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function reachableStates(dfa) {
  const seen = new Set([dfa.start]), queue = [dfa.start];
  while (queue.length) {
    const s = queue.shift();
    dfa.alphabet.forEach(a => {
      const next = dfa.transitions[s][a];
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    });
  }
  return dfa.states.filter(s => seen.has(s));
}
function normalizeGroups(groups) {
  return groups.filter(g => g.length).map(g => [...g]);
}
function groupIndex(state, groups) {
  return groups.findIndex(group => group.includes(state));
}
function signature(state, dfa, groups) {
  return dfa.alphabet.map(a => groupIndex(dfa.transitions[state][a], groups)).join('|');
}
function refine(dfa, reachable) {
  const accepting = reachable.filter(s => dfa.finals.includes(s));
  const rejecting = reachable.filter(s => !dfa.finals.includes(s));
  let groups = normalizeGroups([rejecting, accepting]);
  const history = [{ title: 'Initial partition', groups: groups.map(g => [...g]), note: 'Separate final states from non-final states. States in different groups are already distinguishable.' }];
  let changed = true, round = 1;
  while (changed) {
    changed = false;
    const nextGroups = [];
    groups.forEach(group => {
      const buckets = new Map();
      group.forEach(state => {
        const key = signature(state, dfa, groups);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(state);
      });
      if (buckets.size > 1) changed = true;
      buckets.forEach(bucket => nextGroups.push(bucket));
    });
    if (changed) {
      groups = nextGroups;
      history.push({ title: `Refinement round ${round}`, groups: groups.map(g => [...g]), note: 'A group was split because its states transition to different partitions for at least one input symbol.' });
      round++;
    } else {
      history.push({ title: 'Stable partition', groups: groups.map(g => [...g]), note: 'No group can be split further. States inside each group are equivalent.' });
    }
  }
  return { groups, history };
}
function renderTransitionTable(dfa, states = dfa.states) {
  let html = `<table><thead><tr><th>STATE</th>${dfa.alphabet.map(a => `<th>δ( , ${escapeHTML(a)})</th>`).join('')}</tr></thead><tbody>`;
  states.forEach(s => {
    html += `<tr><td><span class="state-chip ${dfa.finals.includes(s) ? 'final-chip' : ''}">${s === dfa.start ? '→ ' : ''}${escapeHTML(s)}${dfa.finals.includes(s) ? ' ◎' : ''}</span></td>`;
    dfa.alphabet.forEach(a => html += `<td>${escapeHTML(dfa.transitions[s][a])}</td>`);
    html += '</tr>';
  });
  return html + '</tbody></table>';
}
function renderPartitions(groups) {
  return `<div class="partition-list">${groups.map((g, i) => `<div class="partition"><span class="partition-label">GROUP ${i + 1}</span><div class="partition-states">${g.map(s => `<span class="group-chip">${escapeHTML(s)}</span>`).join('')}</div></div>`).join('')}</div>`;
}
function runMinimization() {
  const dfa = parseDFA();
  $('verification').innerHTML = '';
  $('inputTable').innerHTML = '';
  $('partitionIntro').innerHTML = '';
  $('partitionSteps').innerHTML = '';
  $('minimizedResult').innerHTML = '';
  $('stepControls').hidden = true;
  if (dfa.errors.length) {
    $('verification').innerHTML = `<div class="info-box error-box"><strong>✕ DFA validation failed</strong><br><br>${dfa.errors.map(e => '• ' + escapeHTML(e)).join('<br>')}</div>`;
    simulation = null;
    return;
  }
  const reachable = reachableStates(dfa);
  const unreachable = dfa.states.filter(s => !reachable.includes(s));
  const { groups, history } = refine(dfa, reachable);
  simulation = { dfa, reachable, unreachable, groups, history };
  $('verification').innerHTML = `<div class="info-box success-box"><strong>✓ Valid deterministic finite automaton</strong><br><br>States: ${dfa.states.length} &nbsp; · &nbsp; Alphabet: { ${dfa.alphabet.map(escapeHTML).join(', ')} }<br>Start state: <strong>${escapeHTML(dfa.start)}</strong> &nbsp; · &nbsp; Final states: <strong>${dfa.finals.map(escapeHTML).join(', ') || 'None'}</strong><br>Reachable states: <strong>${reachable.length}</strong> &nbsp; · &nbsp; Unreachable states: <strong>${unreachable.length}</strong></div>${unreachable.length ? `<div class="info-box warning-box" style="margin-top:10px"><strong>Unreachable states removed:</strong> ${unreachable.map(escapeHTML).join(', ')}</div>` : ''}`;
  $('inputTable').innerHTML = renderTransitionTable(dfa);
  $('partitionIntro').innerHTML = `<div class="info-box">The algorithm works only with reachable states. The initial partition separates final and non-final states, then repeatedly checks where each state goes under every alphabet symbol.</div>`;
  renderStepCards();
  renderMinimized();
}
function renderStepCards() {
  const { history } = simulation;
  $('partitionSteps').innerHTML = history.map((step, i) => `<div class="step-card ${i === visibleStep ? 'active' : ''}" data-step="${i}"><div class="step-top"><div class="step-title">${i + 1}. ${escapeHTML(step.title)}</div><span class="step-tag">${i === history.length - 1 ? 'RESULT' : 'PARTITION'}</span></div>${renderPartitions(step.groups)}<div class="step-note">${escapeHTML(step.note)}</div></div>`).join('');
  $('stepControls').hidden = false;
  $('stepCounter').textContent = `Step ${visibleStep + 1} of ${history.length}`;
  $('prevStep').disabled = visibleStep === 0;
  $('nextStep').disabled = visibleStep === history.length - 1;
  $('partitionSteps').querySelectorAll('.step-card').forEach((el, i) => el.classList.toggle('active', i === visibleStep));
}
function renderMinimized() {
  const { dfa, groups, reachable, unreachable } = simulation;
  const nameOf = new Map();
  groups.forEach((g, i) => g.forEach(s => nameOf.set(s, `Q${i}`)));
  const minStart = nameOf.get(dfa.start);
  const minFinals = groups.map((g, i) => g.some(s => dfa.finals.includes(s)) ? `Q${i}` : null).filter(Boolean);
  const rows = groups.map((g, i) => {
    const representative = g[0];
    return { name: `Q${i}`, members: g, transitions: dfa.alphabet.map(a => nameOf.get(dfa.transitions[representative][a])) };
  });
  let table = `<table><thead><tr><th>MINIMISED STATE</th><th>ORIGINAL STATES</th>${dfa.alphabet.map(a => `<th>ON ${escapeHTML(a)}</th>`).join('')}</tr></thead><tbody>`;
  rows.forEach(row => {
    table += `<tr><td><span class="state-chip ${minFinals.includes(row.name) ? 'final-chip' : ''}">${row.name === minStart ? '→ ' : ''}${row.name}${minFinals.includes(row.name) ? ' ◎' : ''}</span></td><td>${row.members.map(escapeHTML).join(', ')}</td>${row.transitions.map(t => `<td>${t}</td>`).join('')}</tr>`;
  });
  table += '</tbody></table>';
  $('minimizedResult').innerHTML = `<div class="info-box success-box"><strong>✓ Minimisation complete</strong><br><br>Original states: <strong>${dfa.states.length}</strong> &nbsp; → &nbsp; Minimal states: <strong>${groups.length}</strong><br>States removed as unreachable: <strong>${unreachable.length}</strong><br>Equivalent states merged: <strong>${reachable.length - groups.length}</strong></div><div class="result-grid" style="margin-top:13px"><div class="result-panel"><h3>Final equivalence classes</h3>${renderPartitions(groups)}<p>Each group represents one state in the minimal DFA.</p></div><div class="result-panel"><h3>Minimal DFA details</h3><p>Start state: <strong>${minStart}</strong><br>Final states: <strong>${minFinals.join(', ') || 'None'}</strong><br>Alphabet: { ${dfa.alphabet.map(escapeHTML).join(', ')} }</p><p>State count reduced from ${dfa.states.length} to ${groups.length}.</p></div></div><div class="table-wrap">${table}</div>`;
}
function loadExample() {
  $('states').value = 'A, B, C, D, E, F, G';
  $('alphabet').value = '0, 1';
  $('start').value = 'A';
  $('finals').value = 'C, F';
  $('transitions').value = `A, 0 -> B
A, 1 -> C
B, 0 -> A
B, 1 -> D
C, 0 -> E
C, 1 -> F
D, 0 -> E
D, 1 -> F
E, 0 -> E
E, 1 -> F
F, 0 -> F
F, 1 -> F
G, 0 -> G
G, 1 -> G`;
  runMinimization();
}
$('runBtn').addEventListener('click', () => { visibleStep = 0; runMinimization(); });
$('exampleBtn').addEventListener('click', loadExample);
$('clearBtn').addEventListener('click', () => {
  simulation = null; visibleStep = 0;
  $('verification').innerHTML = '<div class="empty-state"><div class="empty-icon">Σ</div>Enter an automaton and run minimisation to begin.</div>';
  $('inputTable').innerHTML = ''; $('partitionIntro').innerHTML = ''; $('partitionSteps').innerHTML = '';
  $('stepControls').hidden = true;
  $('minimizedResult').innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div>Your minimized automaton will appear here.</div>';
});
$('prevStep').addEventListener('click', () => { if (simulation && visibleStep > 0) { visibleStep--; renderStepCards(); } });
$('nextStep').addEventListener('click', () => { if (simulation && visibleStep < simulation.history.length - 1) { visibleStep++; renderStepCards(); } });
$('allSteps').addEventListener('click', () => { if (simulation) { visibleStep = simulation.history.length - 1; renderStepCards(); } });
loadExample();

/* ===================== Visual layer: state diagrams + string tester ===================== */
const GROUP_COLORS = ['#a78bfa', '#22d3ee', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#f472b6', '#a3e635', '#fb923c', '#2dd4bf'];

function renderDiagram(dfa, opts = {}) {
  const states = opts.states || dfa.states;
  const n = states.length, W = 560, H = n <= 2 ? 220 : 380, cx = W / 2, cy = H / 2, r = 23;
  const R = n <= 1 ? 0 : n === 2 ? 130 : Math.min(W, H) / 2 - 62;
  const pos = {};
  states.forEach((s, i) => {
    const ang = n === 2 ? Math.PI * i : -Math.PI / 2 - Math.PI + (2 * Math.PI * i) / n;
    pos[s] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
  const edges = new Map();
  states.forEach(s => dfa.alphabet.forEach(a => {
    const t = dfa.transitions[s][a];
    if (!(t in pos)) return;
    const k = s + '\u0000' + t;
    if (!edges.has(k)) edges.set(k, { from: s, to: t, labels: [] });
    edges.get(k).labels.push(a);
  }));
  const hiEdges = opts.highlightEdges || new Set();
  let svgEdges = '', svgLabels = '';
  edges.forEach(e => {
    const p = pos[e.from], q = pos[e.to], label = escapeHTML(e.labels.join(', '));
    const hot = hiEdges.has(e.from + '\u0000' + e.to) ? ' hot' : '';
    if (e.from === e.to) {
      let ox = p.x - cx, oy = p.y - cy; const len = Math.hypot(ox, oy) || 1;
      if (n === 1) { ox = 0; oy = -1; } else { ox /= len; oy /= len; }
      const px = -oy, py = ox, a1 = { x: p.x + r * (ox * .8 + px * .6), y: p.y + r * (oy * .8 + py * .6) };
      const a2 = { x: p.x + r * (ox * .8 - px * .6), y: p.y + r * (oy * .8 - py * .6) };
      const c1 = { x: p.x + ox * 70 + px * 32, y: p.y + oy * 70 + py * 32 }, c2 = { x: p.x + ox * 70 - px * 32, y: p.y + oy * 70 - py * 32 };
      svgEdges += `<path class="edge${hot}" d="M${a1.x},${a1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${a2.x},${a2.y}" marker-end="url(#arrow${hot ? '-hot' : ''})"/>`;
      svgLabels += `<text class="edge-label" x="${p.x + ox * 66}" y="${p.y + oy * 66 + 4}">${label}</text>`;
      return;
    }
    const both = edges.has(e.to + '\u0000' + e.from);
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const off = both ? 34 : 12, c = { x: (p.x + q.x) / 2 + nx * off, y: (p.y + q.y) / 2 + ny * off };
    const sv = { x: c.x - p.x, y: c.y - p.y }, sl = Math.hypot(sv.x, sv.y), ev = { x: c.x - q.x, y: c.y - q.y }, el = Math.hypot(ev.x, ev.y);
    const s0 = { x: p.x + sv.x / sl * r, y: p.y + sv.y / sl * r }, e0 = { x: q.x + ev.x / el * (r + 3), y: q.y + ev.y / el * (r + 3) };
    svgEdges += `<path class="edge${hot}" d="M${s0.x},${s0.y} Q${c.x},${c.y} ${e0.x},${e0.y}" marker-end="url(#arrow${hot ? '-hot' : ''})"/>`;
    const lx = .25 * p.x + .5 * c.x + .25 * q.x, ly = .25 * p.y + .5 * c.y + .25 * q.y;
    svgLabels += `<text class="edge-label" x="${lx}" y="${ly + 4}">${label}</text>`;
  });
  let svgNodes = '';
  states.forEach(s => {
    const p = pos[s], color = opts.colorOf ? opts.colorOf(s) : null, dim = opts.dim && opts.dim.has(s);
    const active = opts.active === s, fin = dfa.finals.includes(s);
    if (s === dfa.start) {
      let ox = p.x - cx, oy = p.y - cy; const len = Math.hypot(ox, oy);
      if (len < 1) { ox = -1; oy = 0; } else { ox /= len; oy /= len; }
      svgEdges += `<path class="edge start-edge" d="M${p.x + ox * (r + 38)},${p.y + oy * (r + 38)} L${p.x + ox * (r + 4)},${p.y + oy * (r + 4)}" marker-end="url(#arrow)"/>`;
    }
    const style = color ? `style="--node:${color}"` : '';
    svgNodes += `<g class="node${fin ? ' final' : ''}${dim ? ' dim' : ''}${active ? ' active' : ''}${color ? ' colored' : ''}" ${style}>
      <circle cx="${p.x}" cy="${p.y}" r="${r}"/>${fin ? `<circle class="ring" cx="${p.x}" cy="${p.y}" r="${r - 5}"/>` : ''}
      <text x="${p.x}" y="${p.y + 4.5}">${escapeHTML(s)}</text></g>`;
  });
  return `<svg class="diagram" viewBox="0 0 ${W} ${H}" role="img" aria-label="State diagram">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker>
    <marker id="arrow-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#22d3ee"/></marker></defs>
    ${svgEdges}${svgLabels}${svgNodes}</svg>`;
}

function buildMinimalDFA(sim) {
  const { dfa, groups } = sim, nameOf = new Map();
  groups.forEach((g, i) => g.forEach(s => nameOf.set(s, `Q${i}`)));
  const states = groups.map((_, i) => `Q${i}`), transitions = {};
  groups.forEach((g, i) => { transitions[`Q${i}`] = {}; dfa.alphabet.forEach(a => transitions[`Q${i}`][a] = nameOf.get(dfa.transitions[g[0]][a])); });
  return { states, alphabet: dfa.alphabet, start: nameOf.get(dfa.start), transitions,
    finals: groups.map((g, i) => g.some(s => dfa.finals.includes(s)) ? `Q${i}` : null).filter(Boolean), nameOf };
}

function trace(dfa, word) {
  const path = [dfa.start]; let s = dfa.start;
  for (const c of word) { s = dfa.transitions[s][c]; path.push(s); }
  return { path, accepted: dfa.finals.includes(s) };
}

function tokenize(raw, alphabet) {
  const text = raw.trim();
  if (!text) return { symbols: [] };
  if (/[\s,]/.test(text)) return { symbols: text.split(/[\s,]+/).filter(Boolean) };
  if (alphabet.every(a => a.length === 1)) return { symbols: [...text] };
  const out = []; let i = 0;
  const sorted = [...alphabet].sort((a, b) => b.length - a.length);
  while (i < text.length) { const m = sorted.find(a => text.startsWith(a, i)); if (!m) return { error: `Cannot read "${text.slice(i)}" with this alphabet.` }; out.push(m); i += m.length; }
  return { symbols: out };
}

function renderVisuals() {
  if (!simulation) return;
  const { dfa, reachable, unreachable, groups } = simulation;
  simulation.min = buildMinimalDFA(simulation);
  const colorOfFinal = s => GROUP_COLORS[groupIndex(s, groups) % GROUP_COLORS.length];
  $('inputDiagram').innerHTML = `<div class="diagram-card"><div class="diagram-head"><span>Original DFA</span><span class="diagram-meta">${dfa.states.length} states${unreachable.length ? ` · unreachable faded` : ''}</span></div>${renderDiagram(dfa, { dim: new Set(unreachable) })}</div>`;
  $('compareDiagrams').innerHTML = `<div class="diagram-card"><div class="diagram-head"><span>Original (coloured by class)</span><span class="diagram-meta">${reachable.length} reachable</span></div>${renderDiagram(dfa, { states: reachable, colorOf: colorOfFinal })}</div>
    <div class="diagram-card accent"><div class="diagram-head"><span>Minimised DFA</span><span class="diagram-meta">${groups.length} states</span></div>${renderDiagram(simulation.min, { colorOf: q => GROUP_COLORS[Number(q.slice(1)) % GROUP_COLORS.length] })}</div>`;
  renderStepDiagram();
  $('tester').hidden = false;
  if (!$('testString').value) $('testString').value = dfa.alphabet.length && dfa.alphabet.every(a => a.length === 1) ? (dfa.alphabet[0] + dfa.alphabet[dfa.alphabet.length - 1]).repeat(2) : '';
  runTest();
  renderEquivalenceCheck();
}

function renderStepDiagram() {
  if (!simulation) return;
  const step = simulation.history[visibleStep];
  const col = s => { const i = groupIndex(s, step.groups); return i < 0 ? null : GROUP_COLORS[i % GROUP_COLORS.length]; };
  $('stepDiagram').innerHTML = `<div class="diagram-card"><div class="diagram-head"><span>Live partition view · ${escapeHTML(step.title)}</span><span class="diagram-meta">${step.groups.length} group${step.groups.length > 1 ? 's' : ''}</span></div>${renderDiagram(simulation.dfa, { states: simulation.reachable, colorOf: col })}</div>`;
  $('partitionSteps').querySelectorAll('.partition').forEach(el => {
    const card = el.closest('.step-card'), i = [...card.querySelectorAll('.partition')].indexOf(el);
    el.style.setProperty('--group', GROUP_COLORS[i % GROUP_COLORS.length]);
  });
}

function runTest() {
  if (!simulation) return;
  const { dfa, min } = simulation, tok = tokenize($('testString').value, dfa.alphabet);
  if (tok.error) { $('testResult').innerHTML = `<div class="info-box error-box">${escapeHTML(tok.error)}</div>`; return; }
  const bad = tok.symbols.find(c => !dfa.alphabet.includes(c));
  if (bad !== undefined) { $('testResult').innerHTML = `<div class="info-box error-box">Symbol "${escapeHTML(bad)}" is not in the alphabet { ${dfa.alphabet.map(escapeHTML).join(', ')} }.</div>`; return; }
  const a = trace(dfa, tok.symbols), b = trace(min, tok.symbols);
  const pathHTML = (t) => t.path.map((s, i) => `${i ? `<span class="path-sym">${escapeHTML(tok.symbols[i - 1])}</span>` : ''}<span class="path-state">${escapeHTML(s)}</span>`).join('');
  const verdict = t => `<span class="verdict ${t.accepted ? 'ok' : 'no'}">${t.accepted ? '✓ Accepted' : '✕ Rejected'}</span>`;
  const word = tok.symbols.length ? tok.symbols.join('') : 'ε (empty string)';
  $('testResult').innerHTML = `<div class="trace-grid">
     <div class="trace-card"><div class="trace-top"><strong>Original DFA</strong>${verdict(a)}</div><div class="path">${pathHTML(a)}</div></div>
     <div class="trace-card"><div class="trace-top"><strong>Minimised DFA</strong>${verdict(b)}</div><div class="path">${pathHTML(b)}</div></div></div>
     <div class="match ${a.accepted === b.accepted ? 'ok' : 'no'}">${a.accepted === b.accepted ? '✓ Both machines agree on' : '✕ Machines disagree on'} <code>${escapeHTML(word)}</code></div>`;
  const hotOf = path => new Set(path.slice(1).map((s, i) => path[i] + '\u0000' + s));
  $('traceDiagrams').innerHTML = `<div class="diagram-card"><div class="diagram-head"><span>Path in original</span></div>${renderDiagram(dfa, { states: simulation.reachable, highlightEdges: hotOf(a.path), active: a.path[a.path.length - 1] })}</div>
     <div class="diagram-card accent"><div class="diagram-head"><span>Path in minimised</span></div>${renderDiagram(min, { highlightEdges: hotOf(b.path), active: b.path[b.path.length - 1] })}</div>`;
}

function renderEquivalenceCheck() {
  const { dfa, min } = simulation;
  const maxLen = dfa.alphabet.length <= 2 ? 8 : dfa.alphabet.length <= 4 ? 5 : 3;
  let layer = [[]], count = 0, mismatch = null;
  for (let len = 0; len <= maxLen && !mismatch; len++) {
    for (const w of layer) { count++; if (trace(dfa, w).accepted !== trace(min, w).accepted) { mismatch = w; break; } }
    layer = layer.flatMap(w => dfa.alphabet.map(a => [...w, a]));
  }
  $('equivCheck').innerHTML = mismatch
    ? `<div class="info-box error-box">✕ Mismatch found on "${escapeHTML(mismatch.join(''))}".</div>`
    : `<div class="equiv-badge"><span class="equiv-icon">✓</span><div><strong>Language preserved</strong><br><span>Checked all ${count.toLocaleString()} strings up to length ${maxLen}: original and minimised DFA give identical results.</span></div></div>`;
}

// hook the visual layer into the existing flow
const _runMinimization = runMinimization;
runMinimization = function () {
  _runMinimization();
  if (!simulation) { ['inputDiagram', 'stepDiagram', 'compareDiagrams', 'testResult', 'traceDiagrams', 'equivCheck'].forEach(id => $(id).innerHTML = ''); $('tester').hidden = true; return; }
  renderVisuals();
};
const _renderStepCards = renderStepCards;
renderStepCards = function () { _renderStepCards(); renderStepDiagram(); };
$('testBtn').addEventListener('click', runTest);
$('testString').addEventListener('input', runTest);
$('clearBtn').addEventListener('click', () => { ['inputDiagram', 'stepDiagram', 'compareDiagrams', 'testResult', 'traceDiagrams', 'equivCheck'].forEach(id => $(id).innerHTML = ''); $('tester').hidden = true; });
runMinimization();
