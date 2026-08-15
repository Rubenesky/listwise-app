// Pure completion logic for the dashboard's "Primeros pasos" onboarding
// checklist — extracted out of dashboard/page.tsx so it's testable without a
// React rendering setup. This exact logic had two real regressions in one
// session: step 3 was hardcoded to `false` (could never complete), and the
// whole checklist's visibility was derived from a live, mutable count that
// could regress after onboarding (e.g. listings deleted), resurrecting it
// for an already-onboarded account.
export interface ChecklistFlags {
  // Sticky: true once observed, even if currentCount later drops back to 0.
  everUploaded: boolean;
  currentCount: number;
  usedAgent: boolean;
}

export function isChecklistStep2Done({ everUploaded, currentCount }: Pick<ChecklistFlags, "everUploaded" | "currentCount">): boolean {
  return everUploaded || currentCount > 0;
}

export function isChecklistStep3Done({ usedAgent }: Pick<ChecklistFlags, "usedAgent">): boolean {
  return usedAgent;
}

export function isChecklistAllDone(flags: ChecklistFlags): boolean {
  return isChecklistStep2Done(flags) && isChecklistStep3Done(flags);
}
