import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { CurateScreen } from "@/components/curate-screen";

export default async function CuratePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");
  const { id } = await params;
  return <CurateScreen draftId={id} />;
}
