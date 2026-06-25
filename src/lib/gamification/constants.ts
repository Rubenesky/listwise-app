export const LEVELS: { level: number; name: string; minPoints: number; icon: string }[] = [
  { level: 1, name: "Principiante", minPoints: 0, icon: "🌱" },
  { level: 2, name: "Aprendiz", minPoints: 100, icon: "📚" },
  { level: 3, name: "Escritor", minPoints: 300, icon: "✍️" },
  { level: 4, name: "Copywriter", minPoints: 700, icon: "💡" },
  { level: 5, name: "Maestro", minPoints: 2000, icon: "🏆" },
  { level: 6, name: "Leyenda", minPoints: 5000, icon: "⭐" },
];

export const ACTION_POINTS: Record<string, number> = {
  upload_csv: 1,
  generate_product: 2,
  complete_product: 3,
  edit_description: 1,
  agent_chat: 2,
  share_landing: 3,
  referral_converted: 15,
  upgrade_pro: 30,
  daily_streak: 3,
};

export const DAILY_LIMITS: Record<string, { free: number; pro: number }> = {
  upload_csv: { free: 3, pro: 10 },
  generate_product: { free: 3, pro: 10 },
  complete_product: { free: 5, pro: 20 },
  edit_description: { free: 5, pro: 20 },
  agent_chat: { free: 3, pro: 10 },
  share_landing: { free: 2, pro: 5 },
  referral_converted: { free: 5, pro: 5 },
  upgrade_pro: { free: 1, pro: 1 },
  daily_streak: { free: 1, pro: 1 },
};

export const VALID_ACTIONS = Object.keys(ACTION_POINTS);

export function getLevelInfo(points: number) {
  let currentLevel = LEVELS[0];
  for (const l of LEVELS) {
    if (points >= l.minPoints) currentLevel = l;
  }
  const nextLevelIdx = LEVELS.findIndex((l) => l.level === currentLevel.level) + 1;
  const nextLevel = nextLevelIdx < LEVELS.length ? LEVELS[nextLevelIdx] : null;
  return {
    level: currentLevel.level,
    name: currentLevel.name,
    icon: currentLevel.icon,
    currentLevelPoints: currentLevel.minPoints,
    nextLevelPoints: nextLevel?.minPoints ?? currentLevel.minPoints,
    nextLevelName: nextLevel?.name ?? null,
    isMaxLevel: !nextLevel,
  };
}
