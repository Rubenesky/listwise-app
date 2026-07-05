import { getPost, posts } from "@/lib/blog/posts";

describe("getPost", () => {
  it("returns a post for a valid slug", () => {
    const post = getPost("como-generar-descripciones-productos-amazon-ia");
    expect(post).toBeDefined();
    expect(post?.slug).toBe("como-generar-descripciones-productos-amazon-ia");
  });

  it("returns undefined for unknown slug", () => {
    expect(getPost("non-existent-post")).toBeUndefined();
    expect(getPost("")).toBeUndefined();
  });

  it("returns the correct post content for a specific slug", () => {
    const post = getPost("bullet-points-amazon-como-escribirlos");
    expect(post?.category).toBe("Amazon");
    expect(post?.readMinutes).toBeGreaterThan(0);
    expect(post?.content.length).toBeGreaterThan(100);
  });
});

describe("posts data integrity", () => {
  it("has at least 5 posts", () => {
    expect(posts.length).toBeGreaterThanOrEqual(5);
  });

  it("each post has required fields", () => {
    for (const p of posts) {
      expect(typeof p.slug).toBe("string");
      expect(p.slug.length).toBeGreaterThan(0);
      expect(typeof p.title).toBe("string");
      expect(typeof p.description).toBe("string");
      expect(typeof p.publishedAt).toBe("string");
      expect(typeof p.readMinutes).toBe("number");
      expect(p.readMinutes).toBeGreaterThan(0);
      expect(typeof p.category).toBe("string");
      expect(typeof p.content).toBe("string");
    }
  });

  it("all slugs are unique", () => {
    const slugs = posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("publishedAt dates are valid ISO date strings (YYYY-MM-DD)", () => {
    for (const p of posts) {
      expect(p.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(p.publishedAt).toString()).not.toBe("Invalid Date");
    }
  });

  it("content contains HTML tags", () => {
    for (const p of posts) {
      expect(p.content).toContain("<");
      expect(p.content).toContain(">");
    }
  });

  it("slugs use only lowercase letters numbers and hyphens", () => {
    for (const p of posts) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("all categories are known values", () => {
    const knownCategories = new Set(["Guías", "Amazon", "SEO", "IA & Tendencias", "Recursos"]);
    for (const p of posts) {
      expect(knownCategories.has(p.category)).toBe(true);
    }
  });

  it("getPost is consistent with posts array (finds all posts)", () => {
    for (const p of posts) {
      expect(getPost(p.slug)).toEqual(p);
    }
  });
});
