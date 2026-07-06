"use client";

import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";

export default function WebVitals() {
  useReportWebVitals((metric) => {
    if (typeof window === "undefined") return;
    posthog.capture("$web_vitals", {
      $web_vitals_name: metric.name,
      $web_vitals_value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      $web_vitals_rating: metric.rating,
      $web_vitals_delta: Math.round(metric.delta),
      $web_vitals_id: metric.id,
      $web_vitals_navigation_type: metric.navigationType,
    });
  });

  return null;
}
