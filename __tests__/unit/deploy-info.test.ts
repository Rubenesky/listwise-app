import { getEnvironmentLabel, getShortCommit } from "@/lib/deploy-info";

describe("getEnvironmentLabel", () => {
  const original = process.env.RENDER_SERVICE_NAME;
  afterEach(() => {
    if (original === undefined) delete process.env.RENDER_SERVICE_NAME;
    else process.env.RENDER_SERVICE_NAME = original;
  });

  it('returns "producción" for the production service name', () => {
    process.env.RENDER_SERVICE_NAME = "listwise-app";
    expect(getEnvironmentLabel()).toBe("producción");
  });

  it('returns "staging" for the staging service name', () => {
    process.env.RENDER_SERVICE_NAME = "listwise-app-staging";
    expect(getEnvironmentLabel()).toBe("staging");
  });

  it('returns "local" when RENDER_SERVICE_NAME is unset', () => {
    delete process.env.RENDER_SERVICE_NAME;
    expect(getEnvironmentLabel()).toBe("local");
  });

  it('returns "local" for an unrecognized service name', () => {
    process.env.RENDER_SERVICE_NAME = "some-other-service";
    expect(getEnvironmentLabel()).toBe("local");
  });
});

describe("getShortCommit", () => {
  const original = process.env.RENDER_GIT_COMMIT;
  afterEach(() => {
    if (original === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = original;
  });

  it("returns the first 7 characters of the commit SHA when set", () => {
    process.env.RENDER_GIT_COMMIT = "908b21083a4c5d6e7f8091a2b3c4d5e6f7081920";
    expect(getShortCommit()).toBe("908b210");
  });

  it("returns null when RENDER_GIT_COMMIT is unset", () => {
    delete process.env.RENDER_GIT_COMMIT;
    expect(getShortCommit()).toBeNull();
  });
});
