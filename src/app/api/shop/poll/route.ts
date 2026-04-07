import { NextRequest, NextResponse } from "next/server";
import { AppwriteException, ID } from "node-appwrite";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import { getServerUser } from "@/lib/auth";

const POLL_PREFIX = "SHOP_POLL::";
const PAGE_SIZE = 100;
// Keep aggregation and duplicate checks bounded to avoid heavy collection scans.
// Once poll usage grows beyond this cap, move poll votes into a dedicated collection.
const MAX_SCAN = 1000;

interface PollVoteBody {
  product: string;
  option: string;
}

function parseVoteText(text: string): { product: string; option: string; voterKey: string } | null {
  if (!text.startsWith(POLL_PREFIX)) return null;
  const payload = text.slice(POLL_PREFIX.length);
  const [product, option, voterKey = "legacy"] = payload.split("::");
  if (!product || !option) return null;
  return { product, option, voterKey };
}

function toVoteCookieName(product: string): string {
  const normalized = product.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 24);
  return `ea_shop_vote_${normalized}`;
}

async function hasExistingVote(product: string, voterKey: string): Promise<boolean> {
  const db = adminDatabases();
  let offset = 0;
  while (offset < MAX_SCAN) {
    const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.feedback, [
      Query.orderDesc("$createdAt"),
      Query.limit(PAGE_SIZE),
      Query.offset(offset),
    ]);
    if (documents.length === 0) return false;
    for (const doc of documents) {
      const text = typeof doc.text === "string" ? doc.text : "";
      const parsed = parseVoteText(text);
      if (!parsed) continue;
      if (parsed.product === product && parsed.voterKey === voterKey) return true;
    }
    if (documents.length < PAGE_SIZE) return false;
    offset += documents.length;
  }
  return false;
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
    return NextResponse.json({ error: "Unable to load poll votes.", votes: {} }, { status: 500 });
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
    const voterKey = user?.id ?? "anon";
    const voteCookie = toVoteCookieName(product);
    if (req.cookies.get(voteCookie)?.value === "1") {
      return NextResponse.json({ error: "Vote already recorded for this product." }, { status: 409 });
    }
    if (await hasExistingVote(product, voterKey)) {
      return NextResponse.json({ error: "Vote already recorded for this product." }, { status: 409 });
    }

    const voterName = user?.name || user?.username || "Anonymous";
    const db = adminDatabases();

    await db.createDocument(DATABASE_ID, COLLECTION.feedback, ID.unique(), {
      name: voterName,
      university: "Shop Poll",
      text: `${POLL_PREFIX}${product}::${option}::${voterKey}`,
      approved: false,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(voteCookie, "1", {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to record vote." }, { status: 500 });
  }
}
