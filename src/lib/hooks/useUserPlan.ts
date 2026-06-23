import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export function useUserPlan() {
  const { isLoaded, isSignedIn } = useUser();
  const [plan, setPlan] = useState<string>("free");
  const [status, setStatus] = useState<string>("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }

    async function fetchPlan() {
      try {
        const res = await fetch("/api/user/plan");
        if (!res.ok) throw new Error("Failed to fetch plan");
        const data = await res.json();
        setPlan(data.plan || "free");
        setStatus(data.status || "active");
      } catch (error) {
        console.error("Error fetching user plan:", error);
        setPlan("free");
        setStatus("active");
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, [isLoaded, isSignedIn]);

  return { plan, status, loading };
}