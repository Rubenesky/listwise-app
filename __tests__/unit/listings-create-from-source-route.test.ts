import { POST } from "@/app/api/listings/create-from-source/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(), currentUser: jest.fn() }));
jest.mock("@/lib/credits/use-credits", () => ({ useCredits: jest.fn(), addCredits: jest.fn() }));
jest.mock("@/lib/trigger/send-batch-event", () => ({ sendTriggerEvent: jest.fn() }));

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@/db", () => ({
  db: {
    insert: () => ({ values: mockInsert }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  },
  schema: { listings: {} },
}));

import { auth, currentUser } from "@clerk/nextjs/server";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { sendTriggerEvent } from "@/lib/trigger/send-batch-event";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/listings/create-from-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  productName: "Persiana Veneciana Aluminio",
  category: "hogar",
  attributes: { material: "aluminio" },
  primaryKeyword: "persiana veneciana",
  mode: "creative",
};

describe("POST /api/listings/create-from-source", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (currentUser as jest.Mock).mockResolvedValue({ emailAddresses: [{ emailAddress: "a@b.com" }] });
    (useCredits as jest.Mock).mockResolvedValue({ success: true, remainingCredits: 9 });
    (sendTriggerEvent as jest.Mock).mockResolvedValue({});
    mockInsert.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body (missing productName)", async () => {
    const res = await POST(makeRequest({ ...validBody, productName: "" }));
    expect(res.status).toBe(400);
  });

  it("charges 1 credit for creative mode and creates the listing", async () => {
    const res = await POST(makeRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(useCredits).toHaveBeenCalledWith("user-1", 1, expect.any(String));
    expect(mockInsert).toHaveBeenCalled();
    expect(sendTriggerEvent).toHaveBeenCalled();
  });

  it("charges 2 credits for tecnica mode", async () => {
    await POST(makeRequest({ ...validBody, mode: "tecnica" }));
    expect(useCredits).toHaveBeenCalledWith("user-1", 2, expect.any(String));
  });

  it("returns 402 without creating a listing when credits are insufficient", async () => {
    (useCredits as jest.Mock).mockResolvedValue({ success: false, remainingCredits: 0 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(402);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("refunds credits and marks the listing FAILED when the trigger dispatch fails", async () => {
    (sendTriggerEvent as jest.Mock).mockRejectedValue(new Error("TRIGGER_FAILED"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    expect(addCredits).toHaveBeenCalledWith("user-1", 1, "refund", expect.any(String));
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 400 when attributes has too many keys", async () => {
    const tooManyAttrs: Record<string, string> = {};
    for (let i = 0; i < 21; i++) {
      tooManyAttrs[`key${i}`] = "value";
    }
    const res = await POST(makeRequest({ ...validBody, attributes: tooManyAttrs }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 when an attribute value is oversized", async () => {
    const res = await POST(
      makeRequest({ ...validBody, attributes: { material: "a".repeat(201) } })
    );
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 when category exceeds the max length", async () => {
    const res = await POST(makeRequest({ ...validBody, category: "a".repeat(101) }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 for an unrecognized marketplace value", async () => {
    const res = await POST(makeRequest({ ...validBody, marketplace: "not-a-real-marketplace" }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 for an unrecognized priceSegment value", async () => {
    const res = await POST(makeRequest({ ...validBody, priceSegment: "luxury" }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("accepts a valid, known marketplace/priceSegment and creates the listing", async () => {
    const res = await POST(
      makeRequest({ ...validBody, marketplace: "amazon", priceSegment: "premium" })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });
});
