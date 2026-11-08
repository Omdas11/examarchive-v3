import { unstable_cache } from "next/cache";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { toPaper, type Paper } from "@/types";

/**
 * All approved papers, fetched once and shared by /browse, /papers/[dept],
 * /fyug-question-papers, /assam-university-question-papers and
 * /cbcs-question-papers.
 *
 * The fetch reads every approved paper document (615 reads) — without the
 * cache each of those pages paid a full collection scan on every visit.
 * Cached for 24h: new papers appear in the lists within a day. The slim
 * select keeps the payload to the fields the paper cards render.
 */
export const getAllApprovedPapers = unstable_cache(
  async (): Promise<Paper[]> => {
    const papers: Paper[] = [];
    let offset = 0;
    for (;;) {
      const db = adminDatabases();
      const { documents } = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.papers,
        [
          Query.equal("approved", true),
          Query.select([
            "$id",
            "$createdAt",
            "approved",
            "course_code",
            "department",
            "download_count",
            "duration",
            "exam_type",
            "file_id",
            "file_url",
            "institute",
            "institution",
            "marks",
            "paper_name",
            "paper_type",
            "programme",
            "semester",
            "status",
            "stream",
            "title",
            "uploaded_by",
            "uploaded_by_username",
            "view_count",
            "year",
          ]),
          Query.orderDesc("$createdAt"),
          Query.limit(500),
          Query.offset(offset),
        ],
      );
      papers.push(...documents.map(toPaper));
      if (documents.length < 500) break;
      offset += 500;
    }
    return papers;
  },
  ["all-approved-papers"],
  { revalidate: 86400 },
);
