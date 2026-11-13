# Tracked upstream calculation concerns

## Minior Core → Meteor form-level decrement

Status: reproducible in the current pin; retained as a documented upstream
follow-up for 1.4.0. No vendor patch or upstream report has been published by
this change. This issue is independent of Mega-level and extra-attack support.

Pin: `a9dfd500421cacf2842d54d8adcb15830c1eef2b`.
Source: `public/vendor/pvpoke/js/pokemon/Pokemon.js`, `getFormStats`, at the
form-level reduction loop. The condition checks
`this.activeFormId == "minior_core" || this.decrementer == "minior_meteor"`.
The second operand refers to a missing property instead of `activeFormId`.

Minimal reproducer, now part of `scripts/minior-form-change.test.ts`:

| Input/result | Value |
| --- | --- |
| Format | Open Great League, 1500 CP |
| Original build | Minior Core, level 20, IVs 15/15/15, CP 1310 |
| Target active form | `minior_meteor` |
| Initial transformed level | 38.5, above the cap |
| Pinned engine result | Effective level 37.5, transformed CP 1487 |
| Skipped legal half level | 38, transformed CP 1498 |

`changeForm` assigns the target `activeFormId` before invoking `getFormStats`.
The intended half-level branch would reach 38; the current whole-level step
skips it. The characterization compares the actual attack stat with the pinned
37.5 CPM and preserves the pin's script hashes. Existing browser replay checks
also cover the battle-start Meteor form and subsequent Core transition.

This proves a discrepancy with the apparent source intent; it does not establish
independent Pokémon GO form-change mechanics. TeamLab continues to reproduce the
pinned engine. Revisit on an upstream fix or pin advancement, run this reproducer
and both replay transitions, then document the new observed result before
changing the expectation. Do not silently patch the vendor file or remove the
characterization merely to make a refresh pass.
