import { openDB } from "idb";

export type ClosetLayer = "Hat" | "Top" | "Jacket" | "Bottoms" | "Shoes";

export type ClosetItem = {
  id: string;
  name: string;
  layer: ClosetLayer;
  subsection: string;
  image: string;
  createdAt: string;
};

export type SavedOutfit = {
  id: string;
  title: string;
  hatItemId: string | null;
  topItemId: string | null;
  jacketItemId: string | null;
  bottomsItemId: string | null;
  shoesItemId: string | null;
  createdAt: string;
};

export type SubsectionConfig = Record<ClosetLayer, string[]>;

const DB_NAME = "closet-db";
const ITEM_STORE = "items";
const META_STORE = "meta";
const OUTFIT_STORE = "outfits";
const SUBSECTION_CONFIG_KEY = "subsection-config";

const LS_ITEMS_KEY = "closet-db-items-backup";
const LS_OUTFITS_KEY = "closet-db-outfits-backup";
const LS_SUBSECTION_KEY = "closet-db-subsections-backup";

const DEFAULT_SUBSECTIONS: SubsectionConfig = {
  Hat: ["Caps", "Beanies"],
  Top: ["T-Shirts", "Long Sleeves"],
  Jacket: ["Hoodies", "Zip-Ups", "Jackets"],
  Bottoms: ["Jeans", "Cargos", "Shorts"],
  Shoes: ["Sneakers", "Boots"],
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function normalizeSubsectionConfig(saved: Partial<SubsectionConfig> | null | undefined): SubsectionConfig {
  return {
    Hat: saved?.Hat?.length ? saved.Hat : DEFAULT_SUBSECTIONS.Hat,
    Top: saved?.Top?.length ? saved.Top : DEFAULT_SUBSECTIONS.Top,
    Jacket: saved?.Jacket?.length ? saved.Jacket : DEFAULT_SUBSECTIONS.Jacket,
    Bottoms: saved?.Bottoms?.length ? saved.Bottoms : DEFAULT_SUBSECTIONS.Bottoms,
    Shoes: saved?.Shoes?.length ? saved.Shoes : DEFAULT_SUBSECTIONS.Shoes,
  };
}

async function getDb() {
  if (!isBrowser()) {
    throw new Error("IndexedDB is only available in the browser");
  }

  return openDB(DB_NAME, 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        db.createObjectStore(ITEM_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }

      if (!db.objectStoreNames.contains(OUTFIT_STORE)) {
        db.createObjectStore(OUTFIT_STORE, { keyPath: "id" });
      }
    },
    blocked() {
      console.warn("Closet DB upgrade blocked. Close other tabs using this app.");
    },
    blocking() {
      console.warn("Closet DB is blocking a newer version in another tab.");
    },
    terminated() {
      console.warn("Closet DB connection unexpectedly terminated.");
    },
  });
}

async function getAllItemsFromIndexedDb(): Promise<ClosetItem[]> {
  const db = await getDb();
  return db.getAll(ITEM_STORE);
}

async function getAllOutfitsFromIndexedDb(): Promise<SavedOutfit[]> {
  const db = await getDb();
  return db.getAll(OUTFIT_STORE);
}

async function getSubsectionConfigFromIndexedDb(): Promise<SubsectionConfig | null> {
  const db = await getDb();
  const saved = await db.get(META_STORE, SUBSECTION_CONFIG_KEY);
  if (!saved) return null;
  return normalizeSubsectionConfig(saved);
}

async function syncItemsBackupFromDb() {
  try {
    const items = await getAllItemsFromIndexedDb();
    writeLocalJson<ClosetItem[]>(LS_ITEMS_KEY, items);
  } catch {}
}

async function syncOutfitsBackupFromDb() {
  try {
    const outfits = await getAllOutfitsFromIndexedDb();
    writeLocalJson<SavedOutfit[]>(LS_OUTFITS_KEY, outfits);
  } catch {}
}

export async function getAllItems(): Promise<ClosetItem[]> {
  try {
    const items = await getAllItemsFromIndexedDb();
    writeLocalJson<ClosetItem[]>(LS_ITEMS_KEY, items);
    return items;
  } catch (error) {
    console.warn("Falling back to localStorage items backup.", error);
    return readLocalJson<ClosetItem[]>(LS_ITEMS_KEY, []);
  }
}

export async function saveItem(item: ClosetItem): Promise<string> {
  try {
    const db = await getDb();
    await db.put(ITEM_STORE, item);
    await syncItemsBackupFromDb();
    return item.id;
  } catch (error) {
    console.warn("IndexedDB saveItem failed. Saving to localStorage backup.", error);

    const items = readLocalJson<ClosetItem[]>(LS_ITEMS_KEY, []);
    const existingIndex = items.findIndex((it) => it.id === item.id);

    if (existingIndex >= 0) {
      items[existingIndex] = item;
    } else {
      items.push(item);
    }

    writeLocalJson(LS_ITEMS_KEY, items);
    return item.id;
  }
}

export async function deleteItemFromDb(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(ITEM_STORE, id);
    await syncItemsBackupFromDb();
  } catch (error) {
    console.warn("IndexedDB deleteItem failed. Updating localStorage backup.", error);

    const items = readLocalJson<ClosetItem[]>(LS_ITEMS_KEY, []);
    writeLocalJson(
      LS_ITEMS_KEY,
      items.filter((item) => item.id !== id)
    );
  }
}

export async function getSubsectionConfig(): Promise<SubsectionConfig> {
  try {
    const config = await getSubsectionConfigFromIndexedDb();
    const normalized = normalizeSubsectionConfig(config);
    writeLocalJson<SubsectionConfig>(LS_SUBSECTION_KEY, normalized);
    return normalized;
  } catch (error) {
    console.warn("Falling back to localStorage subsection backup.", error);
    return normalizeSubsectionConfig(
      readLocalJson<SubsectionConfig | null>(LS_SUBSECTION_KEY, DEFAULT_SUBSECTIONS)
    );
  }
}

export async function saveSubsectionConfig(config: SubsectionConfig): Promise<void> {
  const normalized = normalizeSubsectionConfig(config);

  try {
    const db = await getDb();
    await db.put(META_STORE, normalized, SUBSECTION_CONFIG_KEY);
    writeLocalJson<SubsectionConfig>(LS_SUBSECTION_KEY, normalized);
  } catch (error) {
    console.warn("IndexedDB saveSubsectionConfig failed. Saving to localStorage backup.", error);
    writeLocalJson<SubsectionConfig>(LS_SUBSECTION_KEY, normalized);
  }
}

export async function getSavedOutfits(): Promise<SavedOutfit[]> {
  try {
    const outfits = await getAllOutfitsFromIndexedDb();
    writeLocalJson<SavedOutfit[]>(LS_OUTFITS_KEY, outfits);
    return outfits;
  } catch (error) {
    console.warn("Falling back to localStorage outfits backup.", error);
    return readLocalJson<SavedOutfit[]>(LS_OUTFITS_KEY, []);
  }
}

export async function saveOutfit(outfit: SavedOutfit): Promise<string> {
  try {
    const db = await getDb();
    await db.put(OUTFIT_STORE, outfit);
    await syncOutfitsBackupFromDb();
    return outfit.id;
  } catch (error) {
    console.warn("IndexedDB saveOutfit failed. Saving to localStorage backup.", error);

    const outfits = readLocalJson<SavedOutfit[]>(LS_OUTFITS_KEY, []);
    const existingIndex = outfits.findIndex((it) => it.id === outfit.id);

    if (existingIndex >= 0) {
      outfits[existingIndex] = outfit;
    } else {
      outfits.push(outfit);
    }

    writeLocalJson(LS_OUTFITS_KEY, outfits);
    return outfit.id;
  }
}

export async function deleteSavedOutfit(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(OUTFIT_STORE, id);
    await syncOutfitsBackupFromDb();
  } catch (error) {
    console.warn("IndexedDB deleteSavedOutfit failed. Updating localStorage backup.", error);

    const outfits = readLocalJson<SavedOutfit[]>(LS_OUTFITS_KEY, []);
    writeLocalJson(
      LS_OUTFITS_KEY,
      outfits.filter((outfit) => outfit.id !== id)
    );
  }
}