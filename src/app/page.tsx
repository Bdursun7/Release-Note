import { githubConfigured } from "@/lib/github";
import { Landing } from "@/components/landing";

export default function HomePage() {
  return <Landing githubReady={githubConfigured()} />;
}
