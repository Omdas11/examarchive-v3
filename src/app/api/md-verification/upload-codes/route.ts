import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import {
  isFounder,
  isModerator,
  isVerificationAdmin,
  normalizeRole,
} from "@/lib/roles";
import { isAssignedMdVerifier } from "@/lib/md-verification-access";
import {
  VERIFICATION_CODE_TTL_MS,
  generateVerificationCode,
  hashUploadCode,
} from "@/lib/md-verification";
import {
  ResendConfigurationError,
  sendVerificationCodeEmail,
} from "@/lib/resend-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/md-verification/upload-codes — email a 6-char upload code
 * to a verifier. Founder or moderator only.
 *
 * Body: { email }. The target must be a registered user who may upload
 * (founder, moderator, verification admin, or assigned verifier).
 * Any previous unused code for that email is revoked first, so only
 * one live code exists per person.
 *
 * The code is single-use, valid 24 hours. Only its SHA-256 hash is
 * stored. The code itself is never returned by any API — it travels
 * only by email.
 *
 * Email needs the RESEND_API_KEY Worker secret. When it is missing the
 * send fails and NO code is created (503, plain message), so the admin
 * knows the site cannot email yet instead of silently stranding the
 * verifier.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !(isFounder(user.role) || isModerator(user.role))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    const db = await getD1();
    const target = await db
      .prepare("SELECT id, role FROM users WHERE email = ? LIMIT 1")
      .bind(email)
      .first<{ id: string; role: string }>();
    if (!target) {
      return NextResponse.json(
        { error: "No registered user with that email" },
        { status: 404 },
      );
    }
    const targetRole = normalizeRole(target.role);
    const allowed =
      isFounder(targetRole) ||
      isModerator(targetRole) ||
      isVerificationAdmin(targetRole) ||
      (await isAssignedMdVerifier(target.id));
    if (!allowed) {
      return NextResponse.json(
        { error: "That user cannot upload verification items" },
        { status: 403 },
      );
    }

    const code = generateVerificationCode();
    const codeHash = await hashUploadCode(code);
    const now = Date.now();
    const id = crypto.randomUUID();
    await db
      .prepare(
        "UPDATE md_upload_codes SET revoked_at = ? WHERE email = ? AND used_at IS NULL AND revoked_at IS NULL",
      )
      .bind(now, email)
      .run();
    await db
      .prepare(
        "INSERT INTO md_upload_codes (id, code_hash, email, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, codeHash, email, user.id, now + VERIFICATION_CODE_TTL_MS, now)
      .run();

    try {
      await sendVerificationCodeEmail({ email, code });
    } catch (err) {
      // No mail, no code: remove the row so a half-created code can
      // never be used, and say plainly what is missing.
      await db
        .prepare("DELETE FROM md_upload_codes WHERE id = ?")
        .bind(id)
        .run();
      if (err instanceof ResendConfigurationError) {
        return NextResponse.json(
          {
            error:
              "Email is not configured on the site yet — add the RESEND_API_KEY secret in the Cloudflare dashboard (Workers → examarchive → Settings → Variables), then send the code again.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Could not send the email — try again" },
        { status: 502 },
      );
    }

    return NextResponse.json({ sent: true, email }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A code was just sent — try again in a moment" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not send the verification code" },
      { status: 500 },
    );
  }
}
