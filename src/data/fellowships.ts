// Curated fellowships and scholarships for ExamArchive students.
// Deadlines verified against the official portals on 2026-11-24.
// This is a static list, NOT scraped: each entry is checked by hand when
// a cycle opens or closes. To update it, edit this file and redeploy.
// Amounts are the standard published rates for each scheme.

export type FellowshipSection = "research" | "scholarship";
export type FellowshipGroup = "national" | "institutions" | "scholarships";

export interface Fellowship {
  id: string;
  name: string;
  provider: string;
  section: FellowshipSection;
  group: FellowshipGroup;
  level: string;
  amount: string;
  eligibility: string;
  /** ISO date (YYYY-MM-DD) of the last date to apply, or null when there is no fixed date. */
  deadline: string | null;
  /** Human-readable deadline/status line shown on the card. */
  deadlineLabel: string;
  /** Extra line shown under the deadline, e.g. the next cycle. */
  note?: string;
  /** Official apply / information URL. Never a third-party link. */
  applyUrl: string;
}

export const FELLOWSHIPS_LAST_VERIFIED = "24 Nov 2026";

export const FELLOWSHIPS: Fellowship[] = [
  // ---- Research fellowships: national ----
  {
    id: "ugc-net-jrf",
    name: "UGC NET JRF — December 2026",
    provider: "NTA / UGC",
    section: "research",
    group: "national",
    level: "PG · PhD",
    amount: "Rs 37,000/month",
    eligibility:
      "Master's degree with 55% (50% for reserved categories); JRF age up to 30. Qualifies for JRF, Assistant Professor and PhD admission in 87 subjects.",
    deadline: "2026-10-31",
    deadlineLabel: "Closed 31 Oct 2026 · Exam 14–21 Dec 2026",
    note: "Next cycle: June 2027.",
    applyUrl: "https://ugcnet.nta.nic.in",
  },
  {
    id: "csir-net-jrf",
    name: "Joint CSIR-UGC NET JRF — December 2026",
    provider: "NTA / CSIR",
    section: "research",
    group: "national",
    level: "PG · PhD",
    amount: "Rs 37,000/month",
    eligibility:
      "M.Sc. or equivalent in a science subject. Qualifies for JRF, Assistant Professor and PhD admission.",
    deadline: "2026-11-09",
    deadlineLabel: "Closed 9 Nov 2026 (extended) · Exam 19, 22, 27 Dec 2026",
    note: "Next cycle: June 2027.",
    applyUrl: "https://csirnet.nta.nic.in",
  },
  {
    id: "dbt-jrf-bet",
    name: "DBT JRF — Biotechnology Eligibility Test (BET)",
    provider: "Dept. of Biotechnology / NTA",
    section: "research",
    group: "national",
    level: "PhD",
    amount: "Rs 37,000/month · 275 fellowships",
    eligibility:
      "M.Sc. in Biotechnology or Life Sciences. BET is the national test for the DBT Junior Research Fellowship.",
    deadline: "2026-04-09",
    deadlineLabel: "2026 cycle closed 9 Apr 2026 · Exam was 17 May 2026",
    note: "Next cycle: around Mar 2027. Applications run on the NTA exam portal.",
    applyUrl: "https://exams.nta.ac.in/",
  },
  {
    id: "icmr-jrf-bret",
    name: "ICMR JRF — now DHR-BRET",
    provider: "Dept. of Health Research / AIIMS",
    section: "research",
    group: "national",
    level: "PhD",
    amount: "JRF fellowship at DHR rates",
    eligibility:
      "M.Sc. in Life Sciences or a related subject. The old ICMR JRF exam is now the DHR Biomedical Research Eligibility Test (DHR-BRET).",
    deadline: null,
    deadlineLabel: "Notification expected Nov 2026 · Exam expected Jan 2027",
    note: "Look for the DHR-BRET listing, not ICMR JRF.",
    applyUrl: "https://aiimsexams.ac.in",
  },
  {
    id: "inspire-fellowship",
    name: "DST INSPIRE Fellowship",
    provider: "Dept. of Science & Technology",
    section: "research",
    group: "national",
    level: "PhD",
    amount: "Rs 37,000/month (JRF) · 1,000 fellowships, up to 5 years",
    eligibility:
      "1st-rank holders, top 1% in PG, or GATE / NET qualified in science. For PhD in basic and applied sciences.",
    deadline: "2026-05-23",
    deadlineLabel: "2025 call closed 23 May 2026",
    note: "Next call: around Apr 2027.",
    applyUrl: "https://online-inspire.gov.in",
  },
  {
    id: "pmrf",
    name: "Prime Minister's Research Fellowship (PMRF)",
    provider: "Ministry of Education",
    section: "research",
    group: "national",
    level: "PhD",
    amount: "Rs 70,000–80,000/month + Rs 2 lakh/year research grant",
    eligibility:
      "PhD at an IIT, IISc, IISER or top NIT / CFTI with CGPA 8.0+. Your institute must nominate you — you cannot apply directly first.",
    deadline: null,
    deadlineLabel: "December 2026 cycle — check the portal",
    note: "Two cycles a year (May and December).",
    applyUrl: "https://www.pmrf.in",
  },
  // ---- Research fellowships: top institutions (PhD admissions) ----
  {
    id: "iisc-phd",
    name: "IISc PhD Admissions — January 2027",
    provider: "Indian Institute of Science, Bengaluru",
    section: "research",
    group: "institutions",
    level: "PhD",
    amount: "Fellowship as per funding agency (CSIR / UGC / INSPIRE / PMRF)",
    eligibility:
      "Master's or 4-year Bachelor's in Science or Engineering; GATE / NET / JEST as per department.",
    deadline: "2026-10-26",
    deadlineLabel: "Closed 26 Oct 2026 · Session from 1 Jan 2027",
    note: "Next round: August 2027 (applications around Feb 2027).",
    applyUrl: "https://www.iisc.ac.in/admissions/",
  },
  {
    id: "tifr-gs",
    name: "TIFR Graduate School Admissions (GS-2027)",
    provider: "Tata Institute of Fundamental Research, Mumbai",
    section: "research",
    group: "institutions",
    level: "PhD · Integrated PhD",
    amount: "TIFR fellowship",
    eligibility:
      "M.Sc. in Science, or a 4-year Bachelor's degree with 75%+ for direct PhD. Physics, Chemistry, Biology, Maths, Computer Science and more.",
    deadline: "2026-10-25",
    deadlineLabel: "Closed 25 Oct 2026 · Entrance exam 13 Dec 2026",
    note: "Next: GS-2028 (around Sep 2027).",
    applyUrl: "https://www.tifr.res.in/academics/",
  },
  {
    id: "iiser-phd",
    name: "IISER PhD Admissions — January 2027",
    provider: "IISERs (Pune, Mohali and others)",
    section: "research",
    group: "institutions",
    level: "PhD",
    amount: "CSIR / UGC / INSPIRE fellowship or institute fellowship",
    eligibility:
      "Master's in Science (60%+) with a valid national fellowship or exam (NET / GATE / JEST / INSPIRE).",
    deadline: "2026-11-06",
    deadlineLabel: "Closed — Pune 25 Oct, Mohali 6 Nov 2026",
    note: "Each IISER runs its own dates and portal; the link below is IISER Pune.",
    applyUrl: "https://www.iiserpune.ac.in/education/admissions/phd-programme",
  },
  {
    id: "aus-phd",
    name: "Assam University PhD Admission 2026-27",
    provider: "Assam University, Silchar",
    section: "research",
    group: "institutions",
    level: "PhD",
    amount: "Non-NET fellowship (subject to UGC funding)",
    eligibility:
      "Master's with 55% (5% relaxation for reserved categories); selection through NET / SLET / RET plus interview.",
    deadline: "2026-09-13",
    deadlineLabel: "Closed 13 Sep 2026",
    note: "Next cycle: 2027-28 (around Aug–Sep 2027).",
    applyUrl: "https://www.ausexamination.ac.in/admission",
  },
  // ---- Scholarships (UG) ----
  {
    id: "inspire-she",
    name: "INSPIRE Scholarship for Higher Education (SHE)",
    provider: "Dept. of Science & Technology",
    section: "scholarship",
    group: "scholarships",
    level: "UG",
    amount: "Rs 80,000/year (Rs 60,000 + Rs 20,000 mentorship)",
    eligibility:
      "Class 12 (2025 pass) in the top 1%, or a JEE / NEET rank holder, pursuing B.Sc. / BS / Integrated M.Sc. in Natural or Basic Sciences. 12,000 scholarships.",
    deadline: "2026-12-07",
    deadlineLabel: "Open — last date 7 Dec 2026",
    applyUrl: "https://online-inspire.gov.in",
  },
  {
    id: "ishan-uday",
    name: "Ishan Uday Special Scholarship (NER)",
    provider: "UGC via National Scholarship Portal",
    section: "scholarship",
    group: "scholarships",
    level: "UG",
    amount: "Rs 5,400–7,800/month · 10,000 scholarships",
    eligibility:
      "Domicile of a North Eastern state; first-year UG (general, technical or professional course); family income up to Rs 4.5 lakh/year.",
    deadline: "2026-11-30",
    deadlineLabel: "Open — last date 30 Nov 2026 (extended)",
    applyUrl: "https://scholarships.gov.in",
  },
  {
    id: "nsp",
    name: "National Scholarship Portal (NSP)",
    provider: "Government of India",
    section: "scholarship",
    group: "scholarships",
    level: "UG · PG · PhD",
    amount: "Varies by scheme",
    eligibility:
      "One portal for 100+ central scholarships — merit, means and category-based schemes from Class 9 to PhD.",
    deadline: null,
    deadlineLabel: "Most 2026-27 central schemes closed 31 Oct 2026 — check the portal for open schemes",
    applyUrl: "https://scholarships.gov.in",
  },
];
