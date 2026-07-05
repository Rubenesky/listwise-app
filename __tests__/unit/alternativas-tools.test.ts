import { getTool, tools } from "@/lib/alternativas/tools";

describe("getTool", () => {
  it("returns helium-10 tool", () => {
    const tool = getTool("helium-10");
    expect(tool).toBeDefined();
    expect(tool?.slug).toBe("helium-10");
    expect(tool?.name).toBe("Helium 10");
  });

  it("returns jasper tool", () => {
    const tool = getTool("jasper");
    expect(tool?.slug).toBe("jasper");
  });

  it("returns chatgpt tool", () => {
    const tool = getTool("chatgpt");
    expect(tool?.slug).toBe("chatgpt");
  });

  it("returns undefined for unknown slug", () => {
    expect(getTool("unknown-tool")).toBeUndefined();
    expect(getTool("")).toBeUndefined();
  });
});

describe("tools data integrity", () => {
  it("has exactly 3 tools", () => {
    expect(tools).toHaveLength(3);
  });

  it("each tool has required fields", () => {
    for (const t of tools) {
      expect(typeof t.slug).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.title).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(typeof t.verdict).toBe("string");
      expect(Array.isArray(t.comparison)).toBe(true);
      expect(Array.isArray(t.reasonsToChoose)).toBe(true);
    }
  });

  it("all slugs are unique", () => {
    const slugs = tools.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("comparison rows have required fields", () => {
    for (const t of tools) {
      for (const row of t.comparison) {
        expect(typeof row.feature).toBe("string");
        expect(row.listwise).not.toBeUndefined();
        expect(row.competitor).not.toBeUndefined();
      }
    }
  });

  it("reasons to choose have title and body", () => {
    for (const t of tools) {
      for (const reason of t.reasonsToChoose) {
        expect(typeof reason.title).toBe("string");
        expect(typeof reason.body).toBe("string");
      }
    }
  });
});
