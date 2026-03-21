import type { Metadata } from "next";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Syllabus } from "@/types";
import { toSyllabus } from "@/types";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import SyllabusClient from "./SyllabusClient";

export const metadata: Metadata = {
  title: "Syllabus Library by Paper Code and Subject",
  description:
    "Browse approved syllabus PDFs and structured syllabus pages by paper code, subject, and university on ExamArchive.",
  keywords: [
    "syllabus library",
    "paper code syllabus",
    "university syllabus pdf",
    "FYUGP syllabus",
    "CBCS syllabus",
  ],
  alternates: { canonical: "/syllabus" },
  openGraph: {
    title: "Syllabus Library | ExamArchive",
    description:
      "Explore approved syllabus PDFs and paper-code syllabus pages for faster exam preparation.",
    url: "https://examarchive.dev/syllabus",
    type: "website",
  },
};

export default async function SyllabusPage() {
  const user = await getServerUser();
  const isAdmin = user?.role === "admin" || user?.role === "moderator" || user?.role === "founder";
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  let syllabi: Syllabus[] = [];
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.syllabus,
      [
        Query.equal("approval_status", "approved"),
        Query.orderDesc("$createdAt"),
      ],
    );
    syllabi = documents.map(toSyllabus).filter((s) => !s.is_hidden);
  } catch {
    // collection may not exist yet
  }

  return (
    <MainLayout
      title="Syllabus"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Syllabus" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Syllabus</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Browse approved syllabus PDFs or explore the structured paper syllabus library.
      </p>

      <SyllabusClient syllabi={syllabi} isAdmin={isAdmin} />
    </section>
    </MainLayout>
  );
}
