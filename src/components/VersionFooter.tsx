import { getEnvironmentLabel, getShortCommit } from "@/lib/deploy-info";

export default function VersionFooter() {
  const env = getEnvironmentLabel();
  const commit = getShortCommit();

  return (
    <footer className="py-4 text-center text-xs text-gray-400">
      ListWise · {env}
      {commit && ` · ${commit}`}
    </footer>
  );
}
