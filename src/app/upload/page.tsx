import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import UploadForm from "@/components/UploadForm";
import SyllabusUploadForm from "@/components/SyllabusUploadForm";
import DeptSyllabusUploadForm from "@/components/DeptSyllabusUploadForm";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Upload Question Papers and Syllabus PDFs",
  description:
    "Upload question papers and syllabus PDFs to ExamArchive. Submissions are reviewed by admins before publishing.",
  keywords: [
    "upload question paper",
    "upload syllabus pdf",
    "submit past paper",
    "examarchive upload",
  ],
  alternates: { canonical: "/upload" },
  openGraph: {
    title: "Upload Papers & Syllabi | ExamArchive",
    description:
      "Contribute question papers and syllabus PDFs to help students prepare with verified resources.",
    url: "https://www.examarchive.dev/upload",
    type: "website",
  },
};

const guidelines = [
  "Only upload question papers you have permission to share.",
  "PDFs are preferred. Images (JPG/PNG) are also accepted.",
  "Ensure the file is legible and not blurry.",
  "Fill in all required fields accurately.",
  "Uploads are reviewed by admins before publishing.",
];

const syllabusGuidelines = [
  "Only upload syllabi you have permission to share.",
  "PDF format is preferred for best compatibility.",
  "Ensure all metadata fields are accurately filled.",
  "Syllabi are reviewed by admins before publishing.",
];

const deptSyllabusGuidelines = [
  "Upload the full departmental syllabus covering all semesters.",
  "Specify the programme (FYUG) and department/subject accurately.",
  "PDF format is required. Maximum file size is 20 MB.",
  "Use this type for official university-issued full syllabus documents.",
  "Uploads are reviewed by admins before publishing.",
];

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/upload");
  }

  const params = await searchParams;
  const uploadType =
    params.type === "syllabus"
      ? "syllabus"
      : params.type === "dept_syllabus"
        ? "dept_syllabus"
        : "paper";

  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="Upload"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Upload" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        {/* Intro */}
        <h1 className="text-2xl font-bold text-on-surface">Upload to ExamArchive</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Share question papers and syllabi with the community. All uploads are reviewed before publishing.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
          <span className="material-symbols-outlined text-sm">info</span>
          On mobile, choose the upload type first, then fill the form below.
        </div>

        {/* Upload type selector */}
        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/upload?type=paper"
            className="card p-4 transition-all hover:shadow-sm"
            style={uploadType === "paper" ? { borderColor: "var(--color-primary)" } : undefined}
          >
            <div className="flex items-center gap-3">
              {uploadType === "paper" ? (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs"
                  style={{ background: "var(--color-primary)" }}
                >
                  ✓
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ border: "1px solid var(--color-border)" }}>&nbsp;</span>
              )}
              <div>
                <p className="font-semibold text-sm">Question Paper</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Upload an exam question paper</p>
              </div>
            </div>
          </a>

          <a
            href="/upload?type=syllabus"
            className="card p-4 transition-all hover:shadow-sm"
            style={uploadType === "syllabus" ? { borderColor: "var(--color-primary)" } : undefined}
          >
            <div className="flex items-center gap-3">
              {uploadType === "syllabus" ? (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs"
                  style={{ background: "var(--color-primary)" }}
                >
                  ✓
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ border: "1px solid var(--color-border)" }}>&nbsp;</span>
              )}
              <div>
                <p className="font-semibold text-sm">Syllabus</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Upload a single-semester syllabus</p>
              </div>
            </div>
          </a>

          <a
            href="/upload?type=dept_syllabus"
            className="card p-4 transition-all hover:shadow-sm"
            style={uploadType === "dept_syllabus" ? { borderColor: "var(--color-primary)" } : undefined}
          >
            <div className="flex items-center gap-3">
              {uploadType === "dept_syllabus" ? (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs"
                  style={{ background: "var(--color-primary)" }}
                >
                  ✓
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ border: "1px solid var(--color-border)" }}>&nbsp;</span>
              )}
              <div>
                <p className="font-semibold text-sm">Departmental Syllabus</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Full syllabus for all semesters</p>
              </div>
            </div>
          </a>

          <div className="card p-4 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ border: "1px solid var(--color-border)" }}>
                &nbsp;
              </span>
              <div>
                <p className="font-semibold text-sm">Notes</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload form */}
        <div className="card mt-6 p-4 sm:p-6">
          {uploadType === "syllabus" ? (
            <SyllabusUploadForm />
          ) : uploadType === "dept_syllabus" ? (
            <DeptSyllabusUploadForm />
          ) : (
            <UploadForm />
          )}
        </div>

        {/* Guidelines */}
        <div className="card mt-6 p-6">
          <h2 className="text-base font-semibold mb-3">Upload Guidelines</h2>
          <ul className="space-y-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {(uploadType === "syllabus"
              ? syllabusGuidelines
              : uploadType === "dept_syllabus"
                ? deptSyllabusGuidelines
                : guidelines
            ).map((g, i) => (
              <li key={i} className="flex gap-2">
                <span style={{ color: "var(--color-primary)" }}>•</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MainLayout>
  );
}
