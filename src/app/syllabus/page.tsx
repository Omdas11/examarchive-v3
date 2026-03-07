import type { Metadata } from "next";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Syllabus } from "@/types";
import { toSyllabus } from "@/types";
import SyllabusClient from "./SyllabusClient";

export const metadata: Metadata = {
  title: "Syllabus",
  description: "Browse approved course syllabi and the paper syllabus library.",
};

export default async function SyllabusPage() {
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
    syllabi = documents.map(toSyllabus);
  } catch {
    // collection may not exist yet
  }

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Syllabus</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Browse approved syllabus PDFs or explore the structured paper syllabus library.
      </p>

      <SyllabusClient syllabi={syllabi} />
    </section>
  );
}

