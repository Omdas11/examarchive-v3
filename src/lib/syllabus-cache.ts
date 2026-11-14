import { unstable_cache } from "next/cache";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import {
  toSyllabusTableRow,
  type SyllabusTableRow,
} from "@/lib/syllabus-table";

/**
 * Every published syllabus-table row (2,789 rows), fetched once and shared
 * by /syllabus, /syllabus/[department] and /syllabus/paper/[dept]/[code].
 *
 * The old code fetched the whole table (or a whole department's rows) on
 * every page visit — 2,789 reads for the index page alone. Syllabus content
 * changes only when the team publishes new rows, so a 7-day cache is safe:
 * at most one 2,789-read refresh per week instead of thousands of reads
 * per day.
 */
export const getAllSyllabusRows = unstable_cache(
  async (): Promise<SyllabusTableRow[]> => {
    const db = adminDatabases();
    const rows: SyllabusTableRow[] = [];
    let offset = 0;
    for (;;) {
      const res = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
        Query.equal("status", "published"),
        Query.limit(500),
        Query.offset(offset),
      ]);
      for (const doc of res.documents) {
        rows.push(toSyllabusTableRow(doc as Record<string, unknown>));
      }
      if (res.documents.length < 500) break;
      offset += 500;
    }
    return rows;
  },
  ["syllabus-table-all-v2"],
  { revalidate: 604800 },
);
