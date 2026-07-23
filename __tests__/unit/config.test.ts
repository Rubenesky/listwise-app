describe("BASE_URL config", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.NEXT_PUBLIC_BASE_URL;
    jest.resetModules();
  });

  afterEach(() => {
    process.env = origEnv;
    jest.resetModules();
  });

  it("falls back to https://listwise-app.onrender.com when env var is not set", async () => {
    const { BASE_URL } = await import("@/lib/config");
    expect(BASE_URL).toBe("https://listwise-app.onrender.com");
  });

  it("uses NEXT_PUBLIC_BASE_URL when set", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://staging.listwise.app";
    const { BASE_URL } = await import("@/lib/config");
    expect(BASE_URL).toBe("https://staging.listwise.app");
  });
});
