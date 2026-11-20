# DFA Minimisation Simulator — run it & explain it (5-minute read)

## Run it
- Double-click `DFA_minimisation_Sim/index.html` (no install needed), or:
  `python3 -m http.server 8080 --directory DFA_minimisation_Sim` → open http://localhost:8080
- Tests: `node tests/verify.mjs` → "500 passed, 0 failed"
- Report: `report/DFA_Minimisation_Report.pdf` (fill in names on the cover in the .html, re-export)

## What the project is (one line)
Takes a DFA and gives the smallest equivalent DFA, showing every step.

## Files (only 3)
- `index.html` – the page: input form + 3 sections (Verification, Partition Refinement, Minimised DFA)
- `style.css` – looks only
- `script.js` – all logic:
  - `parseDFA()` – reads input, validates (unknown state, bad symbol, duplicate or missing transition)
  - `reachableStates()` – BFS from start; removes unreachable states (G in the example)
  - `refine()` – the algorithm: start {final}, {non-final}; split groups whose states go to different groups; repeat until nothing splits
  - `signature()` – for a state, the list of group numbers it goes to on each symbol. Same signature = stay together
  - `renderMinimized()` – each final group becomes one new state Q0, Q1…

## Demo script (in the viva)
1. Click **Load example** → 7 states A–G, finals C, F.
2. Section 01: valid DFA, G is unreachable → removed.
3. Section 02: click Next step:
   - P0 {A,B,D,E} {C,F}
   - P1 {A,D,E} {B} {C} {F} – B splits because on 1 it goes to D (non-final), others go to a final state
   - P2 {A} {D,E} {B} {C} {F} – A splits (goes to B and C), D and E go to same groups
   - Stable – nothing changes
4. Section 03: 7 → 5 states. D and E merged.
5. Show an error: delete one transition line, click Minimise → "Missing transition".

## Likely viva questions
- **Why remove unreachable states first?** They can never be reached from start, so they don't affect the language.
- **Why start with final / non-final?** A final and a non-final state are distinguished by the empty string ε.
- **When are two states equivalent?** For every string w, both end in final or both in non-final.
- **Why does it stop?** Each round only splits groups; at most n groups exist, so at most n−1 rounds.
- **Complexity?** O(n² · |Σ|) for this (Moore's) method. Hopcroft's is O(n |Σ| log n).
- **Is the minimal DFA unique?** Yes, up to renaming states (Myhill–Nerode theorem).
- **How do you know it's correct?** Hand-solved example matches, plus 500 random DFAs tested: same language and state count = Myhill–Nerode classes.
- **Limitations?** Only complete DFAs (no NFA, no missing transitions), no state-diagram drawing, no string tester in the UI.
