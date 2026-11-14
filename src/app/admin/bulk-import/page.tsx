import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import BulkImportClient from "./BulkImportClient";

export const metadata = {
  title: "Bulk Import | Admin",
  robots: { index: false },
};

/**
 * Server-guarded like every other admin page: the old client-only version
 * let any visitor (even logged out) open the bulk-import form UI.
 */
export default async function BulkImportPage() {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    redirect("/");
  }
  return <BulkImportClient />;
}
