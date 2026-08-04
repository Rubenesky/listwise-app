// Render automatically injects RENDER_SERVICE_NAME and RENDER_GIT_COMMIT at
// runtime — no manual env var configuration needed. NODE_ENV can't be used
// to distinguish staging from production because Next.js forces it to
// "production" for any production build regardless of render.yaml.
const ENV_LABELS: Record<string, string> = {
  "listwise-app": "producción",
  "listwise-app-staging": "staging",
};

export function getEnvironmentLabel(): string {
  const serviceName = process.env.RENDER_SERVICE_NAME;
  return (serviceName && ENV_LABELS[serviceName]) || "local";
}

export function getShortCommit(): string | null {
  const commit = process.env.RENDER_GIT_COMMIT;
  return commit ? commit.slice(0, 7) : null;
}
