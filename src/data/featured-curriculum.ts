export const PROGRAMME_LABEL = "B.Sc. Physics (Hons)";
export const SEMESTER_LABEL = "Semester I";

export const FEATURED_PAPERS = [
  { code: "PH-101", title: "Mathematical Physics - I", tag: "DSC", credits: 6, units: 4, lab: false, mentors: ["Dr. J. Singh", "Prof. A. Karim", "Dr. M. Talukdar", "Ms. P. Roy"] },
  { code: "PH-102", title: "Mechanics", tag: "DSC", credits: 6, units: 4, lab: true, mentors: ["Prof. L. Saikia", "Dr. R. Verma", "Ms. K. Mukherjee"] },
  { code: "MA-101", title: "Calculus", tag: "DSM", credits: 4, units: 3, lab: false, mentors: ["Prof. N. Baruah", "Mr. H. Sharma"] },
  { code: "SK-101", title: "Digital Literacy", tag: "SEC", credits: 2, units: 2, lab: false, mentors: ["Ms. G. Choudhury", "Mr. T. Paul", "Ms. D. Lahon"] },
] as const;
