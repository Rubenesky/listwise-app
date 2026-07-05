const mockGroqCreate = jest.fn();
const mockGeminiCreate = jest.fn();

jest.mock("@/lib/ai/client-groq", () => ({
  groq: { chat: { completions: { create: mockGroqCreate } } },
}));
jest.mock("@/lib/ai/client-gemini", () => ({
  gemini: { chat: { completions: { create: mockGeminiCreate } } },
}));

describe("getAvailableProviders", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    jest.resetModules();
  });

  afterEach(() => {
    process.env = origEnv;
    jest.resetModules();
  });

  it("returns [groq] when only GROQ_API_KEY is set", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    const { getAvailableProviders } = await import("@/lib/ai/providers");
    expect(getAvailableProviders()).toEqual(["groq"]);
  });

  it("returns [gemini] when only GEMINI_API_KEY is set", async () => {
    process.env.GEMINI_API_KEY = "AIza_test";
    const { getAvailableProviders } = await import("@/lib/ai/providers");
    expect(getAvailableProviders()).toEqual(["gemini"]);
  });

  it("returns both providers when both keys are set", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.GEMINI_API_KEY = "AIza_test";
    const { getAvailableProviders } = await import("@/lib/ai/providers");
    const available = getAvailableProviders();
    expect(available).toContain("groq");
    expect(available).toContain("gemini");
  });

  it("throws when no keys are set", async () => {
    const { getAvailableProviders } = await import("@/lib/ai/providers");
    expect(() => getAvailableProviders()).toThrow("No hay proveedores");
  });
});

describe("getDefaultProvider", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    jest.resetModules();
  });

  afterEach(() => {
    process.env = origEnv;
    jest.resetModules();
  });

  it("prefers gemini when both are available", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.GEMINI_API_KEY = "AIza_test";
    const { getDefaultProvider } = await import("@/lib/ai/providers");
    expect(getDefaultProvider()).toBe("gemini");
  });

  it("returns groq when only groq is available", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    const { getDefaultProvider } = await import("@/lib/ai/providers");
    expect(getDefaultProvider()).toBe("groq");
  });

  it("returns gemini when only gemini is available", async () => {
    process.env.GEMINI_API_KEY = "AIza_test";
    const { getDefaultProvider } = await import("@/lib/ai/providers");
    expect(getDefaultProvider()).toBe("gemini");
  });
});

describe("getAIResponse", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
    process.env.GEMINI_API_KEY = "AIza_test";
    process.env.GROQ_API_KEY = "gsk_test";
    jest.resetModules();
  });

  afterEach(() => {
    process.env = origEnv;
    jest.resetModules();
  });

  const messages = [{ role: "user", content: "hello" }];

  it("calls the gemini client when gemini is the default", async () => {
    mockGeminiCreate.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
    const { getAIResponse } = await import("@/lib/ai/providers");
    const result = await getAIResponse(messages);
    expect(mockGeminiCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ choices: [{ message: { content: "ok" } }] });
  });

  it("calls a specific provider when explicitly requested", async () => {
    mockGroqCreate.mockResolvedValueOnce({ choices: [{ message: { content: "groq-result" } }] });
    const { getAIResponse } = await import("@/lib/ai/providers");
    await getAIResponse(messages, "groq");
    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
    expect(mockGeminiCreate).not.toHaveBeenCalled();
  });

  it("falls back to groq when gemini fails", async () => {
    mockGeminiCreate.mockRejectedValueOnce(new Error("gemini down"));
    mockGroqCreate.mockResolvedValueOnce({ choices: [{ message: { content: "fallback" } }] });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { getAIResponse } = await import("@/lib/ai/providers");
    const result = await getAIResponse(messages);
    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ choices: [{ message: { content: "fallback" } }] });
    consoleSpy.mockRestore();
  });

  it("throws when both primary and fallback fail", async () => {
    mockGeminiCreate.mockRejectedValueOnce(new Error("gemini down"));
    mockGroqCreate.mockRejectedValueOnce(new Error("groq down"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { getAIResponse } = await import("@/lib/ai/providers");
    await expect(getAIResponse(messages)).rejects.toThrow("groq down");
    consoleSpy.mockRestore();
  });

  it("passes options (temperature, max_tokens) to the client", async () => {
    mockGeminiCreate.mockResolvedValueOnce({ choices: [] });
    const { getAIResponse } = await import("@/lib/ai/providers");
    await getAIResponse(messages, "gemini", { temperature: 0.5, max_tokens: 100 });
    expect(mockGeminiCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.5, max_tokens: 100 })
    );
  });
});
