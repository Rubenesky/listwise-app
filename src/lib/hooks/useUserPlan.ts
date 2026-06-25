import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export function useUserPlan() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [plan, setPlan] = useState<string>("free");
  const [status, setStatus] = useState<string>("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    // Clerk publicMetadata available instantly — no network round-trip
    const metadataPlan = user?.publicMetadata?.plan as string | undefined;
    if (metadataPlan) {
      setPlan(metadataPlan);
      setLoading(false);
      return;
    }

    // Fallback for users without metadata yet
    async function fetchPlan() {
      try {
        const res = await fetch("/api/user/plan");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPlan(data.plan ?? "free");
        setStatus(data.status ?? "active");
      } catch {
        setPlan("free");
        setStatus("active");
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, [isLoaded, isSignedIn, user]);

  return { plan, status, loading };
}
