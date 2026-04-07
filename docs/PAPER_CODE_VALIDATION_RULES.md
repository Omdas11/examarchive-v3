# PAPER_CODE_VALIDATION_RULES.md

Strict validation and parsing rules for Assam University FYUG paper codes used by ExamArchive.

---

## Canonical Format

**Example:** `PHYDSC101T`

| Segment          | Position | Length   | Description                                  |
|------------------|----------|----------|----------------------------------------------|
| Subject code     | 1–3      | 3 chars  | Uppercase department prefix (e.g., `PHY`)    |
| Paper type       | 4–6      | 3 chars  | Allowed type bucket (e.g., `DSC`)            |
| Semester code    | 7–9      | 3 digits | Sequence block mapping to semester (e.g., `101`) |
| Component suffix | 10+      | variable | Optional trailing marker (e.g., `T` for Theory) |

---

## Allowed Paper Types

| Code  | Full Name                          |
|-------|------------------------------------|
| `DSC` | Discipline Specific Core           |
| `DSM` | Discipline Specific Minor          |
| `SEC` | Skill Enhancement Course           |
| `IDC` | Interdisciplinary Course           |
| `AEC` | Ability Enhancement Course         |
| `VAC` | Value Added Course                 |

Any other type (e.g., `XYZ`, `GEN`) → **reject**.

---

## Semester Code Mapping

| Semester Code | Semester No | Notes                        |
|---------------|-------------|------------------------------|
| `101`         | 1           | Also supports `102`, `103`…  |
| `151`         | 2           | Also supports `152`, `153`…  |
| `201`         | 3           | Also supports `202`, `203`…  |
| `251`         | 4           | Also supports `252`, `253`…  |
| `301`         | 5           | Also supports `302`, `303`…  |
| `351`         | 6           | Also supports `352`, `353`…  |
| `401`         | 7           | Also supports `402`, `403`…  |
| `451`         | 8           | Also supports `452`, `453`…  |

**Rule:** The first digit of the semester code determines the semester group.
- `1xx` → Semester 1 or 2
- `2xx` → Semester 3 or 4
- etc.

**Precise mapping:** use the hundreds+tens digit pattern:
- `10x` → Semester 1
- `15x` → Semester 2
- `20x` → Semester 3
- `25x` → Semester 4
- `30x` → Semester 5
- `35x` → Semester 6
- `40x` → Semester 7
- `45x` → Semester 8

---

## Regex (Baseline)

Use for structural validation:

```
^([A-Z]{3})(DSC|DSM|SEC|IDC|AEC|VAC)(10[1-9]|15[1-9]|20[1-9]|25[1-9]|30[1-9]|35[1-9]|40[1-9]|45[1-9])([A-Z0-9]*)$
```

This validates:
- 3-char subject code
- Allowed type code
- Valid semester range within each block (01–09 slots)
- Optional suffix

---

## Parse Output (Required)

On valid code, parser must return:

```yaml
paper_code: "PHYDSC101T"
subject_code: "PHY"
paper_type: "DSC"
semester_code: "101"
semester_no: 1
component_suffix: "T"
```

On invalid code, parser must return:

```yaml
paper_code: "<input>"
valid: false
error_code: "ERR_INVALID_TYPE"
error_message: "Paper type 'XYZ' is not in the allowed set."
```

---

## Validation Flow

```
1. Trim whitespace, convert to uppercase
2. Run regex structural check
3. Extract segments: subject_code, paper_type, semester_code, component_suffix
4. Validate paper_type against allowed set (DSC/DSM/SEC/IDC/AEC/VAC)
5. Validate semester_code against mapping table
6. (Optional) Validate subject_code against known department dictionary
7. If all pass → return parsed object
8. If any fail → return error with code + message
```

---

## Error Codes

| Code                       | Trigger Condition                                       |
|----------------------------|---------------------------------------------------------|
| `ERR_EMPTY_CODE`           | Input is null or empty string                           |
| `ERR_FORMAT_INVALID`       | Does not match structural regex                         |
| `ERR_INVALID_TYPE`         | Paper type not in allowed set                           |
| `ERR_INVALID_SEMESTER_CODE`| Semester digits not in valid range for any semester     |
| `ERR_INVALID_SUBJECT_CODE` | Subject code not recognized in department dictionary    |
| `ERR_UNSUPPORTED_SUFFIX`   | Trailing chars fail custom suffix policy (if enforced)  |

---

## Edge Cases

| Input             | Expected Behaviour                              |
|-------------------|-------------------------------------------------|
| `phydsc101t`      | Normalize to uppercase → `PHYDSC101T` → valid   |
| `  PHYDSC101T  ` | Trim whitespace → `PHYDSC101T` → valid          |
| `PHYDSC111T`      | `111` not in valid semester range → reject       |
| `PHYXYZ101T`      | `XYZ` not allowed type → reject                 |
| `PHYDSC`          | Missing semester + suffix → format invalid       |
| `PHYADSC101T`     | Subject code 4 chars → format invalid            |

---

## Implementation Recommendations

- Parser must be deterministic and non-AI (no LLM calls in validation path).
- Log all invalid inputs with error code, raw input, and timestamp.
- Provide admin UI for quick manual correction of flagged entries.
- Re-run validation on all legacy records once parser is finalized.
- Expose parser as a utility function reusable across ingestion and browse APIs.
