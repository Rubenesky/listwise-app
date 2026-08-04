import { getVersion } from "@/lib/deploy-info";

export default function VersionFooter() {
  return (
    <footer className="py-4 text-center text-xs text-gray-400">
      ListWise v{getVersion()}
    </footer>
  );
}
