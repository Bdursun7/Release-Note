import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { ReposScreen } from "@/components/repos-screen";

export const dynamic = "force-dynamic";

export default async function ReposPage() {
  const session = await requireSession();
  if (!session) redirect("/");
  return <ReposScreen />;
}
