# Implementation Documentation Guide

## Goal

Implementation records should preserve enough context that a future developer
can answer:

- What exists?
- Why does it exist?
- Where is it implemented?
- Which contracts does it rely on?
- How is it tested or validated?
- What is intentionally absent?
- What would be risky to change?
- What should happen next?

They are not commit messages, task checklists, or copies of the project plan.

## Organization

Use one directory per project-plan phase:

```text
implementation/
└── phase-NN-short-name/
    ├── README.md
    ├── subsystem-a.md
    └── subsystem-b.md
```

The phase `README.md` is a living overview. It tracks the phase’s status and
ties its focused records together.

A focused record should be created when work introduces one of the following:

- an architectural boundary;
- a data model;
- a persistence mechanism;
- an external integration;
- a major user workflow;
- a reusable UI system;
- a computation or recommendation subsystem;
- a deployment or operational concern.

Do not create a document for every component or utility. Related files should
be documented together under the subsystem that owns their behavior.

## Required phase-overview sections

Every phase overview should contain:

1. **Status**
2. **Objective**
3. **Implemented scope**
4. **Out of scope**
5. **Implementation records**
6. **Important decisions**
7. **Validation**
8. **Known limitations**
9. **Exit criteria**
10. **Next phase dependencies**
11. **Relevant commits**

## Required focused-record sections

Focused records should contain, where relevant:

1. **Summary**
2. **Problem being solved**
3. **Implemented behavior**
4. **Architecture and data flow**
5. **File ownership**
6. **Public interfaces or schemas**
7. **Important decisions**
8. **Rejected or deferred alternatives**
9. **Error handling**
10. **Performance considerations**
11. **Validation**
12. **Known limitations**
13. **Safe extension points**
14. **Follow-up work**
15. **Relevant commits**

The template under `templates/` provides a starting point.

## Status vocabulary

Use one of:

- **Not started**
- **In progress**
- **Complete**
- **Complete for MVP**
- **Superseded**
- **Blocked**

If a phase is partially complete, state exactly which exit criteria remain.

## Writing rules

### Document actual behavior

Use:

> `HttpRankingRepository` builds the ranking URL from cup, category, and CP.

Avoid:

> We will probably load rankings somehow.

Future ideas belong under follow-up or deferred work.

### Name concrete files

Use repository-relative paths:

```text
team-lab/src/pvpoke/repositories/http.ts
```

Explain why the file owns the behavior, not merely that it exists.

### Preserve boundary decisions

When a subsystem crosses a boundary, document:

- raw external input;
- validation;
- normalization;
- internal output;
- error behavior;
- versioning.

### Record unexpected source behavior

If implementation discovers an upstream inconsistency, record it.

Current examples:

- `buffApplyChance` is serialized as a numeric string.
- selected ranking move-usage counts may be `null`.

These discoveries explain why schemas or normalizers differ from an idealized
model.

### Keep validation reproducible

List exact commands:

```bash
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

Where useful, record important observed counts or outputs.

### Distinguish absence from failure

Examples:

- unranked does not necessarily mean ineligible;
- no published default IV spread does not necessarily mean invalid;
- a deferred feature is not an implementation bug.

### Update rather than append blindly

These documents are living references. When behavior changes:

- update the primary description;
- add a dated decision note only when historical context matters;
- mark old approaches as superseded;
- avoid leaving contradictory descriptions.

## Relationship to Git

Commit hashes are useful evidence but not the structure of the documentation.

Documents should remain understandable if commits are squashed or branches are
renamed. Prefer describing behavior and listing the current owning files.

## Definition of done

An implementation slice is documented when:

- the phase overview reflects its status;
- the owning focused record describes actual behavior;
- files and contracts are listed;
- validation is recorded;
- limitations and follow-up work are explicit;
- the implementation index links the record.
