# DFA Minimisation Simulator

Interactive web simulator that minimises a DFA and shows every step: validation, unreachable-state removal, partition refinement (with a live, colour-coded state diagram), the minimal DFA, and a string tester that runs both machines side by side.

**Course:** Automata Theory and Computability (CSCT 302), Bennett University
**Team:** Siddhartha Tikaigari (S24CSCU1740), Ayush Bharadwaj (S24CSCU0132)
**Faculty:** Ms. Priti Gupta

## Run
Open `DFA_minimisation_Sim/index.html` in a browser, or:
```bash
python3 -m http.server 8080 --directory DFA_minimisation_Sim
```
then visit http://localhost:8080

## Test
```bash
node tests/verify.mjs
```
Minimises 500 random DFAs and checks each result accepts the same language and is truly minimal.

## Contents
- `DFA_minimisation_Sim/` – the simulator (HTML, CSS, JavaScript; no dependencies)
- `tests/verify.mjs` – automated correctness tests
- `report/` – project report (PDF + HTML source)
- `HOW_TO_EXPLAIN.md` – viva / demo guide

Based on the original simulator by VanshMittal109.
