import { openDB } from "idb";

export type QuestCategory = {
  id: string;
  name: string;
  builtIn: boolean;
  collapsed: boolean;
  order: number;
};

export type QuestFilter = {
  id: string;
  name: string;
  color: string;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  filterIds: string[];
  date: string | null;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  order: number;
};

export type HolidaySettings = {
  country: string;
  state: string;
  types: string[];
};

export type QuestState = {
  version: 1;
  categories: QuestCategory[];
  filters: QuestFilter[];
  quests: Quest[];
  holidaySettings: HolidaySettings;
};

export const MAIN_CATEGORY_ID = "category-main";
export const SIDE_CATEGORY_ID = "category-side";

const DB_NAME = "perkrucible-quest-index-db";
const STORE_NAME = "app-state";
const STATE_KEY = "quest-index-state-v1";
const BACKUP_KEY = "quest-index-state-v1-backup";

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultQuestState(): QuestState {
  return {
    version: 1,
    categories: [
      { id: MAIN_CATEGORY_ID, name: "Main Quests", builtIn: true, collapsed: false, order: 0 },
      { id: SIDE_CATEGORY_ID, name: "Side Quests", builtIn: true, collapsed: false, order: 1 },
    ],
    filters: [],
    quests: [],
    holidaySettings: {
      country: "US",
      state: "co",
      types: ["public", "observance"],
    },
  };
}

function normalizeState(value: Partial<QuestState> | null | undefined): QuestState {
  const defaults = createDefaultQuestState();
  const savedCategories = Array.isArray(value?.categories) ? value.categories : [];
  const categories = [...savedCategories];

  if (!categories.some((category) => category.id === MAIN_CATEGORY_ID)) {
    categories.unshift(defaults.categories[0]);
  }
  if (!categories.some((category) => category.id === SIDE_CATEGORY_ID)) {
    categories.splice(1, 0, defaults.categories[1]);
  }

  return {
    version: 1,
    categories: categories.map((category, index) => ({
      id: String(category.id),
      name: String(category.name || `Quest Section ${index + 1}`),
      builtIn: category.id === MAIN_CATEGORY_ID || category.id === SIDE_CATEGORY_ID || Boolean(category.builtIn),
      collapsed: Boolean(category.collapsed),
      order: Number.isFinite(category.order) ? category.order : index,
    })),
    filters: Array.isArray(value?.filters)
      ? value.filters.map((filter) => ({ id: String(filter.id), name: String(filter.name), color: String(filter.color) }))
      : [],
    quests: Array.isArray(value?.quests)
      ? value.quests.map((quest, index) => ({
          id: String(quest.id),
          title: String(quest.title),
          description: String(quest.description ?? ""),
          categoryId: String(quest.categoryId || MAIN_CATEGORY_ID),
          filterIds: Array.isArray(quest.filterIds) ? quest.filterIds.map(String) : [],
          date: quest.date ? String(quest.date) : null,
          completed: Boolean(quest.completed),
          completedAt: quest.completedAt == null ? null : Number(quest.completedAt),
          createdAt: Number(quest.createdAt) || Date.now(),
          updatedAt: Number(quest.updatedAt) || Date.now(),
          order: Number.isFinite(quest.order) ? quest.order : index,
        }))
      : [],
    holidaySettings: {
      country: String(value?.holidaySettings?.country || defaults.holidaySettings.country),
      state: String(value?.holidaySettings?.state || defaults.holidaySettings.state),
      types: Array.isArray(value?.holidaySettings?.types)
        ? value.holidaySettings.types.map(String)
        : defaults.holidaySettings.types,
    },
  };
}

function readBackup(): QuestState {
  if (typeof window === "undefined") return createDefaultQuestState();
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    return raw ? normalizeState(JSON.parse(raw) as Partial<QuestState>) : createDefaultQuestState();
  } catch {
    return createDefaultQuestState();
  }
}

function writeBackup(state: QuestState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
  } catch {}
}

async function getDb() {
  if (typeof window === "undefined") throw new Error("IndexedDB is available only in the browser");
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
    blocked() {
      console.warn("Quest Index database upgrade is blocked by another tab.");
    },
  });
}

export async function loadQuestState(): Promise<QuestState> {
  try {
    const db = await getDb();
    const saved = (await db.get(STORE_NAME, STATE_KEY)) as Partial<QuestState> | undefined;
    const normalized = saved ? normalizeState(saved) : readBackup();
    writeBackup(normalized);
    return normalized;
  } catch (error) {
    console.warn("Quest Index IndexedDB load failed; using local backup.", error);
    return readBackup();
  }
}

export async function saveQuestState(state: QuestState): Promise<void> {
  const normalized = normalizeState(state);
  writeBackup(normalized);
  try {
    const db = await getDb();
    await db.put(STORE_NAME, normalized, STATE_KEY);
  } catch (error) {
    console.warn("Quest Index IndexedDB save failed; local backup was retained.", error);
  }
}

export function normalizeImportedQuestState(value: unknown): QuestState {
  if (!value || typeof value !== "object") throw new Error("This file does not contain a Quest Index archive.");
  return normalizeState(value as Partial<QuestState>);
}
