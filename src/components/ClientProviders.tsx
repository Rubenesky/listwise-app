"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const PostHogProvider = dynamic(() => import("@/components/PostHogProvider"), { ssr: false });
const PostHogPageView = dynamic(() => import("@/components/PostHogPageView"), { ssr: false });
const WebVitals = dynamic(() => import("@/components/WebVitals"), { ssr: false });

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <Suspense fallback={null}>
        <PostHogPageView />
        <WebVitals />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
