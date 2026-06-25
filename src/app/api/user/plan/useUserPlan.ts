import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export function useUserPlan() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [plan, setPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    // Clerk publicMetadata is available instantly (no network round-trip)
    const metadataPlan = user?.publicMetadata?.plan as string | undefined;
    if (metadataPlan) {
      setPlan(metadataPlan);
      setLoading(false);
      return;
    }

    // Fallback for users without metadata yet — fetches from DB and syncs metadata
    async function fetchAndSync() {
      try {
        const res = await fetch("/api/user/plan");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPlan(data.plan ?? "free");
      } catch {
        setPlan("free");
      } finally {
        setLoading(false);
      }
    }

    fetchAndSync();
  }, [isLoaded, isSignedIn, user]);

  return { plan, loading };
}
