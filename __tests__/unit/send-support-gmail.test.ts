const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn((_options?: unknown) => ({ sendMail: mockSendMail }));
const mockResolve4 = jest.fn();
const mockLogError = jest.fn();
const mockLogWarn = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: (options: unknown) => mockCreateTransport(options),
}));

jest.mock("node:dns/promises", () => ({
  resolve4: (...args: [string]) => mockResolve4(...args),
}));

jest.mock("@/lib/logger", () => ({
  log: { error: mockLogError, warn: mockLogWarn, info: jest.fn(), debug: jest.fn() },
}));

import { sendSupportEmailViaGmail } from "@/lib/email/send-support-gmail";

describe("sendSupportEmailViaGmail", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
    mockResolve4.mockResolvedValue(["142.250.1.109"]);
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("skips sending and returns success: false when GMAIL_SUPPORT_USER is not set", async () => {
    delete process.env.GMAIL_SUPPORT_USER;
    process.env.GMAIL_SUPPORT_APP_PASSWORD = "app-pass";
    const result = await sendSupportEmailViaGmail({ subject: "Test", html: "<p>hi</p>" });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false });
    expect(mockLogWarn).toHaveBeenCalled();
  });

  it("skips sending and returns success: false when GMAIL_SUPPORT_APP_PASSWORD is not set", async () => {
    process.env.GMAIL_SUPPORT_USER = "support@gmail.com";
    delete process.env.GMAIL_SUPPORT_APP_PASSWORD;
    const result = await sendSupportEmailViaGmail({ subject: "Test", html: "<p>hi</p>" });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false });
  });

  it("sends from and to the same configured Gmail account, and returns success: true", async () => {
    process.env.GMAIL_SUPPORT_USER = "support@gmail.com";
    process.env.GMAIL_SUPPORT_APP_PASSWORD = "app-pass";
    mockSendMail.mockResolvedValue({ messageId: "abc" });
    const result = await sendSupportEmailViaGmail({ subject: "Hello", html: "<p>world</p>" });
    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "support@gmail.com", to: "support@gmail.com", subject: "Hello", html: "<p>world</p>" })
    );
  });

  it("authenticates the transport with the configured Gmail user and app password", async () => {
    process.env.GMAIL_SUPPORT_USER = "support@gmail.com";
    process.env.GMAIL_SUPPORT_APP_PASSWORD = "app-pass";
    mockSendMail.mockResolvedValue({});
    await sendSupportEmailViaGmail({ subject: "Test", html: "<p>test</p>" });
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "support@gmail.com", pass: "app-pass" } })
    );
  });

  it("resolves smtp.gmail.com's A record itself and connects to that literal IPv4 address, keeping TLS servername correct", async () => {
    // Real production failure: nodemailer resolves both A and AAAA records
    // and picks one at random — there is no "prefer IPv4" option it reads.
    // Render has no outbound IPv6 route, so a random AAAA pick fails with
    // ENETUNREACH. Resolving the A record ourselves and connecting to that
    // literal IP sidesteps nodemailer's own dual-family DNS logic entirely.
    process.env.GMAIL_SUPPORT_USER = "support@gmail.com";
    process.env.GMAIL_SUPPORT_APP_PASSWORD = "app-pass";
    mockResolve4.mockResolvedValue(["142.250.1.109"]);
    mockSendMail.mockResolvedValue({});
    await sendSupportEmailViaGmail({ subject: "Test", html: "<p>test</p>" });
    expect(mockResolve4).toHaveBeenCalledWith("smtp.gmail.com");
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "142.250.1.109",
        port: 465,
        secure: true,
        tls: { servername: "smtp.gmail.com" },
      })
    );
  });

  it("swallows SMTP exceptions and returns success: false instead of throwing", async () => {
    process.env.GMAIL_SUPPORT_USER = "support@gmail.com";
    process.env.GMAIL_SUPPORT_APP_PASSWORD = "app-pass";
    mockSendMail.mockRejectedValue(new Error("Invalid login"));
    await expect(sendSupportEmailViaGmail({ subject: "Test", html: "<p>test</p>" })).resolves.toEqual({ success: false });
    expect(mockLogError).toHaveBeenCalled();
  });

  it("swallows a DNS resolution failure too, returning success: false instead of throwing", async () => {
    process.env.GMAIL_SUPPORT_USER = "support@gmail.com";
    process.env.GMAIL_SUPPORT_APP_PASSWORD = "app-pass";
    mockResolve4.mockRejectedValue(new Error("ENOTFOUND smtp.gmail.com"));
    await expect(sendSupportEmailViaGmail({ subject: "Test", html: "<p>test</p>" })).resolves.toEqual({ success: false });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
  });
});
