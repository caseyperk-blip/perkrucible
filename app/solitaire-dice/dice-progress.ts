export type DiceSkinId = "classic" | "cream" | "ruby" | "steel" | "gold";

export type DiceProgress = {
  completedGames: number;
  unlocked: DiceSkinId[];
  selected: DiceSkinId;
  bestScore: number | null;
};

export const DICE_PROGRESS_KEY = "perkrucible:solitaire-dice:collection:v1";
export const MAX_POSSIBLE_SCORE = 8100;

export const DEFAULT_DICE_PROGRESS: DiceProgress = {
  completedGames: 0,
  unlocked: ["classic"],
  selected: "classic",
  bestScore: null,
};

export const DICE_SKINS: { id: DiceSkinId; name: string; challenge: string | null; secret?: boolean }[] = [
  { id: "classic", name: "Classic White", challenge: "Available from the start." },
  { id: "cream", name: "Cream Ivory", challenge: "Complete one full game." },
  { id: "ruby", name: "Translucent Ruby", challenge: "Complete five full games." },
  { id: "steel", name: "Polished Steel", challenge: "Finish a game with at least three free rides." },
  { id: "gold", name: "Gilded Gold", challenge: null, secret: true },
];

const isSkinId = (value: unknown): value is DiceSkinId =>
  value === "classic" || value === "cream" || value === "ruby" || value === "steel" || value === "gold";

export function readDiceProgress(): DiceProgress {
  try {
    const raw = window.localStorage.getItem(DICE_PROGRESS_KEY);
    if (!raw) return DEFAULT_DICE_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<DiceProgress>;
    const unlocked: DiceSkinId[] = Array.isArray(parsed.unlocked) ? parsed.unlocked.filter(isSkinId) : ["classic"];
    if (!unlocked.includes("classic")) unlocked.unshift("classic");
    return {
      completedGames: Number.isFinite(parsed.completedGames) ? Math.max(0, parsed.completedGames as number) : 0,
      unlocked: [...new Set(unlocked)],
      selected: isSkinId(parsed.selected) && unlocked.includes(parsed.selected) ? parsed.selected : "classic",
      bestScore: Number.isFinite(parsed.bestScore) ? parsed.bestScore as number : null,
    };
  } catch {
    return DEFAULT_DICE_PROGRESS;
  }
}

export function saveDiceProgress(progress: DiceProgress) {
  try { window.localStorage.setItem(DICE_PROGRESS_KEY, JSON.stringify(progress)); } catch { /* Keep game progress in memory if storage is unavailable. */ }
}
