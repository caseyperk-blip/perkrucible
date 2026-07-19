"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "./inventory.module.css";
import {
  CategoryScope,
  InventoryCategory,
  InventoryItem,
  InventoryNode,
  InventoryState,
  createId,
  getEmptyState,
  loadInventoryState,
  saveInventoryState,
} from "./db";

const FALLBACK_IMAGE = "/images/digital-inventory-placeholder.png";
const HELP_KEY = "perkrucible-inventory-help-dismissed-v1";

type SearchMode = "everything" | "category" | "tag";
type NodeViewMode = "grid" | "list";
type ModalState =
  | { type: "search" }
  | { type: "createNode"; parentId: string | null }
  | { type: "editNode"; nodeId: string }
  | { type: "createItem"; nodeId: string }
  | { type: "editItem"; nodeId: string; itemId: string }
  | { type: "moveNode"; nodeId: string }
  | { type: "moveItem"; nodeId: string; itemId: string }
  | { type: "manageCategories" }
  | { type: "entryActions"; entryType: "node" | "item"; nodeId: string; itemId?: string }
  | null;

type NodeForm = {
  title: string;
  categoryId: string;
  newCategoryName: string;
  notes: string;
  image: string | null;
};

type ItemForm = {
  title: string;
  categoryId: string;
  newCategoryName: string;
  tags: string;
  notes: string;
  image: string | null;
  quantityEnabled: boolean;
  quantityValue: string;
  valueEnabled: boolean;
  valueValue: string;
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function splitTags(value: string) {
  return Array.from(new Set(value.split(/[,:\n]/).map((part) => normalize(part)).filter(Boolean)));
}

function getCategoryName(categories: InventoryCategory[], categoryId: string | null) {
  return categoryId ? categories.find((entry) => entry.id === categoryId)?.name ?? null : null;
}

function getNodePath(state: InventoryState, nodeId: string): string[] {
  const parts: string[] = [];
  let current = state.nodes[nodeId];
  while (current) {
    parts.unshift(current.title);
    current = current.parentId ? state.nodes[current.parentId] : undefined as never;
  }
  return parts;
}

function createDefaultNodeForm(): NodeForm {
  return { title: "", categoryId: "", newCategoryName: "", notes: "", image: null };
}

function createDefaultItemForm(): ItemForm {
  return {
    title: "",
    categoryId: "",
    newCategoryName: "",
    tags: "",
    notes: "",
    image: null,
    quantityEnabled: false,
    quantityValue: "",
    valueEnabled: false,
    valueValue: "",
  };
}

async function fileToDataUrl(file: File, maxSize = 1100, quality = 0.78) {
  const imageUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not load image."));
    element.src = imageUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(imageUrl);
  return canvas.toDataURL("image/jpeg", quality);
}

function ImageThumb({ src, alt }: { src: string | null; alt: string }) {
  const hasImage = Boolean(src);
  return (
    <div className={styles.thumb}>
      <img
        src={src ?? FALLBACK_IMAGE}
        alt={alt}
        className={hasImage ? styles.coverImage : styles.containImage}
      />
    </div>
  );
}

export default function InventoryPage() {
  const [state, setState] = useState<InventoryState>(getEmptyState());
  const [loaded, setLoaded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [dontShowHelp, setDontShowHelp] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("everything");
  const [searchValue, setSearchValue] = useState("");
  const [nodeCategoryFilter, setNodeCategoryFilter] = useState("all");
  const [itemCategoryFilter, setItemCategoryFilter] = useState("all");
  const [moveSearch, setMoveSearch] = useState("");
  const [nodeForm, setNodeForm] = useState<NodeForm>(createDefaultNodeForm());
  const [itemForm, setItemForm] = useState<ItemForm>(createDefaultItemForm());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryScope, setNewCategoryScope] = useState<CategoryScope>("node");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nodeViewModes, setNodeViewModes] = useState<Record<string, NodeViewMode>>({});

  useEffect(() => {
    let active = true;
    loadInventoryState().then((loadedState) => {
      if (!active) return;
      setState(loadedState);
      setExpandedIds(loadedState.rootInventoryIds);
      const dismissed = window.localStorage.getItem(HELP_KEY) === "1";
      setShowHelp(!dismissed);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveInventoryState(state)
      .then(() => setSaveError(null))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not save inventory state.";
        setSaveError(message);
      });
  }, [loaded, state]);

  const nodeCategories = useMemo(
    () => state.categories.filter((entry) => entry.scope === "node"),
    [state.categories],
  );

  const itemCategories = useMemo(
    () => state.categories.filter((entry) => entry.scope === "item"),
    [state.categories],
  );

  const searchResults = useMemo(() => {
    const query = normalize(searchValue);
    if (!query) return [] as Array<{ id: string; label: string; type: "node" | "item"; path: string[] }>;

    const results: Array<{ id: string; label: string; type: "node" | "item"; path: string[] }> = [];

    Object.values(state.nodes).forEach((node) => {
      const categoryName = normalize(getCategoryName(state.categories, node.categoryId) ?? "");
      const passiveTags = splitTags(`${node.title} ${node.notes} ${categoryName}`);
      const matchesMode =
        searchMode === "everything"
          ? [normalize(node.title), normalize(node.notes), categoryName, passiveTags.join(" ")].join(" ").includes(query)
          : searchMode === "category"
            ? categoryName.includes(query)
            : passiveTags.some((tag) => tag.includes(query));
      const categoryPass = nodeCategoryFilter === "all" || node.categoryId === nodeCategoryFilter;
      if (matchesMode && categoryPass) {
        results.push({ id: node.id, label: node.title, type: "node", path: getNodePath(state, node.id) });
      }
    });

    Object.entries(state.items).forEach(([itemId, item]) => {
      const categoryName = normalize(getCategoryName(state.categories, item.categoryId) ?? "");
      const parentEntry = Object.values(state.nodes).find((node) => node.itemIds.includes(itemId));
      if (!parentEntry) return;
      const passiveTags = Array.from(new Set([...item.tags, ...splitTags(`${item.title} ${item.notes} ${categoryName}`)]));
      const matchesMode =
        searchMode === "everything"
          ? [normalize(item.title), normalize(item.notes), categoryName, passiveTags.join(" ")].join(" ").includes(query)
          : searchMode === "category"
            ? categoryName.includes(query)
            : passiveTags.some((tag) => tag.includes(query));
      const itemCategoryPass = itemCategoryFilter === "all" || item.categoryId === itemCategoryFilter;
      if (matchesMode && itemCategoryPass) {
        results.push({
          id: itemId,
          label: item.title,
          type: "item",
          path: [...getNodePath(state, parentEntry.id), item.title],
        });
      }
    });

    return results;
  }, [itemCategoryFilter, nodeCategoryFilter, searchMode, searchValue, state]);

  const moveTargets = useMemo(() => {
    const query = normalize(moveSearch);
    const excludeId = modal?.type === "moveNode" ? modal.nodeId : null;
    return Object.values(state.nodes).filter((node) => {
      if (excludeId && node.id === excludeId) return false;
      if (excludeId) {
        let current = node.parentId;
        while (current) {
          if (current === excludeId) return false;
          current = state.nodes[current]?.parentId ?? null;
        }
      }
      return !query || getNodePath(state, node.id).join(" / ").toLowerCase().includes(query);
    });
  }, [moveSearch, modal, state]);

  function toggleExpanded(nodeId: string) {
    setExpandedIds((current) =>
      current.includes(nodeId) ? current.filter((entry) => entry !== nodeId) : [...current, nodeId],
    );
  }

  function openCreateNode(parentId: string | null) {
    setNodeForm(createDefaultNodeForm());
    setModal({ type: "createNode", parentId });
  }

  function openEditNode(nodeId: string) {
    const node = state.nodes[nodeId];
    if (!node) return;
    setNodeForm({
      title: node.title,
      categoryId: node.categoryId ?? "",
      newCategoryName: "",
      notes: node.notes,
      image: node.image,
    });
    setModal({ type: "editNode", nodeId });
  }

  function openCreateItem(nodeId: string) {
    setItemForm(createDefaultItemForm());
    setModal({ type: "createItem", nodeId });
  }

  function openEditItem(nodeId: string, itemId: string) {
    const item = state.items[itemId];
    if (!item) return;
    setItemForm({
      title: item.title,
      categoryId: item.categoryId ?? "",
      newCategoryName: "",
      tags: item.tags.join(", "),
      notes: item.notes,
      image: item.image,
      quantityEnabled: item.quantity.enabled,
      quantityValue: item.quantity.value,
      valueEnabled: item.value.enabled,
      valueValue: item.value.value,
    });
    setModal({ type: "editItem", nodeId, itemId });
  }

  function addCategory(scope: CategoryScope, name: string) {
    const clean = name.trim();
    if (!clean) return null;
    const existing = state.categories.find(
      (entry) => entry.scope === scope && normalize(entry.name) === normalize(clean),
    );
    if (existing) return existing.id;
    const category: InventoryCategory = { id: createId("cat"), name: clean, scope, createdAt: Date.now() };
    setState((current) => ({ ...current, categories: [...current.categories, category] }));
    return category.id;
  }

  async function handleImagePick(file: File, type: "node" | "item") {
    const image = await fileToDataUrl(file);
    if (type === "node") setNodeForm((current) => ({ ...current, image }));
    else setItemForm((current) => ({ ...current, image }));
  }

  function submitNodeForm() {
    if (!modal || (modal.type !== "createNode" && modal.type !== "editNode")) return;
    const title = nodeForm.title.trim();
    if (!title) return;
    const categoryId = nodeForm.newCategoryName.trim()
      ? addCategory("node", nodeForm.newCategoryName)
      : nodeForm.categoryId || null;

    if (modal.type === "createNode") {
      const id = createId("node");
      const parentId = modal.parentId;
      const node: InventoryNode = {
        id,
        type: parentId ? "container" : "inventory",
        title,
        categoryId,
        image: nodeForm.image,
        notes: nodeForm.notes.trim(),
        parentId,
        childNodeIds: [],
        itemIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setState((current) => {
        const next: InventoryState = {
          ...current,
          nodes: { ...current.nodes, [id]: node },
          rootInventoryIds: parentId ? current.rootInventoryIds : [...current.rootInventoryIds, id],
        };
        if (parentId) {
          const parent = next.nodes[parentId];
          next.nodes[parentId] = {
            ...parent,
            childNodeIds: [...parent.childNodeIds, id],
            updatedAt: Date.now(),
          };
        }
        return next;
      });
      setExpandedIds((current) => Array.from(new Set([...current, ...(parentId ? [parentId] : []), id])));
    } else {
      setState((current) => ({
        ...current,
        nodes: {
          ...current.nodes,
          [modal.nodeId]: {
            ...current.nodes[modal.nodeId],
            title,
            categoryId,
            image: nodeForm.image,
            notes: nodeForm.notes.trim(),
            updatedAt: Date.now(),
          },
        },
      }));
    }

    setModal(null);
  }

  function submitItemForm() {
    if (!modal || (modal.type !== "createItem" && modal.type !== "editItem")) return;
    const title = itemForm.title.trim();
    if (!title) return;
    const categoryId = itemForm.newCategoryName.trim()
      ? addCategory("item", itemForm.newCategoryName)
      : itemForm.categoryId || null;
    const tags = Array.from(
      new Set([...splitTags(itemForm.tags), ...splitTags(`${title} ${itemForm.notes}`)]),
    );

    if (modal.type === "createItem") {
      const itemId = createId("item");
      const item: InventoryItem = {
        id: itemId,
        title,
        categoryId,
        tags,
        notes: itemForm.notes.trim(),
        image: itemForm.image,
        quantity: { enabled: itemForm.quantityEnabled, value: itemForm.quantityValue.trim() },
        value: { enabled: itemForm.valueEnabled, value: itemForm.valueValue.trim() },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setState((current) => ({
        ...current,
        items: { ...current.items, [itemId]: item },
        nodes: {
          ...current.nodes,
          [modal.nodeId]: {
            ...current.nodes[modal.nodeId],
            itemIds: [...current.nodes[modal.nodeId].itemIds, itemId],
            updatedAt: Date.now(),
          },
        },
      }));
      setExpandedIds((current) => Array.from(new Set([...current, modal.nodeId])));
    } else {
      setState((current) => ({
        ...current,
        items: {
          ...current.items,
          [modal.itemId]: {
            ...current.items[modal.itemId],
            title,
            categoryId,
            tags,
            notes: itemForm.notes.trim(),
            image: itemForm.image,
            quantity: { enabled: itemForm.quantityEnabled, value: itemForm.quantityValue.trim() },
            value: { enabled: itemForm.valueEnabled, value: itemForm.valueValue.trim() },
            updatedAt: Date.now(),
          },
        },
      }));
    }

    setModal(null);
  }

  function deleteItem(nodeId: string, itemId: string) {
    setState((current) => {
      const nextItems = { ...current.items };
      delete nextItems[itemId];
      return {
        ...current,
        items: nextItems,
        nodes: {
          ...current.nodes,
          [nodeId]: {
            ...current.nodes[nodeId],
            itemIds: current.nodes[nodeId].itemIds.filter((entry) => entry !== itemId),
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  function deleteNode(nodeId: string) {
    const node = state.nodes[nodeId];
    if (!node) return;
    node.childNodeIds.forEach(deleteNode);
    setState((current) => {
      const next = {
        ...current,
        nodes: { ...current.nodes },
        items: { ...current.items },
        rootInventoryIds: current.rootInventoryIds.filter((entry) => entry !== nodeId),
      };
      Object.values(next.nodes[nodeId]?.itemIds ?? []).forEach((itemId) => {
        delete next.items[itemId];
      });
      delete next.nodes[nodeId];
      if (node.parentId && next.nodes[node.parentId]) {
        next.nodes[node.parentId] = {
          ...next.nodes[node.parentId],
          childNodeIds: next.nodes[node.parentId].childNodeIds.filter((entry) => entry !== nodeId),
          updatedAt: Date.now(),
        };
      }
      return next;
    });
  }

  function moveNode(nodeId: string, targetId: string) {
    setState((current) => {
      const node = current.nodes[nodeId];
      if (!node) return current;
      const next = {
        ...current,
        nodes: { ...current.nodes },
        rootInventoryIds: current.rootInventoryIds.filter((entry) => entry !== nodeId),
      };
      if (node.parentId && next.nodes[node.parentId]) {
        next.nodes[node.parentId] = {
          ...next.nodes[node.parentId],
          childNodeIds: next.nodes[node.parentId].childNodeIds.filter((entry) => entry !== nodeId),
          updatedAt: Date.now(),
        };
      }
      next.nodes[nodeId] = { ...node, parentId: targetId, type: "container", updatedAt: Date.now() };
      next.nodes[targetId] = {
        ...next.nodes[targetId],
        childNodeIds: [...next.nodes[targetId].childNodeIds, nodeId],
        updatedAt: Date.now(),
      };
      return next;
    });
    setModal(null);
  }

  function moveItem(itemId: string, currentNodeId: string, targetId: string) {
    setState((current) => ({
      ...current,
      nodes: {
        ...current.nodes,
        [currentNodeId]: {
          ...current.nodes[currentNodeId],
          itemIds: current.nodes[currentNodeId].itemIds.filter((entry) => entry !== itemId),
          updatedAt: Date.now(),
        },
        [targetId]: {
          ...current.nodes[targetId],
          itemIds: [...current.nodes[targetId].itemIds, itemId],
          updatedAt: Date.now(),
        },
      },
    }));
    setModal(null);
  }

  function getNodeViewMode(nodeId: string): NodeViewMode {
    return nodeViewModes[nodeId] ?? "grid";
  }

  function setNodeViewMode(nodeId: string, mode: NodeViewMode) {
    setNodeViewModes((current) => ({ ...current, [nodeId]: mode }));
  }

  function goToResult(result: { id: string; type: "node" | "item"; path: string[] }) {
    if (result.type === "node") {
      setExpandedIds((current) => Array.from(new Set([...current, ...result.path.map((_, idx) => {
        const titlePath = result.path.slice(0, idx + 1);
        return Object.values(state.nodes).find((node) => getNodePath(state, node.id).join("/") === titlePath.join("/"))?.id;
      }).filter(Boolean) as string[]])));
    } else {
      const parent = Object.values(state.nodes).find((node) => node.itemIds.includes(result.id));
      if (parent) {
        const pathNodes = getNodePath(state, parent.id);
        setExpandedIds((current) => Array.from(new Set([...current, ...pathNodes.map((_, idx) => {
          const titlePath = pathNodes.slice(0, idx + 1);
          return Object.values(state.nodes).find((node) => getNodePath(state, node.id).join("/") === titlePath.join("/"))?.id;
        }).filter(Boolean) as string[]])));
      }
    }
    setModal(null);
  }

  function renderNode(nodeId: string): React.ReactNode {
    const node = state.nodes[nodeId];
    if (!node) return null;
    const isExpanded = expandedIds.includes(nodeId);
    const childNodes = node.childNodeIds.map((id) => state.nodes[id]).filter(Boolean);
    const items = node.itemIds.map((id) => state.items[id]).filter(Boolean);
    const childCount = childNodes.length;
    const categoryName = getCategoryName(state.categories, node.categoryId);
    const viewMode = getNodeViewMode(nodeId);

    return (
      <div key={nodeId} className={styles.nodeCard}>
        <div className={styles.nodeHeader}>
          <div className={styles.nodeIdentity}>
            <ImageThumb src={node.image} alt={node.title} />
            <div className={styles.nodeTitleWrap}>
              <h2 className={styles.nodeTitle}>{node.title}</h2>
              <div className={styles.metaRow}>
                <span className={styles.chip}>{node.type}</span>
                <span className={styles.chip}>{childCount} nested {childCount === 1 ? "container" : "containers"}</span>
                {categoryName ? <span className={styles.chip}>{categoryName}</span> : null}
              </div>
              {node.notes ? <p className={styles.helper}>{node.notes}</p> : null}
            </div>
          </div>
          <button type="button" className={styles.smallButton} onClick={() => toggleExpanded(nodeId)}>
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>

        <div className={styles.nodeActions}>
          <button type="button" className={styles.smallButton} onClick={() => openCreateNode(nodeId)}>+ Container</button>
          <button type="button" className={styles.smallButton} onClick={() => openCreateItem(nodeId)}>+ Item</button>
          <button type="button" className={styles.smallButton} onClick={() => openEditNode(nodeId)}>Edit</button>
          {node.parentId ? (
            <button type="button" className={styles.smallButton} onClick={() => { setMoveSearch(""); setModal({ type: "moveNode", nodeId }); }}>
              Move to
            </button>
          ) : null}
          <button type="button" className={styles.dangerButton} onClick={() => deleteNode(nodeId)}>Delete</button>
        </div>

        {isExpanded ? (
          <>
            <div className={styles.viewToggleRow}>
              <span className={styles.sectionTitle}>View</span>
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${viewMode === "grid" ? styles.toggleButtonActive : ""}`}
                  onClick={() => setNodeViewMode(nodeId, "grid")}
                >
                  Grid
                </button>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${viewMode === "list" ? styles.toggleButtonActive : ""}`}
                  onClick={() => setNodeViewMode(nodeId, "list")}
                >
                  List
                </button>
              </div>
            </div>

            {viewMode === "grid" ? (
              <div className={styles.entryGrid}>
                {childNodes.map((child) => {
                  const childCategoryName = getCategoryName(state.categories, child.categoryId);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      className={styles.gridTile}
                      onClick={() => setModal({ type: "entryActions", entryType: "node", nodeId: child.id })}
                    >
                      <div className={styles.gridTileThumb}><img src={child.image ?? FALLBACK_IMAGE} alt={child.title} className={child.image ? styles.coverImage : styles.containImage} /></div>
                      <span className={styles.gridTileTitle}>{child.title}</span>
                      <span className={styles.gridTileMeta}>{childCategoryName ?? "container"}</span>
                    </button>
                  );
                })}
                {items.map((item) => {
                  const itemCategoryName = getCategoryName(state.categories, item.categoryId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.gridTile}
                      onClick={() => setModal({ type: "entryActions", entryType: "item", nodeId, itemId: item.id })}
                    >
                      <div className={styles.gridTileThumb}><img src={item.image ?? FALLBACK_IMAGE} alt={item.title} className={item.image ? styles.coverImage : styles.containImage} /></div>
                      <span className={styles.gridTileTitle}>{item.title}</span>
                      <span className={styles.gridTileMeta}>{itemCategoryName ?? "item"}</span>
                    </button>
                  );
                })}
                {!childNodes.length && !items.length ? <p className={styles.helper}>Nothing here yet.</p> : null}
              </div>
            ) : (
              <>
                {childNodes.length ? (
                  <div className={styles.childrenWrap}>
                    <h3 className={styles.sectionTitle}>Containers</h3>
                    <div className={styles.childGrid}>{childNodes.map((child) => renderNode(child.id))}</div>
                  </div>
                ) : null}

                {items.length ? (
                  <div className={styles.itemsWrap}>
                    <h3 className={styles.sectionTitle}>Items</h3>
                    {items.map((item) => {
                      const itemCategoryName = getCategoryName(state.categories, item.categoryId);
                      return (
                        <div key={item.id} className={styles.itemCard}>
                          <div className={styles.itemThumb}>
                            <img
                              src={item.image ?? FALLBACK_IMAGE}
                              alt={item.title}
                              className={item.image ? styles.coverImage : styles.containImage}
                            />
                          </div>
                          <div className={styles.itemBody}>
                            <div>
                              <h4 className={styles.itemTitle}>{item.title}</h4>
                              <div className={styles.metaRow}>
                                {itemCategoryName ? <span className={styles.chip}>{itemCategoryName}</span> : null}
                                {item.quantity.enabled && item.quantity.value ? <span className={styles.chip}>Qty {item.quantity.value}</span> : null}
                                {item.value.enabled && item.value.value ? <span className={styles.chip}>${item.value.value}</span> : null}
                                {item.tags.slice(0, 3).map((tag) => <span key={tag} className={styles.chip}>{tag}</span>)}
                              </div>
                              {item.notes ? <p className={styles.helper}>{item.notes}</p> : null}
                            </div>
                            <div className={styles.itemActions}>
                              <button type="button" className={styles.smallButton} onClick={() => openEditItem(nodeId, item.id)}>Edit</button>
                              <button type="button" className={styles.smallButton} onClick={() => { setMoveSearch(""); setModal({ type: "moveItem", nodeId, itemId: item.id }); }}>
                                Move to
                              </button>
                              <button type="button" className={styles.dangerButton} onClick={() => deleteItem(nodeId, item.id)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    );
  }

  function renderModal() {
    if (!modal) return null;

    if (modal.type === "entryActions") {
      const targetNode = state.nodes[modal.nodeId];
      const targetItem = modal.entryType === "item" && modal.itemId ? state.items[modal.itemId] : null;
      const title = modal.entryType === "node" ? targetNode?.title : targetItem?.title;
      if (!title) return null;
      return (
        <div className={styles.modalCard}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <p className={styles.helper}>Choose what you want to do with this {modal.entryType === "node" ? "container" : "item"}.</p>
          <div className={styles.actionSheet}>
            {modal.entryType === "node" ? (
              <>
                <button type="button" className={styles.textButton} onClick={() => openEditNode(modal.nodeId)}>Edit</button>
                <button type="button" className={styles.textButton} onClick={() => { setMoveSearch(""); setModal({ type: "moveNode", nodeId: modal.nodeId }); }}>Move to</button>
                <button type="button" className={styles.textButton} onClick={() => { setModal(null); toggleExpanded(modal.nodeId); }}>Open</button>
                <button type="button" className={styles.dangerButton} onClick={() => { setModal(null); deleteNode(modal.nodeId); }}>Delete</button>
              </>
            ) : modal.itemId ? (
              <>
                <button type="button" className={styles.textButton} onClick={() => openEditItem(modal.nodeId, modal.itemId!)}>Edit</button>
                <button type="button" className={styles.textButton} onClick={() => { setMoveSearch(""); setModal({ type: "moveItem", nodeId: modal.nodeId, itemId: modal.itemId! }); }}>Move to</button>
                <button type="button" className={styles.dangerButton} onClick={() => { setModal(null); deleteItem(modal.nodeId, modal.itemId!); }}>Delete</button>
              </>
            ) : null}
            <button type="button" className={styles.smallButton} onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      );
    }

    if (modal.type === "search") {
      return (
        <div className={styles.modalCard}>
          <h3 className={styles.modalTitle}>Search</h3>
          <div className={styles.field}>
            <label className={styles.label}>Search by</label>
            <select className={styles.select} value={searchMode} onChange={(e) => setSearchMode(e.target.value as SearchMode)}>
              <option value="everything">Everything</option>
              <option value="category">Category</option>
              <option value="tag">Tag</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Search</label>
            <input className={styles.searchInput} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Type to search..." />
          </div>
          <div className={styles.searchRow}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Container category</label>
              <select className={styles.select} value={nodeCategoryFilter} onChange={(e) => setNodeCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                {nodeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Item category</label>
              <select className={styles.select} value={itemCategoryFilter} onChange={(e) => setItemCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                {itemCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.results}>
            {searchResults.length ? searchResults.map((result) => (
              <button key={`${result.type}-${result.id}`} type="button" className={styles.resultButton} onClick={() => goToResult(result)}>
                <span className={styles.resultTitle}>{result.label}</span>
                <span className={styles.resultMeta}>{result.path.join(" / ")}</span>
              </button>
            )) : <p className={styles.helper}>No results yet.</p>}
          </div>
          <div className={styles.modalActions}><button type="button" className={styles.textButton} onClick={() => setModal(null)}>Close</button></div>
        </div>
      );
    }

    if (modal.type === "manageCategories") {
      return (
        <div className={styles.modalCard}>
          <h3 className={styles.modalTitle}>Manage Categories</h3>
          <div className={styles.searchRow}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Category name</label>
              <input className={styles.input} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            </div>
            <div className={styles.field} style={{ width: 170 }}>
              <label className={styles.label}>Type</label>
              <select className={styles.select} value={newCategoryScope} onChange={(e) => setNewCategoryScope(e.target.value as CategoryScope)}>
                <option value="node">Container</option>
                <option value="item">Item</option>
              </select>
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.textButton} onClick={() => {
              addCategory(newCategoryScope, newCategoryName);
              setNewCategoryName("");
            }}>Add Category</button>
          </div>
          <div className={styles.categoriesList}>
            {state.categories.map((category) => (
              <div key={category.id} className={styles.categoryRow}>
                <span>{category.name} · {category.scope === "node" ? "container" : "item"}</span>
                <button type="button" className={styles.dangerButton} onClick={() => {
                  setState((current) => ({
                    ...current,
                    categories: current.categories.filter((entry) => entry.id !== category.id),
                    nodes: Object.fromEntries(Object.entries(current.nodes).map(([id, node]) => [id, node.categoryId === category.id ? { ...node, categoryId: null } : node])),
                    items: Object.fromEntries(Object.entries(current.items).map(([id, item]) => [id, item.categoryId === category.id ? { ...item, categoryId: null } : item])),
                  }));
                }}>Delete</button>
              </div>
            ))}
          </div>
          <div className={styles.modalActions}><button type="button" className={styles.textButton} onClick={() => setModal(null)}>Close</button></div>
        </div>
      );
    }

    if (modal.type === "moveNode" || modal.type === "moveItem") {
      return (
        <div className={styles.modalCard}>
          <h3 className={styles.modalTitle}>Move To</h3>
          <div className={styles.field}>
            <label className={styles.label}>Search destination</label>
            <input className={styles.searchInput} value={moveSearch} onChange={(e) => setMoveSearch(e.target.value)} placeholder="Search inventories and containers..." />
          </div>
          <div className={styles.results}>
            {moveTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                className={styles.resultButton}
                onClick={() => modal.type === "moveNode" ? moveNode(modal.nodeId, target.id) : moveItem(modal.itemId, modal.nodeId, target.id)}
              >
                <span className={styles.resultTitle}>{target.title}</span>
                <span className={styles.resultMeta}>{getNodePath(state, target.id).join(" / ")}</span>
              </button>
            ))}
          </div>
          <div className={styles.modalActions}><button type="button" className={styles.textButton} onClick={() => setModal(null)}>Cancel</button></div>
        </div>
      );
    }

    if (modal.type === "createNode" || modal.type === "editNode") {
      return (
        <div className={styles.modalCard}>
          <h3 className={styles.modalTitle}>{modal.type === "createNode" ? (modal.parentId ? "New Container" : "New Inventory") : "Edit Container"}</h3>
          <div className={styles.field}><label className={styles.label}>Title</label><input className={styles.input} value={nodeForm.title} onChange={(e) => setNodeForm((c) => ({ ...c, title: e.target.value }))} /></div>
          <div className={styles.searchRow}>
            <div className={styles.field} style={{ flex: 1 }}><label className={styles.label}>Container category</label><select className={styles.select} value={nodeForm.categoryId} onChange={(e) => setNodeForm((c) => ({ ...c, categoryId: e.target.value }))}><option value="">None</option>{nodeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            <div className={styles.field} style={{ flex: 1 }}><label className={styles.label}>New category</label><input className={styles.input} value={nodeForm.newCategoryName} onChange={(e) => setNodeForm((c) => ({ ...c, newCategoryName: e.target.value }))} /></div>
          </div>
          <div className={styles.field}><label className={styles.label}>Notes</label><textarea className={styles.textArea} value={nodeForm.notes} onChange={(e) => setNodeForm((c) => ({ ...c, notes: e.target.value }))} /></div>
          <div className={styles.field}><label className={styles.label}>Image</label><input className={styles.input} type="file" accept="image/*" capture="environment" onChange={async (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) await handleImagePick(file, "node"); }} /></div>
          <div className={styles.modalActions}><button type="button" className={styles.textButton} onClick={submitNodeForm}>Save</button><button type="button" className={styles.textButton} onClick={() => setModal(null)}>Cancel</button></div>
        </div>
      );
    }

    return (
      <div className={styles.modalCard}>
        <h3 className={styles.modalTitle}>{modal.type === "createItem" ? "New Item" : "Edit Item"}</h3>
        <div className={styles.field}><label className={styles.label}>Title</label><input className={styles.input} value={itemForm.title} onChange={(e) => setItemForm((c) => ({ ...c, title: e.target.value }))} /></div>
        <div className={styles.searchRow}>
          <div className={styles.field} style={{ flex: 1 }}><label className={styles.label}>Item category</label><select className={styles.select} value={itemForm.categoryId} onChange={(e) => setItemForm((c) => ({ ...c, categoryId: e.target.value }))}><option value="">None</option>{itemCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div className={styles.field} style={{ flex: 1 }}><label className={styles.label}>New category</label><input className={styles.input} value={itemForm.newCategoryName} onChange={(e) => setItemForm((c) => ({ ...c, newCategoryName: e.target.value }))} /></div>
        </div>
        <div className={styles.field}><label className={styles.label}>Tags</label><input className={styles.input} value={itemForm.tags} onChange={(e) => setItemForm((c) => ({ ...c, tags: e.target.value }))} placeholder="black, socket, nike" /></div>
        <div className={styles.field}><label className={styles.label}>Notes</label><textarea className={styles.textArea} value={itemForm.notes} onChange={(e) => setItemForm((c) => ({ ...c, notes: e.target.value }))} /></div>
        <div className={styles.field}><label className={styles.label}>Image</label><input className={styles.input} type="file" accept="image/*" capture="environment" onChange={async (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) await handleImagePick(file, "item"); }} /></div>
        <div className={styles.checkboxRow}><label><input type="checkbox" checked={itemForm.quantityEnabled} onChange={(e) => setItemForm((c) => ({ ...c, quantityEnabled: e.target.checked }))} /> Track quantity</label>{itemForm.quantityEnabled ? <input className={styles.input} style={{ maxWidth: 140 }} value={itemForm.quantityValue} onChange={(e) => setItemForm((c) => ({ ...c, quantityValue: e.target.value }))} placeholder="1" /> : null}</div>
        <div className={styles.checkboxRow}><label><input type="checkbox" checked={itemForm.valueEnabled} onChange={(e) => setItemForm((c) => ({ ...c, valueEnabled: e.target.checked }))} /> Track value</label>{itemForm.valueEnabled ? <input className={styles.input} style={{ maxWidth: 140 }} value={itemForm.valueValue} onChange={(e) => setItemForm((c) => ({ ...c, valueValue: e.target.value }))} placeholder="25" /> : null}</div>
        <div className={styles.modalActions}><button type="button" className={styles.textButton} onClick={submitItemForm}>Save</button><button type="button" className={styles.textButton} onClick={() => setModal(null)}>Cancel</button></div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.topBar}>
          <div className={styles.brand}>
            <h1 className={styles.title}>Digital Inventory</h1>
            <p className={styles.subtle}>Inventories expand into containers. Containers expand into more containers and items.</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.iconButton} onClick={() => setShowHelp(true)} aria-label="Help">i</button>
            <button type="button" className={styles.textButton} onClick={() => setModal({ type: "manageCategories" })}>Manage Categories</button>
            <button type="button" className={styles.iconButton} onClick={() => setModal({ type: "search" })} aria-label="Search">⌕</button>
            <button type="button" className={styles.iconButton} onClick={() => openCreateNode(null)} aria-label="New inventory">＋</button>
          </div>
        </section>

        {saveError ? <p className={styles.helper}>{saveError}</p> : null}

        <section className={styles.treeCard}>
          {state.rootInventoryIds.length ? (
            <div className={styles.rootGrid}>{state.rootInventoryIds.map((nodeId) => renderNode(nodeId))}</div>
          ) : (
            <div className={styles.emptyState}>
              <p>No inventories yet.</p>
              <button type="button" className={styles.textButton} onClick={() => openCreateNode(null)}>Create your first inventory</button>
            </div>
          )}
        </section>
      </div>

      {showHelp ? (
        <>
          <div className={styles.overlay} onClick={() => setShowHelp(false)} />
          <div className={styles.modalWrap}>
            <div className={styles.helpCard}>
              <h3 className={styles.modalTitle}>How it works</h3>
              <p className={styles.helper}>Create an inventory with the plus button. Open any inventory to add containers. Open any inventory or container to add items. Use Move to when something needs to be relocated. Search can look through everything, only categories, or passive tags.</p>
              <label className={styles.helper}><input type="checkbox" checked={dontShowHelp} onChange={(e) => setDontShowHelp(e.target.checked)} /> Don&apos;t show this again</label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.textButton} onClick={() => {
                  if (dontShowHelp) window.localStorage.setItem(HELP_KEY, "1");
                  else window.localStorage.removeItem(HELP_KEY);
                  setShowHelp(false);
                }}>Close</button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {modal ? (
        <>
          <div className={styles.overlay} onClick={() => setModal(null)} />
          <div className={styles.modalWrap}>{renderModal()}</div>
        </>
      ) : null}
    </main>
  );
}
