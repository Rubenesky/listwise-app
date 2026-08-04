import { getVersion } from "@/lib/deploy-info";
import packageJson from "../../package.json";

describe("getVersion", () => {
  it("returns the version from package.json", () => {
    expect(getVersion()).toBe(packageJson.version);
  });

  it("returns a valid semver string", () => {
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
