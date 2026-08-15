// __tests__/unit/support-contact-route.test.ts
import { POST } from "@/app/api/support/contact/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(), currentUser: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  ratelimitSupportContact: { limit: jest.fn() },
}));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn() }));

import { auth, currentUser } from "@clerk/nextjs/server";
import { ratelimitSupportContact } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/support/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/support/contact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (currentUser as jest.Mock).mockResolvedValue({
      fullName: "Ada Lovelace",
      username: "ada",
      primaryEmailAddress: { emailAddress: "ada@example.com" },
    });
    (ratelimitSupportContact.limit as jest.Mock).mockResolvedValue({ success: true });
    (sendEmail as jest.Mock).mockResolvedValue({ success: true });
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ message: "Necesito ayuda con mi cuenta" }));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when the daily rate limit is exceeded", async () => {
    (ratelimitSupportContact.limit as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST(makeRequest({ message: "Necesito ayuda con mi cuenta" }));
    expect(res.status).toBe(429);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when the message is too short", async () => {
    const res = await POST(makeRequest({ message: "hola" }));
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the email to the fixed support inbox with the user's identity on success", async () => {
    const res = await POST(makeRequest({ message: "Necesito ayuda con mi cuenta, gracias" }));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "dcrubben25@gmail.com",
        subject: expect.stringContaining("Ada Lovelace"),
      })
    );
  });

  it("escapes HTML in the user-supplied message before embedding it in the email", async () => {
    await POST(makeRequest({ message: "<script>alert(1)</script> ayuda por favor" }));
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;");
  });

  it("returns 500 and does not crash when sendEmail throws", async () => {
    (sendEmail as jest.Mock).mockRejectedValue(new Error("Resend down"));
    const res = await POST(makeRequest({ message: "Necesito ayuda con mi cuenta" }));
    expect(res.status).toBe(500);
  });

  it("returns 502 with a real error — not a false success — when sendEmail resolves with success: false", async () => {
    // This is the realistic failure mode: sendEmail() catches the Resend API
    // error internally (bad key, unverified sender domain, etc.) and resolves
    // with success: false rather than throwing.
    (sendEmail as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST(makeRequest({ message: "Necesito ayuda con mi cuenta" }));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.success).not.toBe(true);
  });
});
