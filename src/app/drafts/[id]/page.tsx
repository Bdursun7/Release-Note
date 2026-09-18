import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { BriefScreen } from "@/components/brief-screen";

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");
  const { id } = await params;
  return <BriefScreen draftId={id} />;
}
