import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { GenerateScreen } from "@/components/generate-screen";

export default async function GeneratePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");
  const { id } = await params;
  return <GenerateScreen draftId={id} />;
}
