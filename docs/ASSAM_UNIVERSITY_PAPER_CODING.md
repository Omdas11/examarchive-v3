# Assam University (Haflong FYUG) Paper Coding Notes

This note documents the paper-code pattern used in this repository, based on:

- `./HAFLONG GOVERNMENT COLLEGE SYLLABUS.md`
- `./src/data/curriculum.json`

## Core code pattern

Typical major paper code shape:

`<DEPT><TYPE><NNN>T`

Examples:

- `PHYDSC351T`
- `CHMDSM251T`
- `MATSEC201T`

Where:

- `<DEPT>`: department prefix (`PHY`, `CHM`, `MAT`, etc.)
- `<TYPE>`: paper bucket (`DSC`, `DSM`, `SEC`, `IDC`, plus common `VAC`/`AEC`)
- `<NNN>`: syllabus sequence block that tracks semester progression in this FYUG structure
- `T`: theory suffix used in listed paper codes

## Semester progression used in this syllabus

From the Haflong FYUG table, the sequence blocks progress like this:

- Semester 1 → `101/102/...`
- Semester 2 → `151/152/...`
- Semester 3 → `201/202/...`
- Semester 4 → `251/252/...`
- Semester 5 → `301/302/...`
- Semester 6 → `351/352/...`
- Semester 7 → `401/402/...`
- Semester 8 → `451/452/...`

So `PHYDSC351T` belongs to **Semester 6**, not Semester 3.

## Implementation rule used in app logic

For semester mapping in AI dropdowns:

1. Prefer canonical mapping from `curriculum.json` (derived from Haflong syllabus table).
2. Only if a paper code is not present in canonical data, fallback to semester value from ingested DB rows.

This keeps selector behavior aligned with the official syllabus structure and avoids wrong semester options for known papers.
