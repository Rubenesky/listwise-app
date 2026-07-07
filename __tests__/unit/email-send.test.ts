const mockSend = jest.fn();
const mockLogError = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

jest.mock("@/lib/logger", () => ({
  log: { error: mockLogError, warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { sendEmail } from "@/lib/email/send";

describe("sendEmail", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("skips sending when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    await sendEmail({ to: "user@example.com", subject: "Test", html: "<p>hi</p>" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("calls resend.emails.send when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValue({ data: { id: "email-id-001" }, error: null });
    await sendEmail({ to: "user@example.com", subject: "Hello", html: "<p>world</p>" });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com", subject: "Hello", html: "<p>world</p>" })
    );
  });

  it("includes a from address in the send call", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValue({ data: {}, error: null });
    await sendEmail({ to: "user@example.com", subject: "Test", html: "<p>test</p>" });
    expect(mockSend.mock.calls[0][0].from).toBeTruthy();
  });

  it("logs error but does not throw when resend returns an error object", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValue({ data: null, error: { message: "invalid email" } });
    await expect(sendEmail({ to: "bad-email", subject: "Test", html: "<p>test</p>" })).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalled();
  });

  it("swallows exceptions thrown by resend", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockRejectedValue(new Error("network error"));
    await expect(sendEmail({ to: "user@example.com", subject: "Test", html: "<p>test</p>" })).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalled();
  });

  it("defaults from address to ListWise brand when FROM_EMAIL is not set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.FROM_EMAIL;
    mockSend.mockResolvedValue({ data: {}, error: null });
    await sendEmail({ to: "user@example.com", subject: "Test", html: "<p>test</p>" });
    const from = mockSend.mock.calls[0][0].from as string;
    expect(from).toContain("listwise.app");
  });
});
