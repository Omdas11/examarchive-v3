---
title: "Syllabus Registry"
description: "Single source of truth for syllabus metadata (paper code, name, programme, university, etc.). Update this table to propagate changes to the backend."
---

The table below powers syllabus metadata across the app. Add or update rows here; backend routes and automation read this file directly. Large datasets (500+ rows) are supported.

| paper_code | paper_name | semester | subject | credits | programme | university | category |
|------------|------------|----------|---------|---------|-----------|------------|----------|
| PHYDSC101T | Mathematical Physics - I | 1 | Physics | 3 | FYUGP | Assam University | DSC |
| PHYDSC102T | Mechanics | 1 | Physics | 3 | FYUGP | Assam University | DSC |
| MATDSM101  | Calculus | 1 | Mathematics | 4 | FYUGP | Assam University | DSM |
| SK101      | Digital Literacy | 1 | Skill Development | 2 | FYUGP | Assam University | SEC |

> Tip: Keep the header row intact. Only append/edit data rows. You may add additional columns; the backend will carry them through unchanged alongside the documented fields.
