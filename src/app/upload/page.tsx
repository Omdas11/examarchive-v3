import type { Metadata } from "next";
import UploadForm from "@/components/UploadForm";

export const metadata: Metadata = {
  title: "Upload",
  description: "Upload a question paper or notes to ExamArchive.",
};

const guidelines = [
  "Only upload question papers you have permission to share.",
  "PDFs are preferred. Images (JPG/PNG) are also accepted.",
  "Ensure the file is legible and not blurry.",
  "Fill in all required fields accurately.",
  "Uploads are reviewed by admins before publishing.",
];

export default function UploadPage() {
  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      {/* Auth wall placeholder */}
      <div className="card mb-8 p-6 text-center" id="auth-wall">
        <h2 className="text-lg font-semibold">Sign in Required</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          You need to sign in to upload papers.
        </p>
        <a href="/admin" className="btn-primary mt-4 inline-block">Sign In</a>
      </div>

      {/* Intro */}
      <h1 className="text-2xl font-bold">Upload to ExamArchive</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Share question papers with the community. All uploads are reviewed before publishing.
      </p>

      {/* Upload type selector */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-4 cursor-pointer" style={{ borderColor: "var(--color-primary)" }}>
          <div className="flex items-center gap-3">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs"
              style={{ background: "var(--color-primary)" }}
            >
              ✓
            </span>
            <div>
              <p className="font-semibold text-sm">Question Paper</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Upload an exam question paper</p>
            </div>
          </div>
        </div>
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
      <div className="card mt-6 p-6">
        <UploadForm />
      </div>

      {/* Guidelines */}
      <div className="card mt-6 p-6">
        <h2 className="text-base font-semibold mb-3">Upload Guidelines</h2>
        <ul className="space-y-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {guidelines.map((g, i) => (
            <li key={i} className="flex gap-2">
              <span style={{ color: "var(--color-primary)" }}>•</span>
              {g}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
