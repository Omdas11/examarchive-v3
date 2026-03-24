export const PROGRAMME_LABEL = "B.Sc. Physics (Hons)";
export const SEMESTER_LABEL = "Semester I";

export interface FeaturedPaper {
  code: string;
  registryCode?: string;
  title: string;
  tag: "DSC" | "DSM" | "SEC";
  credits: number;
  units: number;
  lab: boolean;
  mentors: string[];
}

export const FEATURED_PAPERS: FeaturedPaper[] = [
  {
    code: "PH-101",
    registryCode: "PHYDSC101T",
    title: "Mathematical Physics - I",
    tag: "DSC",
    credits: 6,
    units: 4,
    lab: false,
    mentors: ["Dr. J. Singh", "Prof. A. Karim", "Dr. M. Talukdar", "Ms. P. Roy"],
  },
  {
    code: "PH-102",
    registryCode: "PHYDSC102T",
    title: "Mechanics",
    tag: "DSC",
    credits: 6,
    units: 4,
    lab: true,
    mentors: ["Prof. L. Saikia", "Dr. R. Verma", "Ms. K. Mukherjee"],
  },
  {
    code: "MA-101",
    registryCode: "MATDSM101",
    title: "Calculus",
    tag: "DSM",
    credits: 4,
    units: 3,
    lab: false,
    mentors: ["Prof. N. Baruah", "Mr. H. Sharma"],
  },
  {
    code: "SK-101",
    title: "Digital Literacy",
    tag: "SEC",
    credits: 2,
    units: 2,
    lab: false,
    mentors: ["Ms. G. Choudhury", "Mr. T. Paul", "Ms. D. Lahon"],
  },
] ;

export const TOTAL_CREDITS = FEATURED_PAPERS.reduce((sum, paper) => sum + paper.credits, 0);
export const TOTAL_MENTORS = FEATURED_PAPERS.reduce((sum, paper) => sum + paper.mentors.length, 0);

export const formatTwoDigits = (value: number) => value.toString().padStart(2, "0");

const HONORIFICS = new Set(["dr", "prof", "mr", "ms", "mrs"]);

export const getMentorInitials = (name: string) => {
  const tokens = name
    .replace(/\./g, "")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  const filtered = tokens.filter((token) => !HONORIFICS.has(token.toLowerCase()));
  const source = filtered.length > 0 ? filtered : tokens;
  return source
    .map((token) => token[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
};
