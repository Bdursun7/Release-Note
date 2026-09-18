import { githubConfigured } from "@/lib/github";
import { demoAuthEnabled } from "@/lib/flags";
import { Landing } from "@/components/landing";

export default function HomePage() {
  return <Landing githubReady={githubConfigured()} demoReady={demoAuthEnabled()} />;
}
