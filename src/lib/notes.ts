/**
 * 7th-semester written notes (FYUGP, Assam University, Haflong Government College).
 *
 * Single source of truth for the /notes section: paper titles, unit titles,
 * page counts, PDF paths, top-2 high-mark topics per unit, and the Assam
 * University questions for each unit, taken from the notes blueprint
 * (7th-Sem-Notes-Blueprint-20-Units.md, built 2026-11-05).
 *
 * Honesty rules baked into this data:
 * - AU counts are exact: 401T U1 12, U2 0, U3 23, U4 0, U5 3; 403T U1 5,
 *   U2 6, U3 4, U4 5, U5 0; 402T all 0 (no AU mechanics paper exists in
 *   the collection); CHM 16 topic-matched from other AU chemistry papers,
 *   NOT from a DSM-401 paper.
 * - Units with no AU questions carry an empty `auQuestions` array and the
 *   page renders "No Assam University question found for this unit".
 * - CHM questions are tagged with their real paper code (CHMDSE-501T,
 *   CHMSEC-401T, CHMHCC-501T) and the paper page labels them topic-matched.
 * - Questions marked `paraphrased` are reworded from a jumbled extraction,
 *   not verbatim. Questions with garbled text in the source carry a `note`.
 *
 * No Appwrite calls anywhere: this file is static data only.
 */

export interface NotesQuestion {
  /** Question text, as printed in the source paper (or paraphrased — see flag). */
  text: string;
  /** Source paper, e.g. "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec B, 5 marks)". */
  source: string;
  /** True when the wording is a paraphrase, not a verbatim quote. */
  paraphrased?: boolean;
  /** Caveat about the source text, e.g. garbled matrix entries. */
  note?: string;
}

export interface NotesUnit {
  /** Unit number (1-5). */
  number: number;
  /** Display label: "Unit 1" for physics papers, "Unit I" for CHM-DSM-401. */
  label: string;
  title: string;
  pages: number;
  /** Public PDF path, e.g. "/notes/phydsc401t/PHYDSC401T-Unit1-....pdf". */
  pdf: string;
  /** The unit's top 2 high-mark topics. */
  topTopics: [string, string];
  /** Assam University questions for this unit (exact where they exist). Empty = gap. */
  auQuestions: NotesQuestion[];
  /** Extra context shown with the questions, e.g. topic-match provenance. */
  auNote?: string;
}

export interface NotesPaper {
  slug: string;
  code: string;
  name: string;
  /** Short line for the landing-page card. */
  blurb: string;
  /** Paper-wide note shown with the questions, e.g. a whole-paper AU gap. */
  auGapNote?: string;
  units: NotesUnit[];
}

export const NOTES_PAPERS: NotesPaper[] = [
  {
    slug: "phydsc401t",
    code: "PHYDSC401T",
    name: "Mathematical Physics-III",
    blurb:
      "Linear vector spaces and matrices, partial differential equations and special functions, complex analysis, probability and tensors, group theory and numerical methods.",
    units: [
      {
        number: 1,
        label: "Unit 1",
        title: "Linear Vector Space and Matrices",
        pages: 39,
        pdf: "/notes/phydsc401t/PHYDSC401T-Unit1-Linear-Vector-Space-and-Matrices.pdf",
        topTopics: [
          "Linear independence, basis, dimension and rank of a matrix",
          "Eigenvalues, eigenvectors and Cayley-Hamilton theorem",
        ],
        auQuestions: [
          {
            text: "Show that vector product of two vectors is a vector.",
            source: "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec A)",
          },
          {
            text: "Define singular and non-singular matrices.",
            source: "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec A)",
          },
          {
            text: "Show that any square matrix can be uniquely expressed as the sum of symmetric and antisymmetric matrix.",
            source: "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec B, 5 marks)",
          },
          {
            text: "Find the inverse of the matrix [3x3 matrix].",
            source: "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec B)",
            note: "Matrix entries are garbled in the source extraction.",
          },
          {
            text: "Show that the set {(1,0,0), (1,1,0), (1,1,1)} is LI.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec A)",
          },
          {
            text: "Prove that every singleton set containing non-zero vector is LI.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec B, 2 marks)",
          },
          {
            text: "Show that the vectors (1,1,0), (2,3,5) and (2,2,0) in R^3 are LD.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec B, 3 marks)",
          },
          {
            text: "State and prove Cauchy-Schwarz inequality.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec B, 4 marks)",
          },
          {
            text: "What do you mean by canonical form of matrices? Define rank of a matrix.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec A)",
          },
          {
            text: "Show that the rank of the transpose of a matrix is the same as that of the original matrix.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec B, 5 marks)",
          },
          {
            text: "Solve by Gaussian elimination method: x+y+z=6, 2x-y+2z=6, 2x+2y+z=9.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec B, 5 marks)",
          },
          {
            text: "Find the rank of the matrix [4x5 matrix] by reducing it to normal form.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec B, 5 marks)",
            note: "Matrix entries are garbled in the source extraction.",
          },
        ],
      },
      {
        number: 2,
        label: "Unit 2",
        title: "PDEs and Special Functions",
        pages: 29,
        pdf: "/notes/phydsc401t/PHYDSC401T-Unit2-PDEs-and-Special-Functions.pdf",
        topTopics: [
          "Laplace equation by separation of variables in rectangular, cylindrical and spherical symmetry",
          "Wave equation and vibrational modes of a stretched string and of rectangular and circular membranes",
        ],
        auQuestions: [],
      },
      {
        number: 3,
        label: "Unit 3",
        title: "Complex Analysis",
        pages: 13,
        pdf: "/notes/phydsc401t/PHYDSC401T-Unit3-Complex-Analysis.pdf",
        topTopics: [
          "Cauchy-Riemann equations and Cauchy integral formula / Cauchy integral theorem",
          "Residue theorem, residues at poles, and evaluation of integrals",
        ],
        auQuestions: [
          {
            text: "State de Moivre's theorem for positive integral index and prove it.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec B, 4 marks) — revision level",
          },
          {
            text: "Express sin(x+iy) in the form of A+iB.",
            source: "MATDSC-101T, 1st Sem, 2023, FYUG (Sec A) — revision level",
          },
          {
            text: "Define modulus and argument of a complex number.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "Show that the sum and product of a complex number and its conjugate complex number are both real.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "State and explain De Moivre's theorem.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "What is singularity of an analytic function? Define pole.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "State Taylor and Laurent expansions.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "Expand cos z in a Taylor series about z = pi/4.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "State Cauchy residue theorem.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "How will you find the residue at a simple pole?",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "Find the residue at each pole of the function f(z) = cot z.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec A, 2 marks)",
          },
          {
            text: "If 2 cos theta = x + 1/x and 2 cos phi = y + 1/y, then prove that x^p y^q + 1/(x^p y^q) = 2 cos(p theta + q phi). Also: find the square root of -4 - 3i.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec B, 6 marks)",
          },
          {
            text: "Show that the real and imaginary parts of an analytic function f(z) = u(x,y) + i v(x,y) satisfy the Cauchy-Riemann differential equations at each point where f(z) is analytic. Also: show that sin z is analytic function of complex variable z = x + iy.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec B, 6 marks)",
          },
          {
            text: "State and prove Cauchy's integral formula.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec B, 6 marks)",
          },
          {
            text: "Evaluate integral_C dz/(z^2 - 1), where C is the circle x^2 + y^2 = 4. Also: expand f(z) = 1/[(z+1)(z+3)] as a Laurent series valid for (i) |z| < 1 and (ii) 1 < |z| < 3.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec B, 6 marks)",
          },
          {
            text: "Evaluate the residues of z^2/[(z-1)(z-2)(z-3)] at z = 1, 2, 3 and infinity and show that their sum is zero. Also: find the residue of f(z) = z^2/[(z+1)^2 (z-2)] at its double pole.",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec B, 6 marks)",
          },
          {
            text: "Using Residue theorem, calculate (1/2 pi i) integral_C e^{zt} dz / [z^2 (z^2 + 2z + 2)] where C is the circle |z| = 3. Also: using residue calculus, evaluate integral_0^{2pi} d theta / (5 - 4 sin theta).",
            source: "PHSHCC-401T, 4th Sem, 2022, CBCS (Sec B, 6 marks)",
          },
        ],
        auNote:
          "Laplace transform questions in the same PHSHCC-401T paper are not in the FYUG PHYDSC401T syllabus, so they are not listed here.",
      },
      {
        number: 4,
        label: "Unit 4",
        title: "Probability, Errors and Tensors",
        pages: 44,
        pdf: "/notes/phydsc401t/PHYDSC401T-Unit4-Probability-Errors-and-Tensors.pdf",
        topTopics: [
          "Binomial, Poisson and Normal distributions, with Central Limit Theorem and Law of Large Numbers",
          "Tensors: covariant and contravariant tensors, metric tensor, covariant differentiation and Christoffel symbols",
        ],
        auQuestions: [],
      },
      {
        number: 5,
        label: "Unit 5",
        title: "Group Theory and Numerical Methods",
        pages: 39,
        pdf: "/notes/phydsc401t/PHYDSC401T-Unit5-Group-Theory-and-Numerical-Methods.pdf",
        topTopics: [
          "Newton-Raphson and Bisection methods for algebraic and transcendental equations",
          "Abstract groups: subgroups, cosets, normal subgroups, factor groups, homomorphism and isomorphism",
        ],
        auQuestions: [
          {
            text: "Explain bisection method of solving differential equation.",
            source: "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec B, 4 marks)",
          },
          {
            text: "Find the real root of the equation x^3 - 9x + 1 = 0.",
            source: "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec B, 4 marks) — Newton-Raphson; follows the bisection question",
          },
          {
            text: "Write down Simpson's rule for integration of a function.",
            source: "PHYDSC-101T, 1st Sem, 2023, FYUG (Sec A)",
          },
        ],
        auNote:
          "No Assam University question on group theory (subgroups, cosets, normal subgroups, factor groups, homomorphism/isomorphism) was found, and no Euler or Runge-Kutta questions.",
      },
    ],
  },
  {
    slug: "phydsc402t",
    code: "PHYDSC402T",
    name: "Classical Mechanics",
    blurb:
      "Central force motion, Lagrangian mechanics, Hamiltonian formulation, Hamilton-Jacobi theory and action-angle variables, rigid body dynamics and small oscillations.",
    auGapNote:
      "No Assam University mechanics paper exists in the question bank, so no Assam University questions could be listed for any unit of this paper. The notes cover each unit from the syllabus, with extra important questions from other universities' papers at the end of each PDF.",
    units: [
      {
        number: 1,
        label: "Unit 1",
        title: "Central Force Motion",
        pages: 26,
        pdf: "/notes/phydsc402t/PHYDSC402T-Unit1-Central-Force-Motion.pdf",
        topTopics: [
          "Deduction of Kepler's laws of planetary motion and differential equation of the orbit in plane polar coordinates",
          "Effective potential energy, radial motion, stability of circular orbits and classification of orbits",
        ],
        auQuestions: [],
      },
      {
        number: 2,
        label: "Unit 2",
        title: "Lagrangian Mechanics",
        pages: 30,
        pdf: "/notes/phydsc402t/PHYDSC402T-Unit2-Lagrangian-Mechanics.pdf",
        topTopics: [
          "Hamilton's principle and derivation of Lagrange's equations from Hamilton's principle",
          "Lagrange's equations with velocity-dependent potential and Rayleigh dissipation function, with cyclic coordinates and first integrals of motion",
        ],
        auQuestions: [],
      },
      {
        number: 3,
        label: "Unit 3",
        title: "Hamiltonian Formulation",
        pages: 31,
        pdf: "/notes/phydsc402t/PHYDSC402T-Unit3-Hamiltonian-Formulation.pdf",
        topTopics: [
          "Hamilton's equations of motion and their derivation from the variational principle",
          "Canonical transformations and Poisson brackets, including invariance of Poisson brackets under canonical transformation and equations of motion in Poisson bracket form",
        ],
        auQuestions: [],
      },
      {
        number: 4,
        label: "Unit 4",
        title: "Hamilton-Jacobi Theory and Action-Angle Variables",
        pages: 17,
        pdf: "/notes/phydsc402t/PHYDSC402T-Unit4-Hamilton-Jacobi-Theory-and-Action-Angle-Variables.pdf",
        topTopics: [
          "Hamilton-Jacobi equation, Hamilton's characteristic function and separation of variables in the Hamilton-Jacobi equation",
          "Harmonic oscillator by the Hamilton-Jacobi method and by action-angle variables, including frequency from action variable J",
        ],
        auQuestions: [],
      },
      {
        number: 5,
        label: "Unit 5",
        title: "Rigid Body Dynamics and Small Oscillations",
        pages: 24,
        pdf: "/notes/phydsc402t/PHYDSC402T-Unit5-Rigid-Body-Dynamics-and-Small-Oscillations.pdf",
        topTopics: [
          "Euler angles and Euler's equations of motion for a rigid body, including force-free motion of a symmetrical top",
          "Small oscillations: equilibrium and potential energy, frequencies of free vibration, normal coordinates, and longitudinal vibration of a linear triatomic molecule",
        ],
        auQuestions: [],
      },
    ],
  },
  {
    slug: "phydsc403t",
    code: "PHYDSC403T",
    name: "Basic Quantum Mechanics",
    blurb:
      "Schrodinger equation and operators, general formalism, applications of the Schrodinger equation, hydrogen atom and linear harmonic oscillator, angular momentum operators and symmetry transformations.",
    units: [
      {
        number: 1,
        label: "Unit 1",
        title: "Schrodinger Equation and Operators",
        pages: 11,
        pdf: "/notes/phydsc403t/PHYDSC403T-Unit1-Schrodinger-Equation-and-Operators.pdf",
        topTopics: [
          "Hermitian operators and their properties, with commutation relations and compatible/incompatible observables",
          "Probability current density and equation of continuity / conservation of probability",
        ],
        auQuestions: [
          {
            text: "Write four important postulates of quantum mechanics.",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec A)",
          },
          {
            text: "What do you mean by the term 'zero point energy'?",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec A)",
          },
          {
            text: "Write any two postulates of quantum mechanics.",
            source: "CHMHCC-502T, 5th Sem, 2021, CBCS (Sec A)",
          },
          {
            text: "If [A,B] = ..., then show that ... are Hermitian operators, and find ... such that ... have real eigenvalues.",
            source: "CHMHCC-502T, 5th Sem, 2021, CBCS (Sec A) — commutator/Hermitian-operator question",
            paraphrased: true,
          },
          {
            text: "Prove that the linear combination of well-behaved wave functions is also well-behaved.",
            source: "CHMHCC-502T, 5th Sem, 2023, CBCS (Sec A)",
          },
        ],
      },
      {
        number: 2,
        label: "Unit 2",
        title: "General Formalism",
        pages: 31,
        pdf: "/notes/phydsc403t/PHYDSC403T-Unit2-General-Formalism.pdf",
        topTopics: [
          "Generalized uncertainty principle, with Heisenberg uncertainty principle",
          "Ehrenfest theorem and expectation values / stationary states",
        ],
        auQuestions: [
          {
            text: "State Heisenberg's uncertainty principle.",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec B)",
          },
          {
            text: "Determine the uncertainty in the momentum of a ball of mass 3x10^-2 kg moving with velocity 600 m/s, if the position can be located with an error of ...",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec A)",
            note: "Question text is incomplete in the source extraction.",
          },
          {
            text: "Verify Heisenberg's uncertainty principle for the ground state of the one-dimensional simple harmonic oscillator.",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec B)",
            paraphrased: true,
          },
          {
            text: "What is the Heisenberg uncertainty principle? Apply it to the simple harmonic oscillator: zero-point energy and normalized wave function.",
            source: "CHMHCC-502T, 5th Sem, 2023, CBCS (Sec B)",
            paraphrased: true,
          },
          {
            text: "State and explain Heisenberg uncertainty principle. Mention its significance.",
            source: "CHMDSM-151, 2nd Sem, 2025, FYUG (3 marks)",
          },
          {
            text: "State Heisenberg's uncertainty principle ...",
            source: "CHMDSM-151T, 2nd Sem, 2024, FYUG",
            paraphrased: true,
          },
        ],
      },
      {
        number: 3,
        label: "Unit 3",
        title: "Applications of Schrodinger Equation",
        pages: 28,
        pdf: "/notes/phydsc403t/PHYDSC403T-Unit3-Applications-of-Schrodinger-Equation.pdf",
        topTopics: [
          "Particle in a 1-D infinite well and in a 1-D / 3-D box, energy eigenvalues and normalized eigenfunctions, and degeneracy",
          "Step potential transmission and reflection coefficients, and finite rectangular barrier / quantum tunnelling",
        ],
        auQuestions: [
          {
            text: "Solve Schrodinger's equation for a particle of mass m confined to move in a 1-D box of length a.",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec B)",
          },
          {
            text: "Calculate the degree of degeneracy of a particle in a 3D cubical box of length a.",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec A)",
          },
          {
            text: "Calculate the energy levels for the particle in a three-dimensional cubical box with edge ... Calculate the degeneracy ...",
            source: "CHMHCC-502T, 5th Sem, 2021, CBCS (Sec B)",
            paraphrased: true,
          },
          {
            text: "Solve the Schrodinger equation for a particle in a 3-D box and find the energy.",
            source: "CHMHCC-502T, 5th Sem, 2023, CBCS (Sec B)",
            paraphrased: true,
          },
        ],
      },
      {
        number: 4,
        label: "Unit 4",
        title: "Hydrogen Atom and Linear Harmonic Oscillator",
        pages: 26,
        pdf: "/notes/phydsc403t/PHYDSC403T-Unit4-Hydrogen-Atom-and-Linear-Harmonic-Oscillator.pdf",
        topTopics: [
          "Hydrogen atom: Schrodinger equation in spherical polar coordinates, radial wave equation, energy eigenvalues and eigenfunctions using spherical harmonics and Laguerre polynomials, and most probable distance",
          "Linear harmonic oscillator: energy eigenvalues and eigenfunctions, ground-state wave function, and zero-point energy",
        ],
        auQuestions: [
          {
            text: "Write the Schrodinger wave equation in Cartesian coordinates (x,y,z), separate it in spherical polar coordinates (r,theta,phi) for the H-atom, and solve to find the most probable distance of the electron from the nucleus.",
            source: "CHMHCC-502T, 5th Sem, 2020, CBCS (Sec B)",
            paraphrased: true,
          },
          {
            text: "Write the Schrodinger equation for the H-atom, separate it in spherical polar coordinates to get the radial wave equation; and solve the Schrodinger equation for the one-dimensional harmonic oscillator (SHO) - what is its zero-point energy?",
            source: "CHMHCC-502T, 5th Sem, 2021, CBCS (Sec B)",
            paraphrased: true,
          },
          {
            text: "Write the Schrodinger equation for the hydrogen atom and separate it in spherical polar coordinates; solve for H and find the most probable distance of the electron from the nucleus.",
            source: "CHMHCC-502T, 5th Sem, 2023, CBCS (Sec B)",
            paraphrased: true,
          },
          {
            text: "Draw the radial probability distribution curves for 1s and 2s electrons.",
            source: "CHMDSM-151, 2nd Sem, 2025, FYUG (Sec A)",
          },
          {
            text: "Schrodinger equation for the hydrogen atom; wave equation ...",
            source: "CHMDSM-151T, 2nd Sem, 2024, FYUG (Sec B)",
            paraphrased: true,
          },
        ],
      },
      {
        number: 5,
        label: "Unit 5",
        title: "Angular Momentum Operators and Symmetry Transformations",
        pages: 27,
        pdf: "/notes/phydsc403t/PHYDSC403T-Unit5-Angular-Momentum-Operators-and-Symmetry-Transformations.pdf",
        topTopics: [
          "Angular momentum operators, commutation rules, eigenvalues and eigenfunctions of L^2 and L_z, and ladder operators",
          "Symmetry transformations: space-time translations and rotations, invariance under the transformations and conservation laws",
        ],
        auQuestions: [],
      },
    ],
  },
  {
    slug: "chm-dsm-401",
    code: "CHM-DSM-401",
    name: "Fundamental of Chemistry-IV",
    blurb:
      "Data analysis, renewable energy, history of chemistry in the Indian context, chemical waste management, and elementary food chemistry. Minor paper, 45 contact hours.",
    units: [
      {
        number: 1,
        label: "Unit I",
        title: "Data Analysis",
        pages: 28,
        pdf: "/notes/chm-dsm-401/CHMDSM401-Unit1-Data-Analysis.pdf",
        topTopics: [
          "Errors in chemical analysis - systematic and random errors, precision vs accuracy, propagation of errors",
          "Mean and standard deviation, linear regression, covariance and correlation coefficient",
        ],
        auQuestions: [
          {
            text: "What do you mean by the term 'sampling'?",
            source: "CHMDSE-501T Analytic Methods in Chemistry, 5th Sem, 2020, CBCS (Sec A, 1 mark)",
          },
          {
            text: "Define error.",
            source: "CHMDSE-501T, 2020, CBCS (Sec A, 1 mark)",
          },
          {
            text: "What is meant by precision?",
            source: "CHMDSE-501T, 2020, CBCS (Sec A, 1 mark)",
          },
          {
            text: "Define accuracy.",
            source: "CHMDSE-501T, 2020, CBCS (Sec A, 1 mark)",
          },
          {
            text: "What are different ways of expressing an error?",
            source: "CHMDSE-501T, 2020, CBCS (Sec A, 1 mark)",
          },
          {
            text: "Discuss how you can minimize error.",
            source: "CHMDSE-501T, 2020, CBCS (Sec B, 2 marks)",
          },
          {
            text: "What is meant by normal distribution? Give examples. What are the characteristics of normal distribution?",
            source: "CHMDSE-501T, 2020, CBCS (Sec C, 5 marks)",
          },
          {
            text: "Discuss different statistical tests of data analysis.",
            source: "CHMDSE-501T, 2020, CBCS (Sec C, 5 marks)",
          },
        ],
        auNote:
          "Topic-matched questions from CHMDSE-501T Analytic Methods, not from a DSM-401 paper. They match Unit I topics (sampling, errors, precision/accuracy, data analysis) only.",
      },
      {
        number: 2,
        label: "Unit II",
        title: "Renewable Energy",
        pages: 24,
        pdf: "/notes/chm-dsm-401/CHMDSM401-Unit2-Renewable-Energy.pdf",
        topTopics: [
          "Different types of solar cells and storage of solar energy",
          "Conversion of biomass into fuels - energy through fermentation, pyrolysis and gasification",
        ],
        auQuestions: [
          {
            text: "Write a brief note on solar energy.",
            source: "CHMSEC-401T Fuel Chemistry, 4th Sem, 2024, CBCS, Unit II",
            paraphrased: true,
            note: "Jumbled multi-column extraction; exact wording cannot be verified.",
          },
          {
            text: "Write a brief note on biodiesel.",
            source: "CHMSEC-401T Fuel Chemistry, 4th Sem, 2024, CBCS, Unit III",
            paraphrased: true,
            note: "Jumbled multi-column extraction; exact wording cannot be verified.",
          },
        ],
        auNote:
          "Topic-matched questions from CHMSEC-401T Fuel Chemistry, not from a DSM-401 paper. No clean verbatim AU question on solar cells, biomass conversion, fermentation, pyrolysis, gasification or hydrogen energy was found.",
      },
      {
        number: 3,
        label: "Unit III",
        title: "History of Chemistry",
        pages: 27,
        pdf: "/notes/chm-dsm-401/CHMDSM401-Unit3-History-of-Chemistry.pdf",
        topTopics: [
          "Ayurvedic Chemistry and Alchemy in India",
          "Metal and Metallurgy, and Fiber, cloth, Paper, ink, and dyeing chemistry of ancient India",
        ],
        auQuestions: [],
      },
      {
        number: 4,
        label: "Unit IV",
        title: "Chemical Waste Management",
        pages: 19,
        pdf: "/notes/chm-dsm-401/CHMDSM401-Unit4-Chemical-Waste-Management.pdf",
        topTopics: [
          "Classification of chemical waste - Hazardous Waste, Non-hazardous waste, Universal waste",
          "Chemical waste management - accumulation of wastes, waste containers, storage, labelling and disposal - plus waste minimization",
        ],
        auQuestions: [],
      },
      {
        number: 5,
        label: "Unit V",
        title: "Elementary Food Chemistry",
        pages: 21,
        pdf: "/notes/chm-dsm-401/CHMDSM401-Unit5-Elementary-Food-Chemistry.pdf",
        topTopics: [
          "Preservation of foods - general principles, physical and chemical methods of food preservation",
          "Food additives - vitamins, amino acids, minerals, aroma compounds, sugar substitutes and food colours",
        ],
        auQuestions: [
          {
            text: "What is meant by essential and non essential amino acids? Give one example of each.",
            source: "CHMHCC-501T Biomolecules, 5th Sem, 2023, CBCS (Sec A, Unit II, 2 marks)",
          },
          {
            text: "What is the isoelectric point of amino acid? What role does it play in electrophoresis?",
            source: "CHMHCC-501T, 2023, CBCS (Sec A, Unit II, 2 marks)",
          },
          {
            text: "What are compound and derived lipids? Give examples.",
            source: "CHMHCC-501T, 2023, CBCS (Sec A, Unit IV, 2 marks)",
          },
          {
            text: "What are trans-fats? Why are they considered harmful?",
            source: "CHMHCC-501T, 2023, CBCS (Sec A, Unit IV, 2 marks)",
          },
          {
            text: "Describe the role of vitamin C in human body.",
            source: "CHMHCC-501T, 2023, CBCS (Sec A, Unit V, 2 marks)",
          },
          {
            text: "What are lipids? What are their primary functions in living organism?",
            source: "CHMHCC-501T, 2023, CBCS (Sec B, Unit IV, 2 marks)",
          },
        ],
        auNote:
          "Topic-matched questions from CHMHCC-501T Biomolecules, not from a DSM-401 paper. They match Unit V topics (amino acids, vitamins, lipids) only; no AU question on food preservation, sugar substitutes, food colours or browning reactions was found.",
      },
    ],
  },
];

export function notesPaperBySlug(slug: string): NotesPaper | undefined {
  return NOTES_PAPERS.find((p) => p.slug === slug);
}

export function notesPaperSlugs(): string[] {
  return NOTES_PAPERS.map((p) => p.slug);
}

export function totalPages(paper: NotesPaper): number {
  return paper.units.reduce((sum, u) => sum + u.pages, 0);
}

export function totalNotesPages(): number {
  return NOTES_PAPERS.reduce((sum, p) => sum + totalPages(p), 0);
}

/** "No Assam University question found for this unit" — the honest gap line. */
export const AU_GAP_TEXT = "No Assam University question found for this unit";
