export type NodeType = "inventory" | "container";

export type QuantityMode = { enabled: boolean; value: string };
export type ValueMode = { enabled: boolean; value: string };

export type InventoryItem = {
  id: string;
  title: string;
  categoryId: string | null;
  tags: string[];
  notes: string;
  image: string | null;
  quantity: QuantityMode;
  value: ValueMode;
  createdAt: number;
  updatedAt: number;
};

export type InventoryNode = {
  id: string;
  type: NodeType;
  title: string;
  categoryId: string | null;
  image: string | null;
  notes: string;
  parentId: string | null;
  childNodeIds: string[];
  itemIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CategoryScope = "node" | "item";

export type InventoryCategory = {
  id: string;
  name: string;
  scope: CategoryScope;
  createdAt: number;
};

export type InventoryState = {
  nodes: Record<string, InventoryNode>;
  items: Record<string, InventoryItem>;
  categories: InventoryCategory[];
  rootInventoryIds: string[];
};

const DB_NAME = "perkrucible-digital-inventory-db";
const STORE_NAME = "app-state";
const STATE_KEY = "inventory-state-v2";

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function getEmptyState(): InventoryState {
  return { nodes: {}, items: {}, categories: [], rootInventoryIds: [] };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
  });
}

export async function loadInventoryState(): Promise<InventoryState> {
  if (typeof window === "undefined") return getEmptyState();
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(STATE_KEY);
      request.onsuccess = () => {
        const parsed = request.result as InventoryState | undefined;
        resolve(
          parsed
            ? {
                nodes: parsed.nodes ?? {},
                items: parsed.items ?? {},
                categories: parsed.categories ?? [],
                rootInventoryIds: parsed.rootInventoryIds ?? [],
              }
            : getEmptyState(),
        );
      };
      request.onerror = () => reject(request.error ?? new Error("Could not load state"));
    });
  } catch {
    return getEmptyState();
  }
}

export async function saveInventoryState(state: InventoryState): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(state, STATE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not save state"));
  });
}
