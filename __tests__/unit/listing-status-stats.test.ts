import { computeStatusStats } from "@/lib/listings/status-stats";

describe("computeStatusStats", () => {
  it("combines PENDING and PROCESSING into pendingOrProcessing", () => {
    const stats = computeStatusStats([
      { status: "PENDING", count: 3 },
      { status: "PROCESSING", count: 2 },
      { status: "COMPLETED", count: 20 },
      { status: "FAILED", count: 1 },
    ]);
    expect(stats).toEqual({ completed: 20, pendingOrProcessing: 5, failed: 1 });
  });

  it("returns zeros for statuses with no rows", () => {
    const stats = computeStatusStats([{ status: "COMPLETED", count: 66 }]);
    expect(stats).toEqual({ completed: 66, pendingOrProcessing: 0, failed: 0 });
  });

  it("returns all zeros for an empty result set", () => {
    expect(computeStatusStats([])).toEqual({ completed: 0, pendingOrProcessing: 0, failed: 0 });
  });

  it("ignores unrecognized status values instead of throwing", () => {
    const stats = computeStatusStats([{ status: "SOME_FUTURE_STATUS", count: 4 }]);
    expect(stats).toEqual({ completed: 0, pendingOrProcessing: 0, failed: 0 });
  });
});
