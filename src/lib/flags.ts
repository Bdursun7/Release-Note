export function demoAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ALLOW_DEMO_AUTH === "true") return true;
  if (env.ALLOW_DEMO_AUTH === "false") return false;
  return env.NODE_ENV !== "production";
}
