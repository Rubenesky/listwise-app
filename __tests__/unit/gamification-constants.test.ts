import { getLevelInfo, LEVELS, ACTION_POINTS, DAILY_LIMITS, VALID_ACTIONS } from "@/lib/gamification/constants";

describe("getLevelInfo", () => {
  it("0 points → level 1 Principiante", () => {
    const info = getLevelInfo(0);
    expect(info.level).toBe(1);
    expect(info.name).toBe("Principiante");
    expect(info.isMaxLevel).toBe(false);
  });

  it("99 points → still level 1", () => {
    expect(getLevelInfo(99).level).toBe(1);
  });

  it("100 points → level 2 Aprendiz", () => {
    const info = getLevelInfo(100);
    expect(info.level).toBe(2);
    expect(info.name).toBe("Aprendiz");
  });

  it("300 points → level 3 Escritor", () => {
    expect(getLevelInfo(300).level).toBe(3);
  });

  it("700 points → level 4 Copywriter", () => {
    expect(getLevelInfo(700).level).toBe(4);
  });

  it("2000 points → level 5 Maestro", () => {
    expect(getLevelInfo(2000).level).toBe(5);
  });

  it("5000 points → level 6 Leyenda (max)", () => {
    const info = getLevelInfo(5000);
    expect(info.level).toBe(6);
    expect(info.isMaxLevel).toBe(true);
    expect(info.nextLevelName).toBeNull();
  });

  it("points way above max stays at level 6", () => {
    expect(getLevelInfo(999999).level).toBe(6);
  });

  it("returns correct nextLevelPoints at level 1", () => {
    const info = getLevelInfo(0);
    expect(info.nextLevelPoints).toBe(100);
    expect(info.nextLevelName).toBe("Aprendiz");
  });

  it("returns correct currentLevelPoints", () => {
    expect(getLevelInfo(350).currentLevelPoints).toBe(300);
  });
});

describe("LEVELS", () => {
  it("has exactly 6 levels", () => {
    expect(LEVELS).toHaveLength(6);
  });

  it("is sorted by minPoints ascending", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minPoints).toBeGreaterThan(LEVELS[i - 1].minPoints);
    }
  });

  it("level 1 starts at 0 points", () => {
    expect(LEVELS[0].minPoints).toBe(0);
  });

  it("each level has required fields", () => {
    for (const l of LEVELS) {
      expect(typeof l.level).toBe("number");
      expect(typeof l.name).toBe("string");
      expect(typeof l.minPoints).toBe("number");
      expect(typeof l.icon).toBe("string");
    }
  });
});

describe("ACTION_POINTS", () => {
  it("all actions have positive point values", () => {
    for (const [action, pts] of Object.entries(ACTION_POINTS)) {
      expect(pts).toBeGreaterThan(0);
      expect(typeof action).toBe("string");
    }
  });

  it("referral_converted gives more points than generate_product", () => {
    expect(ACTION_POINTS.referral_converted).toBeGreaterThan(ACTION_POINTS.generate_product);
  });

  it("upgrade_pro gives the highest point value", () => {
    const max = Math.max(...Object.values(ACTION_POINTS));
    expect(ACTION_POINTS.upgrade_pro).toBe(max);
  });
});

describe("DAILY_LIMITS", () => {
  it("every action in ACTION_POINTS has a DAILY_LIMITS entry", () => {
    for (const action of Object.keys(ACTION_POINTS)) {
      expect(DAILY_LIMITS).toHaveProperty(action);
    }
  });

  it("pro limits are always >= free limits", () => {
    for (const limits of Object.values(DAILY_LIMITS)) {
      expect(limits.pro).toBeGreaterThanOrEqual(limits.free);
    }
  });
});

describe("VALID_ACTIONS", () => {
  it("matches ACTION_POINTS keys exactly", () => {
    expect(VALID_ACTIONS).toEqual(Object.keys(ACTION_POINTS));
  });
});
