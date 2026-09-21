import { githubConfigured } from "@/lib/github";
import { demoAuthEnabled } from "@/lib/flags";
import { Landing } from "@/components/landing";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const raw = params.error;
  const authError = Array.isArray(raw) ? raw[0] : raw;
  return (
    <Landing oauthReady={githubConfigured()} demoReady={demoAuthEnabled()} authError={authError} />
  );
}
