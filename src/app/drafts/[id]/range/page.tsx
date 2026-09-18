import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { RangeScreen } from "@/components/range-screen";

export default async function RangePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");
  const { id } = await params;
  return <RangeScreen draftId={id} />;
}
