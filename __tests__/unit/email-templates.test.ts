import {
  welcomeEmailTemplate,
  listingReadyTemplate,
  creditsLowTemplate,
  leadMagnetTemplate,
  activationNudgeTemplate,
  reEngagementTemplate,
  churnPreventionTemplate,
  referralRegistrationTemplate,
} from "@/lib/email/templates";

describe("welcomeEmailTemplate", () => {
  it("returns an HTML string", () => {
    const html = welcomeEmailTemplate({ firstName: "Ana" });
    expect(typeof html).toBe("string");
    expect(html).toContain("<");
  });

  it("includes the user first name", () => {
    expect(welcomeEmailTemplate({ firstName: "Ana" })).toContain("Ana");
  });

  it("escapes HTML in first name (XSS prevention)", () => {
    const html = welcomeEmailTemplate({ firstName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("works with empty first name", () => {
    const html = welcomeEmailTemplate({ firstName: "" });
    expect(html).toContain("ListWise");
  });

  it("includes a dashboard link", () => {
    expect(welcomeEmailTemplate({ firstName: "Ana" })).toContain("dashboard");
  });
});

describe("listingReadyTemplate", () => {
  it("uses singular for 1 listing", () => {
    expect(listingReadyTemplate({ count: 1 })).toContain("listing est");
  });

  it("uses plural for multiple listings", () => {
    expect(listingReadyTemplate({ count: 5 })).toContain("listings est");
  });

  it("shows up to 5 product names and truncates rest", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    const html = listingReadyTemplate({ count: 7, productNames: names });
    expect(html).toContain("A");
    expect(html).toContain("E");
    expect(html).toContain("y 2 m");
    expect(html).not.toContain(">F<");
  });

  it("works without product names", () => {
    expect(typeof listingReadyTemplate({ count: 3 })).toBe("string");
  });

  it("escapes HTML in product names", () => {
    const html = listingReadyTemplate({ count: 1, productNames: ["<b>hack</b>"] });
    expect(html).not.toContain("<b>hack</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("creditsLowTemplate", () => {
  it("shows upgrade CTA for free users", () => {
    expect(creditsLowTemplate({ remaining: 3, plan: "free" })).toContain("Ver planes");
  });

  it("shows buy-credits CTA for paid users", () => {
    expect(creditsLowTemplate({ remaining: 3, plan: "pro" })).toContain("Comprar cr");
  });

  it("includes remaining credits count", () => {
    expect(creditsLowTemplate({ remaining: 5, plan: "free" })).toContain("5 cr");
  });

  it("includes plan name for paid users", () => {
    expect(creditsLowTemplate({ remaining: 1, plan: "pro" })).toContain("pro");
  });
});

describe("leadMagnetTemplate", () => {
  const pdfUrl = "https://example.com/guide.pdf";
  const unsubscribeUrl = "https://example.com/unsub";

  it("includes PDF link", () => {
    expect(leadMagnetTemplate({ pdfUrl, unsubscribeUrl })).toContain(pdfUrl);
  });

  it("includes unsubscribe link", () => {
    expect(leadMagnetTemplate({ pdfUrl, unsubscribeUrl })).toContain(unsubscribeUrl);
  });

  it("uses name when provided", () => {
    expect(leadMagnetTemplate({ name: "Carlos", pdfUrl, unsubscribeUrl })).toContain("Carlos");
  });

  it("uses generic greeting without name", () => {
    expect(leadMagnetTemplate({ pdfUrl, unsubscribeUrl })).toContain("Hola,");
  });

  it("escapes HTML in name", () => {
    const html = leadMagnetTemplate({ name: "<img src=x>", pdfUrl, unsubscribeUrl });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("activationNudgeTemplate", () => {
  it("uses name when provided", () => {
    expect(activationNudgeTemplate({ name: "Luis" })).toContain("Luis");
  });

  it("works without name", () => {
    expect(activationNudgeTemplate({})).toContain("Hola");
  });

  it("mentions the 20 free credits", () => {
    expect(activationNudgeTemplate({})).toContain("20");
  });
});

describe("reEngagementTemplate", () => {
  it("uses name when provided", () => {
    expect(reEngagementTemplate({ name: "Marta" })).toContain("Marta");
  });

  it("works without name", () => {
    expect(reEngagementTemplate({})).toContain("Hola");
  });

  it("includes a dashboard link", () => {
    expect(reEngagementTemplate({})).toContain("dashboard");
  });
});

describe("churnPreventionTemplate", () => {
  it("shows Pro label for pro plan", () => {
    expect(churnPreventionTemplate({ plan: "pro" })).toContain("Pro");
  });

  it("shows Enterprise label for enterprise plan", () => {
    expect(churnPreventionTemplate({ plan: "enterprise" })).toContain("Enterprise");
  });

  it("escapes HTML in name", () => {
    const html = churnPreventionTemplate({ name: "<b>hacked</b>", plan: "pro" });
    expect(html).not.toContain("<b>hacked</b>");
  });

  it("works without name", () => {
    expect(churnPreventionTemplate({ plan: "pro" })).toContain("Hola");
  });
});

describe("referralRegistrationTemplate", () => {
  it("mentions the referee email when provided", () => {
    expect(referralRegistrationTemplate({ refereeEmail: "user@example.com" })).toContain("user@example.com");
  });

  it("uses generic reference when email is null", () => {
    expect(referralRegistrationTemplate({ refereeEmail: null })).toContain("alguien");
  });

  it("escapes HTML in email", () => {
    const html = referralRegistrationTemplate({ refereeEmail: "<script>x</script>@test.com" });
    expect(html).not.toContain("<script>");
  });

  it("mentions +10 credits", () => {
    expect(referralRegistrationTemplate({ refereeEmail: "a@b.com" })).toContain("+10");
  });
});
