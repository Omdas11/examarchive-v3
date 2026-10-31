import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact ExamArchive: general questions, paper corrections, and copyright takedown requests.",
};

const CONTACTS = [
  {
    title: "General questions",
    email: "contact@examarchive.dev",
    text: "Questions about the archive, your account, or a paper you cannot find.",
  },
  {
    title: "Paper corrections",
    email: "contact@examarchive.dev",
    text: "Tell us the paper title, course code, and year, and what is wrong, and we will check it.",
  },
  {
    title: "Copyright takedown",
    email: "contact@examarchive.dev",
    text: "Rights holders: send the paper title, course code, and year, proof that you hold the rights, and why the paper should be removed.",
  },
  {
    title: "Privacy questions",
    email: "privacy@examarchive.dev",
    text: "Questions about your personal data, or a request to access or delete it.",
  },
];

export default async function ContactPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  return (
    <MainLayout
      title="Contact Us"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact Us" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Contact Us</h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        ExamArchive is run by students for students of Haflong Government College, Assam
        University. We are not Assam University or Haflong Government College, and we cannot
        answer questions about official exam dates, results, or admissions. For those, please
        contact your college or the university directly.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CONTACTS.map((c) => (
          <div
            key={c.title}
            className="rounded-3xl border border-outline-variant/10 bg-surface p-6"
          >
            <h2 className="text-base font-bold">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {c.text}
            </p>
            <a
              href={`mailto:${c.email}`}
              className="mt-3 inline-block font-bold underline"
              style={{ color: "var(--color-primary)" }}
            >
              {c.email}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
        You can also reach us from the{" "}
        <Link href="/support" className="font-bold underline" style={{ color: "var(--color-primary)" }}>
          support page
        </Link>
        . We reply as students in our free time, so please allow a few days.
      </p>
    </section>
    </MainLayout>
  );
}
