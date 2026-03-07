/**
 * Central Syllabus Metadata Registry
 *
 * Each entry represents a course paper with its canonical metadata.
 * When users upload a syllabus PDF they only need to enter paper_code +
 * university; the rest of the metadata auto-fills from this registry.
 *
 * To add new entries, append objects conforming to SyllabusRegistryEntry.
 * Group entries by university → category for readability.
 *
 * See docs/syllabus-system.md for the full schema specification.
 */

/** A single unit (chapter) within a paper's syllabus. */
export interface SyllabusUnit {
  /** 1-based unit number. */
  unit: number;
  /** Unit title, e.g. "Vector Algebra and Matrices". */
  name: string;
  /** Number of lectures allocated to this unit, if known. */
  lectures?: number;
  /** List of topics / subtopics covered in this unit. */
  topics: string[];
}

export interface SyllabusRegistryEntry {
  /** Unique paper identifier, e.g. "PHYDSC101T". */
  paper_code: string;
  /** Full descriptive name of the paper. */
  paper_name: string;
  /** Semester number (1–8). */
  semester: number;
  /** Subject / disciplinary area (e.g. "Physics", "Mathematics"). */
  subject: string;
  /** Credit weighting for the paper. */
  credits: number;
  /** Academic programme framework (e.g. "FYUGP", "CBCS"). */
  programme: string;
  /** University or institution that offers this paper. */
  university: string;
  /** Paper category: "DSC" | "DSM" | "SEC" | "IDC" | "GE" etc. */
  category?: string;
  /** Total contact hours for the paper (lectures + tutorials). */
  contact_hours?: number;
  /** Maximum marks (full marks) for the paper. */
  full_marks?: number;
  /** Course objective / description. */
  course_objective?: string;
  /** Expected learning outcomes. */
  learning_outcomes?: string;
  /** Structured units with per-unit topics. */
  units?: SyllabusUnit[];
  /** Reference / recommended books. */
  reference_books?: string[];
}

// ── Registry entries ────────────────────────────────────────────────────────

export const SYLLABUS_REGISTRY: SyllabusRegistryEntry[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // ASSAM UNIVERSITY — Physics FYUGP
  // Source: Physics_Final_Syllabus (Assam University, NEP 2020 FYUGP)
  // ══════════════════════════════════════════════════════════════════════════

  // ── DSC (Discipline Specific Core) ─────────────────────────────────────

  // Semester I
  {
    paper_code: "PHYDSC101T",
    paper_name: "Mathematical Physics - I",
    semester: 1,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
    contact_hours: 45,
    full_marks: 100,
    course_objective:
      "The emphasis of the course is on various tools required for solving problems of interest to physicists. The course will teach the students to model a physics problem mathematically and then solve those numerically using computational methods. The course aims to expose the students to some fundamental mathematical tools enabling them to solve a wide range of physics problems.",
    learning_outcomes:
      "After completing this course, the students will be able to understand the concepts of vector algebras, vector calculus in addition to performing line, surface and volume integration and apply various theorems to compute these integrals. The students will also be able to understand concepts of curvilinear coordinates along with ideas of special functions and some numerical techniques.",
    units: [
      {
        unit: 1,
        name: "Vector Algebra and Matrices",
        lectures: 9,
        topics: [
          "Scalar and vector products, Physical interpretation of vector product.",
          "Scalar and vector triple products & their properties with physical interpretation.",
          "Derivation of important identities. Preliminary ideas of Scalar and Vector fields.",
          "Different types of matrices: Symmetric and antisymmetric matrices, Hermitian matrix and its properties.",
          "Inverse and transpose of matrices. Solution of simultaneous linear equations.",
          "Eigenvalue, Eigenvectors and diagonalization of a matrix.",
        ],
      },
      {
        unit: 2,
        name: "Ordinary Differential Equations",
        lectures: 9,
        topics: [
          "Order and Degrees of a differential equation.",
          "First Order ODE: General form of first order ODE Mdx + Ndy = 0, Separation of variables, Exact equation, in-exact equations and integrating factors, Linear equations.",
          "Second Order ODE: Homogeneous Equations with constant coefficients. Wronskian and general solution. Complementary function. Methods for finding particular integrals.",
        ],
      },
      {
        unit: 3,
        name: "Vector Calculus",
        lectures: 10,
        topics: [
          "Vector Differentiation: Directional derivatives and normal derivatives.",
          "Gradient of a scalar field and its geometrical interpretation.",
          "Divergence and curl of a vector field. Laplacian operator. Vector identities.",
          "Vector Integration: Ordinary Integrals of Vectors.",
          "Line, surface and volume integrals of Vector fields.",
          "Gauss's divergence theorem and Stokes Theorem.",
        ],
      },
      {
        unit: 4,
        name: "Orthogonal Curvilinear Coordinates",
        lectures: 8,
        topics: [
          "Definition and examples of Orthogonal Curvilinear Coordinates.",
          "Transformation from orthogonal curvilinear coordinate systems to Cartesian coordinate system and vice versa.",
          "Expressions for infinitesimal line, surface and volume elements.",
          "Derivation of Gradient, Divergence, Curl and Laplacian in curvilinear Coordinate Systems (Spherical & Cylindrical).",
        ],
      },
      {
        unit: 5,
        name: "Beta and Gamma Functions and Numerical Techniques",
        lectures: 9,
        topics: [
          "Beta and Gamma Functions: Beta and Gamma Functions and Relation between them.",
          "Expression of Integrals in terms of Gamma Functions.",
          "Solution of Algebraic and Transcendental equations by Bisection, Newton Raphson, Simpson Rule.",
          "Interpolation by Newton Gregory Forward & Backward difference formula.",
        ],
      },
    ],
    reference_books: [
      "Mathematical Physics by H.K. Dass, published by S. Chand.",
      "Mathematical Physics with Classical Mechanics by S. Prakash, published by Sultan Chand & Sons, Sixth edition.",
      "Mathematical Methods for Physicists, G.B. Arfken, H.J. Weber, F.E. Harris, 2013, 7th Edn Elsevier.",
      "Differential Equations, George F. Simmons, 2007, McGraw Hill.",
      "Differential Calculus by B.C. Das and B.N. Mukherjee, published by U.N. Dhur.",
      "Mathematical Tools for Physics, James Nearing, 2010, Dover Publications.",
      "Vector Analysis, by Murray R. Spiegel, published by McGraw Hill Education, part of the Schaum's Outlines Series.",
      "Engineering Mathematics, S. Pal and S.C. Bhunia, 2015, Oxford University Press.",
      "Advanced Engineering Mathematics, Erwin Kreyszig, 2008, Wiley India.",
      "Essential Mathematical Methods, K.F. Riley & M.P. Hobson, 2011, Cambridge Univ. Press.",
      "Mathematical methods for Scientists and Engineers, D.A. McQuarrie, 2003, Viva Book.",
      "Mathematical Physics, Goswami, 1st edition, Cengage Learning.",
    ],
  },

  {
    paper_code: "PHYDSC102T",
    paper_name: "Mechanics and Relativity",
    semester: 1,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // Semester II
  {
    paper_code: "PHYDSC151T",
    paper_name: "Electricity and Magnetism",
    semester: 2,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC152P",
    paper_name: "Lab.: (Part A: Mechanics + Part B: Electricity)",
    semester: 2,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // Semester III
  {
    paper_code: "PHYDSC201T",
    paper_name: "Waves and Optics",
    semester: 3,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC202T",
    paper_name: "Thermal Physics",
    semester: 3,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // Semester IV
  {
    paper_code: "PHYDSC251T",
    paper_name: "Mathematical Physics - II",
    semester: 4,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC252T",
    paper_name: "Electronics (Analog + Digital)",
    semester: 4,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC253P",
    paper_name: "Lab.: (Part A: Thermal Physics + Part B: Analog Electronics)",
    semester: 4,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // Semester V
  {
    paper_code: "PHYDSC301T",
    paper_name: "Modern Physics",
    semester: 5,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC302T",
    paper_name: "Introduction to Classical Mechanics and Electromagnetic Theory",
    semester: 5,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC303P",
    paper_name: "Lab.: (Part A: Ray Optics + Part B: Physical Optics)",
    semester: 5,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // Semester VI
  {
    paper_code: "PHYDSC351T",
    paper_name: "Nuclear and Particle Physics",
    semester: 6,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC352T",
    paper_name: "Statistical Mechanics and Plasma Physics",
    semester: 6,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC353T",
    paper_name: "Solid State Physics",
    semester: 6,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC354P",
    paper_name: "Lab.: (Part A: Solid State Physics + Part B: Digital Electronics)",
    semester: 6,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // Semester VII
  {
    paper_code: "PHYDSC401T",
    paper_name: "Mathematical Physics - III",
    semester: 7,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC402T",
    paper_name: "Classical Mechanics",
    semester: 7,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC403T",
    paper_name: "Quantum Mechanics - I",
    semester: 7,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC404P",
    paper_name: "Lab.: (Part A: Numerical Techniques & Programming including Quantum Mechanics + Part B: Simulation & Software based learning of electronics i.e. virtual Labs)",
    semester: 7,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // Semester VIII
  {
    paper_code: "PHYDSC451T",
    paper_name: "Quantum Mechanics - II",
    semester: 8,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC452T",
    paper_name: "Electromagnetic Theory",
    semester: 8,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC453AT",
    paper_name: "Astronomy, Astrophysics and Cosmology",
    semester: 8,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC453BT",
    paper_name: "Nano Science and Material Science",
    semester: 8,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },
  {
    paper_code: "PHYDSC454T",
    paper_name: "Atomic and Molecular Physics",
    semester: 8,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSC",
  },

  // ── DSM (Discipline Specific Minor) ────────────────────────────────────

  {
    paper_code: "PHYDSM101T",
    paper_name: "Mechanics, Relativity and Math Physics",
    semester: 1,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM151T",
    paper_name: "Mechanics, Relativity and Math Physics",
    semester: 2,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM201T",
    paper_name: "Electricity, Magnetism and Electronics",
    semester: 3,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM251P",
    paper_name: "Lab. (Mechanics + Optics) and (Electricity + Electronics)",
    semester: 4,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM252T",
    paper_name: "Electricity, Magnetism and Electronics",
    semester: 4,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM301T",
    paper_name: "Waves and Oscillations, Optics and Thermal Physics",
    semester: 5,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM302T",
    paper_name: "Waves and Oscillations, Optics and Thermal Physics",
    semester: 5,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM351P",
    paper_name: "Lab. (Mechanics + Optics) and (Electricity + Electronics)",
    semester: 6,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM401T",
    paper_name: "Modern Physics and Solid State Physics",
    semester: 7,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },
  {
    paper_code: "PHYDSM451T",
    paper_name: "Modern Physics and Solid State Physics",
    semester: 8,
    subject: "Physics",
    credits: 4,
    programme: "FYUGP",
    university: "Assam University",
    category: "DSM",
  },

  // ── SEC (Skill Enhancement Course) ─────────────────────────────────────

  {
    paper_code: "PHYSEC-101",
    paper_name: "Workshop Skill",
    semester: 1,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "SEC",
  },
  {
    paper_code: "PHYSEC-151",
    paper_name: "Electrical Circuits and Safety",
    semester: 2,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "SEC",
  },
  {
    paper_code: "PHYSEC-201",
    paper_name: "Renewable Energy and Energy Harvesting",
    semester: 3,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "SEC",
  },

  // ── IDC (Interdisciplinary Course) ─────────────────────────────────────

  {
    paper_code: "PHYIDC101T",
    paper_name: "Physics in Daily Life",
    semester: 1,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "IDC",
  },
  {
    paper_code: "PHYIDC151T",
    paper_name: "Understanding the Climate",
    semester: 2,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "IDC",
  },
  {
    paper_code: "PHYIDC201T",
    paper_name: "Renewable Energy and Energy Harvesting",
    semester: 3,
    subject: "Physics",
    credits: 3,
    programme: "FYUGP",
    university: "Assam University",
    category: "IDC",
  },
];

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Look up a registry entry by paper code and optional university.
 * Returns the first matching entry, or undefined if not found.
 */
export function findByPaperCode(
  paperCode: string,
  university?: string,
): SyllabusRegistryEntry | undefined {
  const code = paperCode.trim().toUpperCase();
  return SYLLABUS_REGISTRY.find((e) => {
    const codeMatch = e.paper_code.toUpperCase() === code;
    if (!codeMatch) return false;
    if (university) {
      return e.university.toLowerCase() === university.toLowerCase();
    }
    return true;
  });
}

/**
 * Return all entries for a given university, optionally filtered by programme
 * and/or category.
 */
export function getByUniversity(
  university: string,
  programme?: string,
  category?: string,
): SyllabusRegistryEntry[] {
  return SYLLABUS_REGISTRY.filter((e) => {
    if (e.university.toLowerCase() !== university.toLowerCase()) return false;
    if (programme && e.programme.toLowerCase() !== programme.toLowerCase()) return false;
    if (category && e.category !== category) return false;
    return true;
  });
}

/**
 * Return all entries grouped by semester, sorted ascending.
 */
export function groupBySemester(
  entries: SyllabusRegistryEntry[],
): Map<number, SyllabusRegistryEntry[]> {
  const map = new Map<number, SyllabusRegistryEntry[]>();
  for (const e of entries) {
    const list = map.get(e.semester) ?? [];
    list.push(e);
    map.set(e.semester, list);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}
