import { NextRequest, NextResponse } from "next/server";
import { AppwriteException, ID } from "node-appwrite";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import { getServerUser } from "@/lib/auth";

const POLL_PREFIX = "SHOP_POLL::";
const PAGE_SIZE = 100;
const MAX_SCAN = 1000;

interface PollVoteBody {
  product: string;
  option: string;
}

function parseVoteText(text: string): { product: string; option: string } | null {
  if (!text.startsWith(POLL_PREFIX)) return null;
  const payload = text.slice(POLL_PREFIX.length);
  const [product, option] = payload.split("::");
  if (!product || !option) return null;
  return { product, option };
}

export async function GET() {
  try {
    const db = adminDatabases();
    const votes: Record<string, Record<string, number>> = {};
    let offset = 0;

    while (offset < MAX_SCAN) {
      const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.feedback, [
        Query.orderDesc("$createdAt"),
        Query.limit(PAGE_SIZE),
        Query.offset(offset),
      ]);

      if (documents.length === 0) break;
      for (const doc of documents) {
        const text = typeof doc.text === "string" ? doc.text : "";
        const parsed = parseVoteText(text);
        if (!parsed) continue;
        votes[parsed.product] ??= {};
        votes[parsed.product][parsed.option] = (votes[parsed.product][parsed.option] ?? 0) + 1;
      }
      if (documents.length < PAGE_SIZE) break;
      offset += documents.length;
    }

    return NextResponse.json({ votes });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return NextResponse.json({ votes: {} });
    }
    return NextResponse.json({ votes: {} }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PollVoteBody;
    const product = body.product?.trim();
    const option = body.option?.trim();
    if (!product || !option) {
      return NextResponse.json({ error: "Invalid vote payload." }, { status: 400 });
    }

    const user = await getServerUser().catch(() => null);
    const voterName = user?.name || user?.username || "Anonymous";
    const db = adminDatabases();

    await db.createDocument(DATABASE_ID, COLLECTION.feedback, ID.unique(), {
      name: voterName,
      university: "Shop Poll",
      text: `${POLL_PREFIX}${product}::${option}`,
      approved: false,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to record vote." }, { status: 500 });
  }
}
