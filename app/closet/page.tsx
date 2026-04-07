"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClosetItem,
  ClosetLayer,
  SavedOutfit,
  SubsectionConfig,
} from "./db";
import {
  deleteItemFromDb,
  deleteSavedOutfit,
  getAllItems,
  getSavedOutfits,
  getSubsectionConfig,
  saveItem,
  saveOutfit,
  saveSubsectionConfig,
} from "./db";
import ImageCutoutEditor from "./ImageCutoutEditor";

const LAYERS: ClosetLayer[] = ["Hat", "Top", "Jacket", "Bottoms", "Shoes"];

type LayerPosition = { x: number; y: number };
type LayerPositions = Record<ClosetLayer, LayerPosition>;
type SlotNumber = 1 | 2;
type SlotKey =
  | "Hat-1"
  | "Hat-2"
  | "Top-1"
  | "Top-2"
  | "Jacket-1"
  | "Jacket-2"
  | "Bottoms-1"
  | "Bottoms-2"
  | "Shoes-1"
  | "Shoes-2";

type ToolbarMenuMode = "hide" | "filter" | "layer" | null;

type SlideAnimation = {
  prevItem: ClosetItem | null;
  direction: "prev" | "next";
  phase: "start" | "animate";
};

type SwipeHitTarget = {
  layer: ClosetLayer;
  slot: SlotNumber;
};

type ClearTarget = ClosetLayer | "Saved Outfits" | "All" | null;

type ClosetExportPayload = {
  version: number;
  exportedAt: string;
  items: ClosetItem[];
  savedOutfits: SavedOutfit[];
  subsectionConfig: SubsectionConfig;
};


const DEFAULT_BASE_SCALES: Record<ClosetLayer, number> = {
  Hat: 120,
  Top: 130,
  Jacket: 130,
  Bottoms: 125,
  Shoes: 200,
};

const DEFAULT_SCALES: Record<ClosetLayer, number> = {
  Hat: 100,
  Top: 100,
  Jacket: 100,
  Bottoms: 100,
  Shoes: 100,
};

const DEFAULT_POSITIONS: LayerPositions = {
  Hat: { x: 0, y: 50 },
  Top: { x: 0, y: 130 },
  Jacket: { x: 0, y: 130 },
  Bottoms: { x: 0, y: 300 },
  Shoes: { x: 0, y: 470 },
};

const SECONDARY_LAYER_OFFSETS: Record<ClosetLayer, LayerPosition> = {
  Hat: { x: 6, y: 0 },
  Top: { x: 8, y: -8 },
  Jacket: { x: 8, y: -8 },
  Bottoms: { x: 6, y: -6 },
  Shoes: { x: 8, y: 0 },
};

const DETACHED_JACKET_OFFSET: LayerPosition = { x: 126, y: 12 };

const CONTROL_ROW_BASE_TOP: Record<ClosetLayer, number> = {
  Hat: 78,
  Top: 170,
  Jacket: 210,
  Bottoms: 342,
  Shoes: 520,
};

const CONTROL_ROW_GAP = 48;
const BUTTON_HOVER = "#d89b1d";
const BUTTON_HOVER_TEXT = "#111111";

function slotKey(layer: ClosetLayer, slot: SlotNumber): SlotKey {
  return `${layer}-${slot}` as SlotKey;
}

function getRenderedScale(layer: ClosetLayer, value: number) {
  return (DEFAULT_BASE_SCALES[layer] * value) / 100;
}

function compressFileIfNeeded(
  file: File,
  maxBytes = 400 * 1024,
  maxWidth = 1600,
  maxHeight = 2400,
  quality = 0.9
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= maxBytes) {
      resolve(file);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not create canvas context"));
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not compress image"));
              return;
            }

            resolve(
              new File([blob], file.name, {
                type: "image/jpeg",
              })
            );
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => reject(new Error("Could not load image for compression"));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl: string, maxWidth = 600, maxHeight = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context"));
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => reject(new Error("Could not load image for resizing"));
    img.src = dataUrl;
  });
}


function mergeSubsectionConfig(
  current: SubsectionConfig,
  incoming: Partial<SubsectionConfig> | null | undefined
): SubsectionConfig {
  return {
    Hat: Array.from(new Set([...(current.Hat || []), ...(incoming?.Hat || [])])),
    Top: Array.from(new Set([...(current.Top || []), ...(incoming?.Top || [])])),
    Jacket: Array.from(new Set([...(current.Jacket || []), ...(incoming?.Jacket || [])])),
    Bottoms: Array.from(new Set([...(current.Bottoms || []), ...(incoming?.Bottoms || [])])),
    Shoes: Array.from(new Set([...(current.Shoes || []), ...(incoming?.Shoes || [])])),
  };
}

function isSameClosetItem(a: ClosetItem, b: ClosetItem) {
  return (
    a.layer === b.layer &&
    a.name.trim() === b.name.trim() &&
    a.subsection.trim() === b.subsection.trim() &&
    a.image === b.image
  );
}

function usePressableButtonStyle(base: React.CSSProperties, active = false): React.CSSProperties {
  return {
    transition:
      "background 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.08s ease, box-shadow 0.16s ease",
    transform: active ? "translateY(0) scale(1.01)" : "translateY(0) scale(1)",
    boxShadow: active ? "0 0 0 1px rgba(216,155,29,0.32), 0 0 18px rgba(216,155,29,0.18)" : "none",
    ...base,
  };
}

function PressableButton({
  children,
  style,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const mergedStyle: React.CSSProperties = {
    ...usePressableButtonStyle(
      {
        ...(style || {}),
        background:
          hovered && !active
            ? BUTTON_HOVER
            : active
            ? (style?.background as string) ?? "#ffffff"
            : (style?.background as string),
        color:
          hovered && !active
            ? BUTTON_HOVER_TEXT
            : active
            ? (style?.color as string) ?? "#111111"
            : (style?.color as string),
        borderColor: hovered ? BUTTON_HOVER : (style?.borderColor as string),
      },
      active
    ),
    transform: pressed ? "scale(0.97)" : active ? "scale(1.01)" : "scale(1)",
  };

  return (
    <button
      {...props}
      style={mergedStyle}
      onMouseEnter={(e) => {
        setHovered(true);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        setPressed(false);
        props.onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        setPressed(true);
        props.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        setPressed(false);
        props.onMouseUp?.(e);
      }}
      onTouchStart={(e) => {
        setPressed(true);
        props.onTouchStart?.(e);
      }}
      onTouchEnd={(e) => {
        setPressed(false);
        props.onTouchEnd?.(e);
      }}
      onTouchCancel={(e) => {
        setPressed(false);
        props.onTouchCancel?.(e);
      }}
    >
      {children}
    </button>
  );
}

function OutfitPreview({
  hat,
  top,
  jacket,
  bottoms,
  shoes,
  scales,
}: {
  hat: ClosetItem | null;
  top: ClosetItem | null;
  jacket: ClosetItem | null;
  bottoms: ClosetItem | null;
  shoes: ClosetItem | null;
  scales: Record<ClosetLayer, number>;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "260px",
        height: "420px",
      }}
    >
      {hat && (
        <img
          src={hat.image}
          alt={hat.name}
          style={{
            position: "absolute",
            top: "4px",
            left: "50%",
            transform: `translateX(-50%) scale(${getRenderedScale("Hat", scales.Hat) / 100})`,
            maxWidth: "130px",
            maxHeight: "78px",
            objectFit: "contain",
            zIndex: 5,
          }}
        />
      )}

      {bottoms && (
        <img
          src={bottoms.image}
          alt={bottoms.name}
          style={{
            position: "absolute",
            top: "170px",
            left: "50%",
            transform: `translateX(-50%) scale(${getRenderedScale("Bottoms", scales.Bottoms) / 100})`,
            maxWidth: "180px",
            maxHeight: "155px",
            objectFit: "contain",
            zIndex: 1,
          }}
        />
      )}

      {shoes && (
        <img
          src={shoes.image}
          alt={shoes.name}
          style={{
            position: "absolute",
            top: "305px",
            left: "50%",
            transform: `translateX(-50%) scale(${getRenderedScale("Shoes", scales.Shoes) / 100})`,
            maxWidth: "165px",
            maxHeight: "82px",
            objectFit: "contain",
            zIndex: 0,
          }}
        />
      )}

      {top && (
        <img
          src={top.image}
          alt={top.name}
          style={{
            position: "absolute",
            top: "50px",
            left: "50%",
            transform: `translateX(-50%) scale(${getRenderedScale("Top", scales.Top) / 100})`,
            maxWidth: "185px",
            maxHeight: "155px",
            objectFit: "contain",
            zIndex: 2,
          }}
        />
      )}

      {jacket && (
        <img
          src={jacket.image}
          alt={jacket.name}
          style={{
            position: "absolute",
            top: "44px",
            left: "50%",
            transform: `translateX(-50%) scale(${getRenderedScale("Jacket", scales.Jacket) / 100})`,
            maxWidth: "195px",
            maxHeight: "160px",
            objectFit: "contain",
            zIndex: 3,
          }}
        />
      )}
    </div>
  );
}

export default function Page() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [subsectionConfig, setSubsectionConfig] = useState<SubsectionConfig>({
    Hat: ["Caps", "Beanies"],
    Top: ["T-Shirts", "Long Sleeves"],
    Jacket: ["Hoodies", "Zip-Ups", "Jackets"],
    Bottoms: ["Jeans", "Cargos", "Shorts"],
    Shoes: ["Sneakers", "Boots"],
  });

  const [closetOpen, setClosetOpen] = useState(false);
  const [sizePanelOpen, setSizePanelOpen] = useState(false);
  const [builderInfoOpen, setBuilderInfoOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [savedOutfitsOpen, setSavedOutfitsOpen] = useState(false);
  const [saveOutfitModalOpen, setSaveOutfitModalOpen] = useState(false);
  const [clearClosetModalOpen, setClearClosetModalOpen] = useState(false);
  const [clearConfirmTarget, setClearConfirmTarget] = useState<ClearTarget>(null);
  const [isClearingCloset, setIsClearingCloset] = useState(false);

  const [activeClosetLayer, setActiveClosetLayer] = useState<ClosetLayer>("Top");
  const [expandedLayers, setExpandedLayers] = useState<Record<ClosetLayer, boolean>>({
    Hat: false,
    Top: true,
    Jacket: false,
    Bottoms: false,
    Shoes: false,
  });

  const [layerViewFilter, setLayerViewFilter] = useState<Record<ClosetLayer, string>>({
    Hat: "All",
    Top: "All",
    Jacket: "All",
    Bottoms: "All",
    Shoes: "All",
  });

  const [selectedFilterBySlot, setSelectedFilterBySlot] = useState<Record<SlotKey, string>>({
    "Hat-1": "All",
    "Hat-2": "All",
    "Top-1": "All",
    "Top-2": "All",
    "Jacket-1": "All",
    "Jacket-2": "All",
    "Bottoms-1": "All",
    "Bottoms-2": "All",
    "Shoes-1": "All",
    "Shoes-2": "All",
  });

  const [selectedIndexBySlot, setSelectedIndexBySlot] = useState<Record<SlotKey, number>>({
    "Hat-1": 0,
    "Hat-2": 0,
    "Top-1": 0,
    "Top-2": 0,
    "Jacket-1": 0,
    "Jacket-2": 0,
    "Bottoms-1": 0,
    "Bottoms-2": 0,
    "Shoes-1": 0,
    "Shoes-2": 0,
  });

  const [slotVisibility, setSlotVisibility] = useState<Record<SlotKey, boolean>>({
    "Hat-1": true,
    "Hat-2": true,
    "Top-1": true,
    "Top-2": true,
    "Jacket-1": true,
    "Jacket-2": true,
    "Bottoms-1": true,
    "Bottoms-2": true,
    "Shoes-1": true,
    "Shoes-2": true,
  });

  const [duplicateLayers, setDuplicateLayers] = useState<Record<ClosetLayer, boolean>>({
    Hat: false,
    Top: false,
    Jacket: false,
    Bottoms: false,
    Shoes: false,
  });

  const [toolbarMenuMode, setToolbarMenuMode] = useState<ToolbarMenuMode>(null);
  const [toolbarTargetLayer, setToolbarTargetLayer] = useState<ClosetLayer>("Top");
  const [itemMenuOpenId, setItemMenuOpenId] = useState<string | null>(null);
  const [moveItemModal, setMoveItemModal] = useState<ClosetItem | null>(null);
  const [jacketDetached, setJacketDetached] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loadedFlashId, setLoadedFlashId] = useState<string | null>(null);
  const [slideAnimations, setSlideAnimations] = useState<Partial<Record<SlotKey, SlideAnimation>>>(
    {}
  );

  const swipeRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    target: SwipeHitTarget | null;
  }>({
    startX: 0,
    startY: 0,
    active: false,
    target: null,
  });

  const builderRef = useRef<HTMLDivElement | null>(null);

  const [layerScales, setLayerScales] = useState<Record<ClosetLayer, number>>(DEFAULT_SCALES);
  const [scaleInputs, setScaleInputs] = useState<Record<ClosetLayer, string>>({
    Hat: "100",
    Top: "100",
    Jacket: "100",
    Bottoms: "100",
    Shoes: "100",
  });

  const [layerPositions, setLayerPositions] = useState<LayerPositions>(DEFAULT_POSITIONS);
const [dragMode, setDragMode] = useState(false);

const dragRef = useRef<{
  layer: ClosetLayer | null;
  startClientY: number;
  startLayerY: number;
}>({
  layer: null,
  startClientY: 0,
  startLayerY: 0,
});

  const [name, setName] = useState("");
  const [subsection, setSubsection] = useState("T-Shirts");
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("No image uploaded yet.");
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [outfitTitle, setOutfitTitle] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImage, setEditorImage] = useState("");
  const [originalEditorImage, setOriginalEditorImage] = useState("");
  const [pendingEditorImage, setPendingEditorImage] = useState("");
  const [photoTipsOpen, setPhotoTipsOpen] = useState(false);
  const [skipPhotoTips, setSkipPhotoTips] = useState(false);
  const [dontShowTipsChecked, setDontShowTipsChecked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const savedScales = localStorage.getItem("closet-layer-scales");
    const savedPositions = localStorage.getItem("closet-layer-positions");
    const savedDuplicates = localStorage.getItem("closet-duplicate-layers");
    const savedVisibility = localStorage.getItem("closet-slot-visibility");
    if (savedPositions) {
  try {
    const parsed = JSON.parse(savedPositions);
    setLayerPositions({
      Hat: {
        x: Number(parsed?.Hat?.x ?? DEFAULT_POSITIONS.Hat.x),
        y: Number(parsed?.Hat?.y ?? DEFAULT_POSITIONS.Hat.y),
      },
      Top: {
        x: Number(parsed?.Top?.x ?? DEFAULT_POSITIONS.Top.x),
        y: Number(parsed?.Top?.y ?? DEFAULT_POSITIONS.Top.y),
      },
      Jacket: {
        x: Number(parsed?.Jacket?.x ?? DEFAULT_POSITIONS.Jacket.x),
        y: Number(parsed?.Jacket?.y ?? DEFAULT_POSITIONS.Jacket.y),
      },
      Bottoms: {
        x: Number(parsed?.Bottoms?.x ?? DEFAULT_POSITIONS.Bottoms.x),
        y: Number(parsed?.Bottoms?.y ?? DEFAULT_POSITIONS.Bottoms.y),
      },
      Shoes: {
        x: Number(parsed?.Shoes?.x ?? DEFAULT_POSITIONS.Shoes.x),
        y: Number(parsed?.Shoes?.y ?? DEFAULT_POSITIONS.Shoes.y),
      },
    });
  } catch {}
}
    const savedSkipPhotoTips = localStorage.getItem("closet-skip-photo-tips");

    if (savedScales) {
      try {
        const parsed = JSON.parse(savedScales);
        const normalized = {
          Hat: Number(parsed.Hat ?? 100),
          Top: Number(parsed.Top ?? 100),
          Jacket: Number(parsed.Jacket ?? 100),
          Bottoms: Number(parsed.Bottoms ?? 100),
          Shoes: Number(parsed.Shoes ?? 100),
        };
        setLayerScales(normalized);
        setScaleInputs({
          Hat: String(normalized.Hat),
          Top: String(normalized.Top),
          Jacket: String(normalized.Jacket),
          Bottoms: String(normalized.Bottoms),
          Shoes: String(normalized.Shoes),
        });
      } catch {}
    }

    if (savedDuplicates) {
      try {
        setDuplicateLayers(JSON.parse(savedDuplicates));
      } catch {}
    }

    if (savedVisibility) {
      try {
        setSlotVisibility(JSON.parse(savedVisibility));
      } catch {}
    }

    if (savedPositions) {
  try {
    const parsed = JSON.parse(savedPositions);
    setLayerPositions({
      Hat: {
        x: Number(parsed?.Hat?.x ?? DEFAULT_POSITIONS.Hat.x),
        y: Number(parsed?.Hat?.y ?? DEFAULT_POSITIONS.Hat.y),
      },
      Top: {
        x: Number(parsed?.Top?.x ?? DEFAULT_POSITIONS.Top.x),
        y: Number(parsed?.Top?.y ?? DEFAULT_POSITIONS.Top.y),
      },
      Jacket: {
        x: Number(parsed?.Jacket?.x ?? DEFAULT_POSITIONS.Jacket.x),
        y: Number(parsed?.Jacket?.y ?? DEFAULT_POSITIONS.Jacket.y),
      },
      Bottoms: {
        x: Number(parsed?.Bottoms?.x ?? DEFAULT_POSITIONS.Bottoms.x),
        y: Number(parsed?.Bottoms?.y ?? DEFAULT_POSITIONS.Bottoms.y),
      },
      Shoes: {
        x: Number(parsed?.Shoes?.x ?? DEFAULT_POSITIONS.Shoes.x),
        y: Number(parsed?.Shoes?.y ?? DEFAULT_POSITIONS.Shoes.y),
      },
    });
  } catch {}
}

    if (savedSkipPhotoTips === "true") {
      setSkipPhotoTips(true);
      setDontShowTipsChecked(true);
    }
  }, []);



  useEffect(() => {
    localStorage.setItem("closet-layer-scales", JSON.stringify(layerScales));
  }, [layerScales]);

  useEffect(() => {
  localStorage.setItem("closet-layer-positions", JSON.stringify(layerPositions));
}, [layerPositions]);

  useEffect(() => {
    localStorage.setItem("closet-duplicate-layers", JSON.stringify(duplicateLayers));
  }, [duplicateLayers]);

  useEffect(() => {
    localStorage.setItem("closet-slot-visibility", JSON.stringify(slotVisibility));
  }, [slotVisibility]);

  useEffect(() => {
    localStorage.setItem("closet-skip-photo-tips", skipPhotoTips ? "true" : "false");
  }, [skipPhotoTips]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [savedItems, savedSubsections, outfits] = await Promise.all([
          getAllItems(),
          getSubsectionConfig(),
          getSavedOutfits(),
        ]);

        const sortedItems = savedItems.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const sortedOutfits = outfits.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setItems(sortedItems);
        setSubsectionConfig(savedSubsections);
        setSavedOutfits(sortedOutfits);
      } catch (error) {
        console.error(error);
      }
    };

    loadAll();
  }, []);

  useEffect(() => {
    const currentSubs = subsectionConfig[activeClosetLayer];
    if (currentSubs.length && !currentSubs.includes(subsection)) {
      setSubsection(currentSubs[0]);
    }
  }, [activeClosetLayer, subsection, subsectionConfig]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);

      let uploadFile = file;

      if (file.size > 400 * 1024) {
        setStatus("Compressing image...");
        uploadFile = await compressFileIfNeeded(file, 400 * 1024, 1600, 2400, 0.9);
      }

      setStatus("Preparing editor...");

      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(uploadFile);
      });

      setOriginalEditorImage(rawDataUrl);

      if (skipPhotoTips) {
        setEditorImage(rawDataUrl);
        setEditorOpen(true);
        setStatus("Refine the selection, then apply the cutout.");
      } else {
        setPendingEditorImage(rawDataUrl);
        setPhotoTipsOpen(true);
        setStatus("Review photo tips, then continue.");
      }
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setStatus(error.message);
      } else {
        setStatus("Could not prepare image.");
      }
    } finally {
      setIsProcessingImage(false);
    }
  };

  const clearDraft = () => {
    setName("");
    setSubsection(subsectionConfig[activeClosetLayer][0] || "");
    setPreview("");
    setStatus("Cleared current draft.");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openAddModalForLayer = (layerName: ClosetLayer) => {
    setActiveClosetLayer(layerName);
    setSubsection(subsectionConfig[layerName][0] || "");
    setName("");
    setPreview("");
    setStatus("No image uploaded yet.");
    setAddModalOpen(true);
  };

  const addItem = async () => {
    if (!preview) {
      setStatus("Upload a clothing photo first.");
      return;
    }

    const newItem: ClosetItem = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled item",
      layer: activeClosetLayer,
      subsection,
      image: preview,
      createdAt: new Date().toLocaleString(),
    };

    try {
      await saveItem(newItem);
      setItems((prev) =>
        [newItem, ...prev].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
      setHighlightedItemId(newItem.id);
      setStatus("Item added to closet.");
      setName("");
      setPreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAddModalOpen(false);
    } catch (error) {
      console.error(error);
      setStatus("Could not save item.");
    }
  };

  const renameItem = async (item: ClosetItem) => {
    const renamed = window.prompt("Rename item", item.name)?.trim();
    if (!renamed || renamed === item.name) return;

    const updated = { ...item, name: renamed };
    await saveItem(updated);
    setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    setStatus(`Renamed "${item.name}" to "${renamed}"`);
  };

  const moveItemToSubcategory = async (item: ClosetItem, subcategory: string) => {
    if (subcategory === item.subsection) {
      setMoveItemModal(null);
      return;
    }

    const updated = { ...item, subsection: subcategory };
    await saveItem(updated);
    setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    setMoveItemModal(null);
    setStatus(`Moved "${item.name}" to "${subcategory}"`);
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteItemFromDb(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (highlightedItemId === id) setHighlightedItemId(null);
    } catch (error) {
      console.error(error);
      setStatus("Could not delete item.");
    }
  };

  const addSubsection = async (layerName: ClosetLayer, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (subsectionConfig[layerName].includes(trimmed)) {
      setStatus("That subcategory already exists.");
      return;
    }

    const updated: SubsectionConfig = {
      ...subsectionConfig,
      [layerName]: [...subsectionConfig[layerName], trimmed],
    };

    await saveSubsectionConfig(updated);
    setSubsectionConfig(updated);
    setStatus(`Added subcategory: ${trimmed}`);
  };

  const renameSubsection = async (layerName: ClosetLayer, oldName: string) => {
    const renamed = window.prompt("Rename subcategory", oldName)?.trim();
    if (!renamed || renamed === oldName) return;

    if (subsectionConfig[layerName].includes(renamed)) {
      setStatus("That subcategory already exists.");
      return;
    }

    const updatedConfig: SubsectionConfig = {
      ...subsectionConfig,
      [layerName]: subsectionConfig[layerName].map((sub) => (sub === oldName ? renamed : sub)),
    };

    const affectedItems = items.filter(
      (item) => item.layer === layerName && item.subsection === oldName
    );

    for (const item of affectedItems) {
      await saveItem({ ...item, subsection: renamed });
    }

    const refreshedItems = items.map((item) =>
      item.layer === layerName && item.subsection === oldName
        ? { ...item, subsection: renamed }
        : item
    );

    await saveSubsectionConfig(updatedConfig);
    setSubsectionConfig(updatedConfig);
    setItems(refreshedItems);

    setLayerViewFilter((prev) => ({
      ...prev,
      [layerName]: prev[layerName] === oldName ? renamed : prev[layerName],
    }));

    setSelectedFilterBySlot((prev) => ({
      ...prev,
      [slotKey(layerName, 1)]:
        prev[slotKey(layerName, 1)] === oldName ? renamed : prev[slotKey(layerName, 1)],
      [slotKey(layerName, 2)]:
        prev[slotKey(layerName, 2)] === oldName ? renamed : prev[slotKey(layerName, 2)],
    }));

    if (activeClosetLayer === layerName && subsection === oldName) {
      setSubsection(renamed);
    }

    setStatus(`Renamed "${oldName}" to "${renamed}"`);
  };

  const deleteSubsection = async (layerName: ClosetLayer, subName: string) => {
    if (subsectionConfig[layerName].length <= 1) {
      setStatus("Each layer must keep at least one subcategory.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${subName}"? Items in it will be moved to the first remaining subcategory.`
    );
    if (!confirmed) return;

    const remaining = subsectionConfig[layerName].filter((sub) => sub !== subName);
    const fallback = remaining[0];

    const updatedConfig: SubsectionConfig = {
      ...subsectionConfig,
      [layerName]: remaining,
    };

    const affectedItems = items.filter(
      (item) => item.layer === layerName && item.subsection === subName
    );

    for (const item of affectedItems) {
      await saveItem({ ...item, subsection: fallback });
    }

    const refreshedItems = items.map((item) =>
      item.layer === layerName && item.subsection === subName
        ? { ...item, subsection: fallback }
        : item
    );

    await saveSubsectionConfig(updatedConfig);
    setSubsectionConfig(updatedConfig);
    setItems(refreshedItems);

    setLayerViewFilter((prev) => ({
      ...prev,
      [layerName]: prev[layerName] === subName ? "All" : prev[layerName],
    }));

    setSelectedFilterBySlot((prev) => ({
      ...prev,
      [slotKey(layerName, 1)]:
        prev[slotKey(layerName, 1)] === subName ? "All" : prev[slotKey(layerName, 1)],
      [slotKey(layerName, 2)]:
        prev[slotKey(layerName, 2)] === subName ? "All" : prev[slotKey(layerName, 2)],
    }));

    if (activeClosetLayer === layerName && subsection === subName) {
      setSubsection(fallback);
    }

    setStatus(`Deleted subcategory: ${subName}`);
  };

  const handleClearCloset = async (target: Exclude<ClearTarget, null>) => {
    try {
      setIsClearingCloset(true);

      if (target === "Saved Outfits") {
        for (const outfit of savedOutfits) {
          await deleteSavedOutfit(outfit.id);
        }
        setSavedOutfits([]);
        setStatus("Cleared all saved outfits.");
      } else if (target === "All") {
        for (const item of items) {
          await deleteItemFromDb(item.id);
        }
        for (const outfit of savedOutfits) {
          await deleteSavedOutfit(outfit.id);
        }

        setItems([]);
        setSavedOutfits([]);
        setHighlightedItemId(null);
        setLoadedFlashId(null);
        setStatus("Cleared your whole closet and all saved outfits.");
      } else {
        const itemsToDelete = items.filter((item) => item.layer === target);
        for (const item of itemsToDelete) {
          await deleteItemFromDb(item.id);
        }

        setItems((prev) => prev.filter((item) => item.layer !== target));
        setStatus(`Cleared all ${target} items.`);
      }

      setClearConfirmTarget(null);
      setClearClosetModalOpen(false);
    } catch (error) {
      console.error(error);
      setStatus("Could not clear that section.");
    } finally {
      setIsClearingCloset(false);
    }
  };

  const filteredItemsForSlot = (layerName: ClosetLayer, slot: SlotNumber) => {
    const filter = selectedFilterBySlot[slotKey(layerName, slot)];
    return items.filter(
      (item) => item.layer === layerName && (filter === "All" || item.subsection === filter)
    );
  };

  const filteredCounts = useMemo(() => {
    const result: Record<SlotKey, number> = {
      "Hat-1": 0,
      "Hat-2": 0,
      "Top-1": 0,
      "Top-2": 0,
      "Jacket-1": 0,
      "Jacket-2": 0,
      "Bottoms-1": 0,
      "Bottoms-2": 0,
      "Shoes-1": 0,
      "Shoes-2": 0,
    };

    for (const layerName of LAYERS) {
      result[slotKey(layerName, 1)] = filteredItemsForSlot(layerName, 1).length;
      result[slotKey(layerName, 2)] = filteredItemsForSlot(layerName, 2).length;
    }

    return result;
  }, [items, selectedFilterBySlot]);

  useEffect(() => {
    setSelectedIndexBySlot((prev) => {
      const updated = { ...prev };

      for (const layerName of LAYERS) {
        for (const slot of [1, 2] as SlotNumber[]) {
          const key = slotKey(layerName, slot);
          const count = filteredCounts[key];
          if (count === 0) updated[key] = 0;
          else if (updated[key] >= count) updated[key] = 0;
        }
      }

      return updated;
    });
  }, [filteredCounts]);

  const currentItemForSlot = (layerName: ClosetLayer, slot: SlotNumber) => {
    const layerItems = filteredItemsForSlot(layerName, slot);
    if (!layerItems.length) return null;
    const key = slotKey(layerName, slot);
    const currentIndex = selectedIndexBySlot[key] ?? 0;
    return layerItems[currentIndex] ?? layerItems[0];
  };

  const animateSlotChange = (
    key: SlotKey,
    prevItem: ClosetItem | null,
    direction: "prev" | "next"
  ) => {
    if (!prevItem) return;

    setSlideAnimations((prev) => ({
      ...prev,
      [key]: { prevItem, direction, phase: "start" },
    }));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSlideAnimations((prev) => ({
          ...prev,
          [key]: { prevItem, direction, phase: "animate" },
        }));
      });
    });

    window.setTimeout(() => {
      setSlideAnimations((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }, 260);
  };

  const cycleSlot = (layerName: ClosetLayer, slot: SlotNumber, direction: "prev" | "next") => {
    const layerItems = filteredItemsForSlot(layerName, slot);
    if (!layerItems.length) return;

    const key = slotKey(layerName, slot);
    const prevItem = currentItemForSlot(layerName, slot);

    setSelectedIndexBySlot((prev) => {
      const current = prev[key] ?? 0;
      const nextIndex =
        direction === "next"
          ? (current + 1) % layerItems.length
          : (current - 1 + layerItems.length) % layerItems.length;

      return { ...prev, [key]: nextIndex };
    });

    animateSlotChange(key, prevItem, direction);
  };

  const selectedHat1 = slotVisibility["Hat-1"] ? currentItemForSlot("Hat", 1) : null;
  const selectedHat2 =
    duplicateLayers.Hat && slotVisibility["Hat-2"] ? currentItemForSlot("Hat", 2) : null;

  const selectedTop1 = slotVisibility["Top-1"] ? currentItemForSlot("Top", 1) : null;
  const selectedTop2 =
    duplicateLayers.Top && slotVisibility["Top-2"] ? currentItemForSlot("Top", 2) : null;

  const selectedJacket1 = slotVisibility["Jacket-1"] ? currentItemForSlot("Jacket", 1) : null;
  const selectedJacket2 =
    duplicateLayers.Jacket && slotVisibility["Jacket-2"] ? currentItemForSlot("Jacket", 2) : null;

  const selectedBottoms1 = slotVisibility["Bottoms-1"] ? currentItemForSlot("Bottoms", 1) : null;
  const selectedBottoms2 =
    duplicateLayers.Bottoms && slotVisibility["Bottoms-2"]
      ? currentItemForSlot("Bottoms", 2)
      : null;

  const selectedShoes1 = slotVisibility["Shoes-1"] ? currentItemForSlot("Shoes", 1) : null;
  const selectedShoes2 =
    duplicateLayers.Shoes && slotVisibility["Shoes-2"] ? currentItemForSlot("Shoes", 2) : null;

  const findItemById = (id: string | null) => {
    if (!id) return null;
    return items.find((item) => item.id === id) ?? null;
  };

  const jumpToItemInCloset = (item: ClosetItem | null) => {
    if (!item) return;
    setActiveClosetLayer(item.layer);
    setSelectedFilterBySlot((prev) => ({
      ...prev,
      [slotKey(item.layer, 1)]: item.subsection,
    }));

    const matching = items
      .filter((it) => it.layer === item.layer && it.subsection === item.subsection)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const idx = matching.findIndex((it) => it.id === item.id);

    setSelectedIndexBySlot((prev) => ({
      ...prev,
      [slotKey(item.layer, 1)]: idx >= 0 ? idx : 0,
    }));

    setHighlightedItemId(item.id);
    setLoadedFlashId(item.id);
    window.setTimeout(() => setLoadedFlashId(null), 500);
  };

  const activeOutfitIds = {
    hatItemId: selectedHat1?.id ?? null,
    topItemId: selectedTop1?.id ?? null,
    jacketItemId: selectedJacket1?.id ?? null,
    bottomsItemId: selectedBottoms1?.id ?? null,
    shoesItemId: selectedShoes1?.id ?? null,
  };

  const saveCurrentOutfit = async () => {
    if (
      !activeOutfitIds.hatItemId &&
      !activeOutfitIds.topItemId &&
      !activeOutfitIds.jacketItemId &&
      !activeOutfitIds.bottomsItemId &&
      !activeOutfitIds.shoesItemId
    ) {
      setStatus("Build an outfit before saving it.");
      return;
    }

    const title = outfitTitle.trim() || "Untitled Outfit";

    const outfit: SavedOutfit = {
      id: crypto.randomUUID(),
      title,
      ...activeOutfitIds,
      createdAt: new Date().toLocaleString(),
    };

    await saveOutfit(outfit);
    setSavedOutfits((prev) =>
      [outfit, ...prev].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
    setOutfitTitle("");
    setSaveOutfitModalOpen(false);
    setStatus(`Saved outfit: ${title}`);
  };

  const loadSavedOutfit = (outfit: SavedOutfit) => {
    const setLayerFromItemId = (layerName: ClosetLayer, itemId: string | null) => {
      if (!itemId) return;

      const item = findItemById(itemId);
      if (!item) return;

      setSelectedFilterBySlot((prev) => ({
        ...prev,
        [slotKey(layerName, 1)]: item.subsection,
      }));

      const matching = items
        .filter((it) => it.layer === layerName && it.subsection === item.subsection)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const idx = matching.findIndex((it) => it.id === itemId);

      setSelectedIndexBySlot((prev) => ({
        ...prev,
        [slotKey(layerName, 1)]: idx >= 0 ? idx : 0,
      }));
    };

    setLayerFromItemId("Hat", outfit.hatItemId);
    setLayerFromItemId("Top", outfit.topItemId);
    setLayerFromItemId("Jacket", outfit.jacketItemId);
    setLayerFromItemId("Bottoms", outfit.bottomsItemId);
    setLayerFromItemId("Shoes", outfit.shoesItemId);

    setSavedOutfitsOpen(false);
  };

  const getDynamicControlRows = () => {
    const rows: Array<{ layer: ClosetLayer; slot: SlotNumber; top: number }> = [];
    let runningTop = CONTROL_ROW_BASE_TOP.Hat;

    for (const layer of LAYERS) {
      const slotCount = duplicateLayers[layer] ? 2 : 1;
      for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
        rows.push({
          layer,
          slot: (slotIndex + 1) as SlotNumber,
          top: runningTop,
        });
        runningTop += CONTROL_ROW_GAP;
      }
    }

    return rows;
  };

  const dynamicControlRows = useMemo(
    () => getDynamicControlRows(),
    [duplicateLayers.Hat, duplicateLayers.Top, duplicateLayers.Jacket, duplicateLayers.Bottoms, duplicateLayers.Shoes]
  );

  const getMobileSwipeTarget = (clientX: number, clientY: number): SwipeHitTarget | null => {
    const builder = builderRef.current;
    if (!builder) return null;

    const rect = builder.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const centerX = rect.width / 2;

    const regions: Array<{
      layer: ClosetLayer;
      slot: SlotNumber;
      left: number;
      top: number;
      width: number;
      height: number;
      z: number;
    }> = [];

    const pushRegion = (
      layer: ClosetLayer,
      slot: SlotNumber,
      width: number,
      height: number,
      z: number,
      extraOffset?: LayerPosition
    ) => {
      const itemVisible =
        slot === 1
          ? slotVisibility[slotKey(layer, 1)]
          : duplicateLayers[layer] && slotVisibility[slotKey(layer, 2)];

      const itemExists = slot === 1 ? currentItemForSlot(layer, 1) : currentItemForSlot(layer, 2);

      if (!itemVisible || !itemExists) return;

      const basePos = layerPositions[layer];
      const slotOffset =
        slot === 2 ? SECONDARY_LAYER_OFFSETS[layer] : { x: 0, y: 0 };

      const detachedOffset =
        layer === "Jacket" && jacketDetached ? DETACHED_JACKET_OFFSET : { x: 0, y: 0 };

      const finalOffset = extraOffset ?? { x: 0, y: 0 };

      const center = centerX + basePos.x + slotOffset.x + detachedOffset.x + finalOffset.x;
      const top = basePos.y + slotOffset.y + detachedOffset.y + finalOffset.y;

      regions.push({
        layer,
        slot,
        left: center - width / 2,
        top,
        width,
        height,
        z,
      });
    };

    pushRegion("Shoes", 1, 170, 120, 1);
    if (duplicateLayers.Shoes) pushRegion("Shoes", 2, 170, 120, 2);

    pushRegion("Bottoms", 1, 190, 220, 3);
    if (duplicateLayers.Bottoms) pushRegion("Bottoms", 2, 190, 220, 4);

    pushRegion("Top", 1, 220, 210, 5);
    if (duplicateLayers.Top) pushRegion("Top", 2, 220, 210, 6);

    pushRegion("Jacket", 1, jacketDetached ? 180 : 230, 210, 7);
    if (duplicateLayers.Jacket) pushRegion("Jacket", 2, jacketDetached ? 180 : 230, 210, 8);

    pushRegion("Hat", 1, 140, 90, 9);
    if (duplicateLayers.Hat) pushRegion("Hat", 2, 140, 90, 10);

    const hits = regions
      .filter(
        (region) =>
          localX >= region.left &&
          localX <= region.left + region.width &&
          localY >= region.top &&
          localY <= region.top + region.height
      )
      .sort((a, b) => b.z - a.z);

    if (hits.length) {
      return { layer: hits[0].layer, slot: hits[0].slot };
    }

    const activeSlot: SlotNumber = duplicateLayers[activeClosetLayer] ? 2 : 1;
    return { layer: activeClosetLayer, slot: activeSlot };
  };

  const handleBuilderTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || dragMode) return;
    const touch = event.touches[0];
    swipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      active: true,
      target: getMobileSwipeTarget(touch.clientX, touch.clientY),
    };
  };

  const handleBuilderTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || dragMode || !swipeRef.current.active) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - swipeRef.current.startX;
    const dy = touch.clientY - swipeRef.current.startY;
    const target = swipeRef.current.target;
    swipeRef.current.active = false;
    swipeRef.current.target = null;

    if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy)) return;
    if (!target) return;

    cycleSlot(target.layer, target.slot, dx < 0 ? "next" : "prev");
  };

  const startVerticalDrag = (layer: ClosetLayer, clientY: number) => {
  dragRef.current = {
    layer,
    startClientY: clientY,
    startLayerY: layerPositions[layer].y,
  };
};

const moveVerticalDrag = (clientY: number) => {
  const activeLayer = dragRef.current.layer;
  if (!activeLayer) return;

  const deltaY = clientY - dragRef.current.startClientY;

  setLayerPositions((prev) => ({
    ...prev,
    [activeLayer]: {
      ...prev[activeLayer],
      y: Math.round(dragRef.current.startLayerY + deltaY),
    },
  }));
};

const endVerticalDrag = () => {
  dragRef.current.layer = null;
};


  const exportCloset = async () => {
    try {
      const payload: ClosetExportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        items,
        savedOutfits,
        subsectionConfig,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `closet-export-${dateStamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      setStatus("Closet exported.");
    } catch (error) {
      console.error(error);
      setStatus("Could not export closet.");
    }
  };

  const handleImportCloset = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<ClosetExportPayload>;

      const importedItems = Array.isArray(parsed.items) ? parsed.items : [];
      const importedOutfits = Array.isArray(parsed.savedOutfits) ? parsed.savedOutfits : [];
      const importedSubsections = parsed.subsectionConfig ?? null;

      const mergedSubsections = mergeSubsectionConfig(subsectionConfig, importedSubsections);
      await saveSubsectionConfig(mergedSubsections);
      setSubsectionConfig(mergedSubsections);

      const existingItems = [...items];
      const existingOutfits = [...savedOutfits];
      const itemIdMap = new Map<string, string>();
      const itemsToAdd: ClosetItem[] = [];

      for (const importedItem of importedItems) {
        const duplicateItem = existingItems.find((existingItem) =>
          isSameClosetItem(existingItem, importedItem as ClosetItem)
        );

        if (duplicateItem) {
          itemIdMap.set(importedItem.id, duplicateItem.id);
          continue;
        }

        const nextItem: ClosetItem = {
          ...importedItem,
          id: existingItems.some((existingItem) => existingItem.id === importedItem.id)
            ? crypto.randomUUID()
            : importedItem.id,
          createdAt: importedItem.createdAt || new Date().toLocaleString(),
        };

        itemIdMap.set(importedItem.id, nextItem.id);
        itemsToAdd.push(nextItem);
        existingItems.push(nextItem);
        await saveItem(nextItem);
      }

      const outfitsToAdd: SavedOutfit[] = [];

      for (const importedOutfit of importedOutfits) {
        const remappedOutfit: SavedOutfit = {
          ...importedOutfit,
          id: existingOutfits.some((existingOutfit) => existingOutfit.id === importedOutfit.id)
            ? crypto.randomUUID()
            : importedOutfit.id,
          hatItemId: importedOutfit.hatItemId ? itemIdMap.get(importedOutfit.hatItemId) ?? null : null,
          topItemId: importedOutfit.topItemId ? itemIdMap.get(importedOutfit.topItemId) ?? null : null,
          jacketItemId: importedOutfit.jacketItemId ? itemIdMap.get(importedOutfit.jacketItemId) ?? null : null,
          bottomsItemId: importedOutfit.bottomsItemId ? itemIdMap.get(importedOutfit.bottomsItemId) ?? null : null,
          shoesItemId: importedOutfit.shoesItemId ? itemIdMap.get(importedOutfit.shoesItemId) ?? null : null,
          createdAt: importedOutfit.createdAt || new Date().toLocaleString(),
        };

        const duplicateOutfit = existingOutfits.find(
          (existingOutfit) =>
            existingOutfit.title.trim() === remappedOutfit.title.trim() &&
            existingOutfit.hatItemId === remappedOutfit.hatItemId &&
            existingOutfit.topItemId === remappedOutfit.topItemId &&
            existingOutfit.jacketItemId === remappedOutfit.jacketItemId &&
            existingOutfit.bottomsItemId === remappedOutfit.bottomsItemId &&
            existingOutfit.shoesItemId === remappedOutfit.shoesItemId
        );

        if (duplicateOutfit) continue;

        outfitsToAdd.push(remappedOutfit);
        existingOutfits.push(remappedOutfit);
        await saveOutfit(remappedOutfit);
      }

      if (itemsToAdd.length) {
        setItems((prev) =>
          [...itemsToAdd, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      }

      if (outfitsToAdd.length) {
        setSavedOutfits((prev) =>
          [...outfitsToAdd, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      }

      if (!itemsToAdd.length && !outfitsToAdd.length && mergedSubsections === subsectionConfig) {
        setStatus("Nothing new was imported.");
      } else {
        setStatus(
          `Imported ${itemsToAdd.length} item${itemsToAdd.length === 1 ? "" : "s"} and ${outfitsToAdd.length} outfit${outfitsToAdd.length === 1 ? "" : "s"}.`
        );
      }
    } catch (error) {
      console.error(error);
      setStatus("Could not import closet file.");
    } finally {
      event.target.value = "";
    }
  };

  const renderToolbarButton = (
    label: string,
    title: string,
    onClick: () => void,
    isActive?: boolean
  ) => (
    <PressableButton
      onClick={onClick}
      active={isActive}
      style={{
        width: "42px",
        height: "42px",
        borderRadius: "12px",
        border: "1px solid #333",
        background: isActive ? "#ffffff" : "#181818",
        color: isActive ? "#111" : "white",
        cursor: "pointer",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "17px",
      }}
      title={title}
    >
      {label}
    </PressableButton>
  );

  const handleToolbarLayerSelect = (layer: ClosetLayer) => {
    if (toolbarMenuMode === "hide") {
      const slot = duplicateLayers[layer] ? 2 : 1;
      const key = slotKey(layer, slot);
      setSlotVisibility((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
      setToolbarMenuMode(null);
      return;
    }

    if (toolbarMenuMode === "layer") {
      setDuplicateLayers((prev) => ({
        ...prev,
        [layer]: !prev[layer],
      }));
      setToolbarMenuMode(null);
      return;
    }

    if (toolbarMenuMode === "filter") {
      setToolbarTargetLayer(layer);
    }
  };

  const renderArrowRows = (side: "left" | "right") => {
    if (isMobile) return null;

    const wrapperStyle =
      side === "left"
        ? {
            position: "absolute" as const,
            top: 0,
            left: "-118px",
            width: "106px",
            zIndex: 34,
          }
        : {
            position: "absolute" as const,
            top: 0,
            right: "-118px",
            width: "106px",
            zIndex: 34,
          };

    return (
      <div style={wrapperStyle}>
        {dynamicControlRows.map(({ layer, slot, top }) => (
          <div
            key={`${side}-${layer}-${slot}`}
            style={{
              position: "absolute",
              top,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: side === "left" ? "flex-end" : "flex-start",
              gap: "6px",
              transition: "top 0.2s ease",
            }}
          >
            {side === "left" ? (
              <>
                <div
                  style={{
                    color: "#bdbdbd",
                    fontSize: "11px",
                    minWidth: "44px",
                    textAlign: "right",
                  }}
                >
                  {slot === 1 ? layer : `${layer} 2`}
                </div>
                <PressableButton
                  onClick={() => cycleSlot(layer, slot, "prev")}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    border: "1px solid #333",
                    background: "#181818",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  ←
                </PressableButton>
              </>
            ) : (
              <>
                <PressableButton
                  onClick={() => cycleSlot(layer, slot, "next")}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    border: "1px solid #333",
                    background: "#181818",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  →
                </PressableButton>
                <div
                  style={{
                    color: "#bdbdbd",
                    fontSize: "11px",
                    minWidth: "44px",
                    textAlign: "left",
                  }}
                >
                  {slot === 1 ? layer : `${layer} 2`}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSlidingImage = (
    item: ClosetItem | null,
    slotK: SlotKey,
    scaleValue: number,
    position: LayerPosition,
    maxWidth: string,
    maxHeight: string,
    zIndex: number
  ) => {
    if (!item && !slideAnimations[slotK]?.prevItem) return null;

    const animation = slideAnimations[slotK];
    const layer = slotK.split("-")[0] as ClosetLayer;
    const detachedOffset =
      slotK.startsWith("Jacket") && jacketDetached ? DETACHED_JACKET_OFFSET : { x: 0, y: 0 };

    const baseX = position.x + detachedOffset.x;
    const baseY = position.y + detachedOffset.y;

    const enterStart = animation?.direction === "next" ? 120 : -120;
    const exitEnd = animation?.direction === "next" ? -120 : 120;
    const finalScale = getRenderedScale(layer, scaleValue);

    return (
      <>
        {animation?.prevItem && (
          <img
            src={animation.prevItem.image}
            alt={animation.prevItem.name}
            style={{
              position: "absolute",
              top: `${baseY}px`,
              left: "50%",
              transform: `translateX(calc(-50% + ${
                baseX + (animation.phase === "start" ? 0 : exitEnd)
              }px)) scale(${finalScale / 100})`,
              maxWidth,
              maxHeight,
              objectFit: "contain",
              zIndex,
              opacity: animation.phase === "start" ? 1 : 0,
              transition: "transform 0.24s ease, opacity 0.24s ease",
              pointerEvents: "none",
            }}
          />
        )}

        {item && (
          <img
            src={item.image}
            alt={item.name}
            onClick={() => {
  if (!dragMode) jumpToItemInCloset(item);
}}
onTouchStart={(e) => {
  if (!dragMode || !isMobile) return;
  e.stopPropagation();
  startVerticalDrag(layer, e.touches[0].clientY);
}}
onTouchMove={(e) => {
  if (!dragMode || !isMobile) return;
  e.stopPropagation();
  moveVerticalDrag(e.touches[0].clientY);
}}
onTouchEnd={(e) => {
  if (!dragMode || !isMobile) return;
  e.stopPropagation();
  endVerticalDrag();
}}
onTouchCancel={(e) => {
  if (!dragMode || !isMobile) return;
  e.stopPropagation();
  endVerticalDrag();
}}
            style={{
              touchAction: dragMode ? "none" : "auto",
              position: "absolute",
              top: `${baseY}px`,
              left: "50%",
              transform: `translateX(calc(-50% + ${
                baseX + (animation ? (animation.phase === "start" ? enterStart : 0) : 0)
              }px)) scale(${finalScale / 100})`,
              maxWidth,
              maxHeight,
              objectFit: "contain",
              cursor: "pointer",
              zIndex: zIndex + 1,
              opacity: animation ? (animation.phase === "start" ? 0 : 1) : 1,
              transition: "transform 0.24s ease, opacity 0.24s ease",
            }}
          />
        )}
      </>
    );
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#121212",
        padding: isMobile ? "14px" : "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <section
          style={{
            background: "#181818",
            borderRadius: "24px",
            padding: isMobile ? "14px" : "20px",
            border: "1px solid #2b2b2b",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: isMobile ? "stretch" : "center",
              gap: "12px",
              marginBottom: "18px",
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <PressableButton
                onClick={() => setClosetOpen(true)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: "1px solid #333",
                  background: "#111111",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Closet
              </PressableButton>

              <PressableButton
                onClick={() => setSavedOutfitsOpen(true)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: "1px solid #333",
                  background: "#111111",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Saved Outfits
              </PressableButton>

              <PressableButton
                onClick={() => setBuilderInfoOpen(true)}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  border: "1px solid #333",
                  background: "#111111",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "18px",
                }}
                title="Outfit builder info"
              >
                i
              </PressableButton>

              <PressableButton
                onClick={() => setSizePanelOpen((prev) => !prev)}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  border: "1px solid #333",
                  background: "#111111",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "18px",
                }}
                title="Resize layers"
              >
                ⤢
              </PressableButton>
            </div>

            <PressableButton
              onClick={() => setSaveOutfitModalOpen(true)}
              style={{
                padding: "10px 18px",
                borderRadius: "12px",
                border: "1px solid #333",
                background: "#ffffff",
                color: "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Save Outfit
            </PressableButton>
          </div>

          {sizePanelOpen && (
            <div
              style={{
                marginBottom: "16px",
                background: "#101010",
                border: "1px solid #2b2b2b",
                borderRadius: "18px",
                padding: "16px",
              }}
            >
              <div style={{ color: "white", fontWeight: 700, marginBottom: "12px" }}>
                Layer Size
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {LAYERS.map((layerName) => (
                  <div
                    key={layerName}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "90px 120px",
                      gap: "12px",
                      alignItems: "center",
                      color: "white",
                    }}
                  >
                    <div>{layerName}</div>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={scaleInputs[layerName]}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^\d*$/.test(value)) {
                          setScaleInputs((prev) => ({
                            ...prev,
                            [layerName]: value,
                          }));
                        }
                      }}
                      onBlur={() => {
                        const raw = scaleInputs[layerName];
                        const parsed = Number(raw);
                        const clamped = Number.isNaN(parsed)
                          ? layerScales[layerName]
                          : Math.max(1, parsed);

                        setLayerScales((prev) => ({
                          ...prev,
                          [layerName]: clamped,
                        }));

                        setScaleInputs((prev) => ({
                          ...prev,
                          [layerName]: String(clamped),
                        }));
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "1px solid #333",
                        background: "#181818",
                        color: "white",
                        fontSize: "16px",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              background: "#101010",
              border: "1px solid #2a2a2a",
              borderRadius: "24px",
              minHeight: isMobile ? "560px" : "700px",
              padding: isMobile ? "12px" : "24px",
              overflow: "hidden",
              marginBottom: "18px",
            }}
          >
            <div
              onTouchStart={handleBuilderTouchStart}
              onTouchEnd={handleBuilderTouchEnd}
              style={{
                position: "relative",
                width: "100%",
                minHeight: isMobile ? "530px" : "650px",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
              }}
            >
              <div
                ref={builderRef}
                style={{
                  position: "relative",
                  width: isMobile ? "310px" : "500px",
                  height: isMobile ? "520px" : "610px",
                  overflow: "visible",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "24px",
                    border: "1px solid #2f2f2f",
                    background: "linear-gradient(180deg, #131313 0%, #0d0d0d 100%)",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.28)",
                    overflow: "hidden",
                  }}
                />

                {renderArrowRows("left")}
                {renderArrowRows("right")}

                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    left: "12px",
                    display: "flex",
                    gap: "8px",
                    zIndex: 40,
                  }}
                >
                  {renderToolbarButton(
                    isMobile ? "◐" : "👁",
                    "Hide layer",
                    () => {
                      if (toolbarMenuMode === "hide") {
                        setToolbarMenuMode(null);
                        return;
                      }
                      setToolbarMenuMode("hide");
                      setToolbarTargetLayer(activeClosetLayer);
                    },
                    toolbarMenuMode === "hide"
                  )}

                  {renderToolbarButton(
                    "⏷",
                    "Filter layer",
                    () => {
                      if (toolbarMenuMode === "filter") {
                        setToolbarMenuMode(null);
                        return;
                      }
                      setToolbarMenuMode("filter");
                      setToolbarTargetLayer(activeClosetLayer);
                    },
                    toolbarMenuMode === "filter"
                  )}

                  {renderToolbarButton(
                    "⊞",
                    "Layer item",
                    () => {
                      if (toolbarMenuMode === "layer") {
                        setToolbarMenuMode(null);
                        return;
                      }
                      setToolbarMenuMode("layer");
                      setToolbarTargetLayer(activeClosetLayer);
                    },
                    toolbarMenuMode === "layer"
                  )}

                  {renderToolbarButton(
                    "⤴",
                    "Detach jacket",
                    () => setJacketDetached((prev) => !prev),
                    jacketDetached
                  )}

                  {isMobile &&
  renderToolbarButton(
    "⇅",
    "Move layers up and down",
    () => setDragMode((prev) => !prev),
    dragMode
  )}
                </div>

                {toolbarMenuMode && (
                  <div
                    style={{
                      position: "absolute",
                      top: "62px",
                      left: "12px",
                      width: isMobile ? "210px" : "230px",
                      background: "#171717",
                      border: "1px solid #2b2b2b",
                      borderRadius: "14px",
                      padding: "10px",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
                      zIndex: 2000,
                    }}
                  >
                    <div style={{ color: "white", fontWeight: 700, marginBottom: "8px" }}>
                      Select Layer
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "6px",
                        marginBottom: toolbarMenuMode === "filter" ? "10px" : 0,
                      }}
                    >
                      {LAYERS.map((layer) => (
                        <PressableButton
                          key={layer}
                          onClick={() => handleToolbarLayerSelect(layer)}
                          active={toolbarTargetLayer === layer}
                          style={{
                            height: "36px",
                            borderRadius: "10px",
                            border: "1px solid #333",
                            background: toolbarTargetLayer === layer ? "#ffffff" : "#181818",
                            color: toolbarTargetLayer === layer ? "#111" : "white",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {layer}
                        </PressableButton>
                      ))}
                    </div>

                    {toolbarMenuMode === "filter" && (
                      <>
                        <div style={{ color: "white", fontWeight: 700, marginBottom: "8px" }}>
                          {toolbarTargetLayer} Filter
                        </div>

                        <select
                          value={
                            selectedFilterBySlot[
                              slotKey(toolbarTargetLayer, duplicateLayers[toolbarTargetLayer] ? 2 : 1)
                            ]
                          }
                          onChange={(e) =>
                            setSelectedFilterBySlot((prev) => ({
                              ...prev,
                              [slotKey(toolbarTargetLayer, duplicateLayers[toolbarTargetLayer] ? 2 : 1)]:
                                e.target.value,
                            }))
                          }
                          style={{
                            width: "100%",
                            height: "40px",
                            borderRadius: "10px",
                            border: "1px solid #333",
                            background: "#101010",
                            color: "white",
                            padding: "0 10px",
                            fontSize: "16px",
                          }}
                        >
                          <option value="All">All</option>
                          {subsectionConfig[toolbarTargetLayer].map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}

                {renderSlidingImage(
                  selectedShoes1,
                  "Shoes-1",
                  layerScales.Shoes,
                  layerPositions.Shoes,
                  isMobile ? "160px" : "185px",
                  isMobile ? "82px" : "95px",
                  1
                )}

                {duplicateLayers.Shoes &&
                  renderSlidingImage(
                    selectedShoes2,
                    "Shoes-2",
                    layerScales.Shoes,
                    {
                      x: layerPositions.Shoes.x + SECONDARY_LAYER_OFFSETS.Shoes.x,
                      y: layerPositions.Shoes.y + SECONDARY_LAYER_OFFSETS.Shoes.y,
                    },
                    isMobile ? "160px" : "185px",
                    isMobile ? "82px" : "95px",
                    2
                  )}

                {renderSlidingImage(
                  selectedBottoms1,
                  "Bottoms-1",
                  layerScales.Bottoms,
                  layerPositions.Bottoms,
                  isMobile ? "170px" : "200px",
                  isMobile ? "150px" : "175px",
                  3
                )}

                {duplicateLayers.Bottoms &&
                  renderSlidingImage(
                    selectedBottoms2,
                    "Bottoms-2",
                    layerScales.Bottoms,
                    {
                      x: layerPositions.Bottoms.x + SECONDARY_LAYER_OFFSETS.Bottoms.x,
                      y: layerPositions.Bottoms.y + SECONDARY_LAYER_OFFSETS.Bottoms.y,
                    },
                    isMobile ? "170px" : "200px",
                    isMobile ? "150px" : "175px",
                    4
                  )}

                {renderSlidingImage(
                  selectedTop1,
                  "Top-1",
                  layerScales.Top,
                  layerPositions.Top,
                  isMobile ? "180px" : "210px",
                  isMobile ? "150px" : "170px",
                  5
                )}

                {duplicateLayers.Top &&
                  renderSlidingImage(
                    selectedTop2,
                    "Top-2",
                    layerScales.Top,
                    {
                      x: layerPositions.Top.x + SECONDARY_LAYER_OFFSETS.Top.x,
                      y: layerPositions.Top.y + SECONDARY_LAYER_OFFSETS.Top.y,
                    },
                    isMobile ? "180px" : "210px",
                    isMobile ? "150px" : "170px",
                    6
                  )}

                {renderSlidingImage(
                  selectedJacket1,
                  "Jacket-1",
                  layerScales.Jacket,
                  layerPositions.Jacket,
                  isMobile ? "186px" : "220px",
                  isMobile ? "160px" : "178px",
                  7
                )}

                {duplicateLayers.Jacket &&
                  renderSlidingImage(
                    selectedJacket2,
                    "Jacket-2",
                    layerScales.Jacket,
                    {
                      x: layerPositions.Jacket.x + SECONDARY_LAYER_OFFSETS.Jacket.x,
                      y: layerPositions.Jacket.y + SECONDARY_LAYER_OFFSETS.Jacket.y,
                    },
                    isMobile ? "186px" : "220px",
                    isMobile ? "160px" : "178px",
                    8
                  )}

                {renderSlidingImage(
                  selectedHat1,
                  "Hat-1",
                  layerScales.Hat,
                  layerPositions.Hat,
                  isMobile ? "120px" : "150px",
                  isMobile ? "72px" : "88px",
                  9
                )}

                {duplicateLayers.Hat &&
                  renderSlidingImage(
                    selectedHat2,
                    "Hat-2",
                    layerScales.Hat,
                    {
                      x: layerPositions.Hat.x + SECONDARY_LAYER_OFFSETS.Hat.x,
                      y: layerPositions.Hat.y + SECONDARY_LAYER_OFFSETS.Hat.y,
                    },
                    isMobile ? "120px" : "150px",
                    isMobile ? "72px" : "88px",
                    10
                  )}

                {!selectedHat1 &&
                  !selectedTop1 &&
                  !selectedJacket1 &&
                  !selectedBottoms1 &&
                  !selectedShoes1 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#777",
                        textAlign: "center",
                        padding: "20px",
                        zIndex: 2,
                      }}
                    >
                      Add clothes to your closet, then build an outfit here.
                    </div>
                  )}

                  {isMobile && dragMode && (
  <div
    style={{
      position: "absolute",
      bottom: "44px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 36,
      background: "rgba(216,155,29,0.92)",
      color: "#111",
      padding: "6px 12px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    Drag clothes up or down
  </div>
)}

                {isMobile && !dragMode && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 35,
                      background: "rgba(0,0,0,0.65)",
                      color: "#d8d8d8",
                      padding: "8px 16px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      minWidth: "200px",
                      textAlign: "center",
                    }}
                  >
                    Swipe to Change Layer
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {builderInfoOpen && (
        <>
          <div
            onClick={() => setBuilderInfoOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 3000,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(500px, 92vw)",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "20px",
              padding: "20px",
              zIndex: 3001,
            }}
          >
            <h3 style={{ color: "white", marginTop: 0 }}>Outfit Builder Info</h3>
            <div style={{ color: "#d7d7d7", lineHeight: 1.55, fontSize: "14px" }}>
              <div style={{ marginBottom: "10px" }}>
                <strong>Hide</strong> opens a layer picker, then hides or shows that layer.
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Filter</strong> opens a layer picker, then lets you choose that layer’s
                subcategory filter.
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Layer</strong> opens a layer picker, then adds or removes a second row for
                that clothing type.
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Detach Jacket</strong> is now a direct toggle.
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Reposition Arrows</strong> allows you to vertically adjust clothing positions.
              </div>
              <div>On phone, swipe over the visible clothing piece you want to change.</div>
            </div>

            <PressableButton
              onClick={() => setBuilderInfoOpen(false)}
              style={{
                marginTop: "16px",
                width: "100%",
                height: "42px",
                borderRadius: "12px",
                border: "1px solid #333",
                background: "#ffffff",
                color: "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Close
            </PressableButton>
          </div>
        </>
      )}

      {photoTipsOpen && (
        <>
          <div
            onClick={() => setPhotoTipsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 105,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(460px, 92vw)",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "20px",
              padding: "20px",
              zIndex: 106,
            }}
          >
            <h3 style={{ color: "white", marginTop: 0 }}>Photo Tips</h3>
            <div style={{ color: "#d5d5d5", lineHeight: 1.55, fontSize: "14px" }}>
              For the best cutout results, use:
              <div style={{ marginTop: "10px" }}>• a clear contrasting background</div>
              <div>• good lighting</div>
              <div>• little to no shadowing</div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "16px",
                color: "white",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={dontShowTipsChecked}
                onChange={(e) => setDontShowTipsChecked(e.target.checked)}
              />
              Don’t show this again
            </label>

            <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
              <PressableButton
                onClick={() => {
                  setPhotoTipsOpen(false);
                  setStatus("Cutout canceled.");
                }}
                style={{
                  flex: 1,
                  height: "42px",
                  borderRadius: "12px",
                  border: "1px solid #333",
                  background: "#181818",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel
              </PressableButton>

              <PressableButton
                onClick={() => {
                  if (dontShowTipsChecked) setSkipPhotoTips(true);
                  setEditorImage(pendingEditorImage);
                  setPhotoTipsOpen(false);
                  setEditorOpen(true);
                  setStatus("Refine the selection, then apply the cutout.");
                }}
                style={{
                  flex: 1,
                  height: "42px",
                  borderRadius: "12px",
                  border: "1px solid #333",
                  background: "#ffffff",
                  color: "#111",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Continue
              </PressableButton>
            </div>
          </div>
        </>
      )}

      {moveItemModal && (
        <>
          <div
            onClick={() => setMoveItemModal(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 4000,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(420px, 92vw)",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "20px",
              padding: "20px",
              zIndex: 4001,
            }}
          >
            <h3 style={{ color: "white", marginTop: 0 }}>Move Category</h3>
            <div style={{ color: "#d4d4d4", marginBottom: "12px", fontSize: "14px" }}>
              Move <strong>{moveItemModal.name}</strong> to:
            </div>

            <div
              style={{
                display: "grid",
                gap: "8px",
                maxHeight: "280px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {subsectionConfig[moveItemModal.layer].map((sub) => (
                <PressableButton
                  key={sub}
                  onClick={() => moveItemToSubcategory(moveItemModal, sub)}
                  active={sub === moveItemModal.subsection}
                  style={{
                    height: "40px",
                    borderRadius: "10px",
                    border: "1px solid #333",
                    background: sub === moveItemModal.subsection ? "#ffffff" : "#101010",
                    color: sub === moveItemModal.subsection ? "#111" : "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {sub}
                </PressableButton>
              ))}
            </div>

            <PressableButton
              onClick={() => setMoveItemModal(null)}
              style={{
                marginTop: "14px",
                width: "100%",
                height: "40px",
                borderRadius: "10px",
                border: "1px solid #333",
                background: "#181818",
                color: "white",
                cursor: "pointer",
              }}
            >
              Cancel
            </PressableButton>
          </div>
        </>
      )}

      {closetOpen && (
        <>
          <div
            onClick={() => setClosetOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 30,
            }}
          />

          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: isMobile ? "100vw" : "min(1100px, 88vw)",
              height: "100vh",
              background: "#171717",
              borderLeft: "1px solid #2b2b2b",
              zIndex: 40,
              padding: isMobile ? "14px" : "20px",
              overflowY: "auto",
              boxShadow: "-12px 0 30px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: isMobile ? "stretch" : "center",
                marginBottom: "18px",
                gap: "10px",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <h2 style={{ margin: 0, color: "white" }}>Closet</h2>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportCloset}
                  style={{ display: "none" }}
                />

                <PressableButton
                  onClick={exportCloset}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid #333",
                    background: "#101010",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Export Closet
                </PressableButton>

                <PressableButton
                  onClick={() => importInputRef.current?.click()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid #333",
                    background: "#101010",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Import Closet
                </PressableButton>

                <PressableButton
                  onClick={() => setClearClosetModalOpen(true)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid #333",
                    background: "#101010",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Clear Whole or Section of Closet
                </PressableButton>

                <PressableButton
                  onClick={() => setClosetOpen(false)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid #333",
                    background: "#101010",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Close
                </PressableButton>
              </div>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              {LAYERS.map((layerName) => {
                const visibleItems = items.filter(
                  (item) =>
                    item.layer === layerName &&
                    (layerViewFilter[layerName] === "All" ||
                      item.subsection === layerViewFilter[layerName])
                );

                return (
                  <div
                    key={layerName}
                    style={{
                      background: "#101010",
                      border: "1px solid #2b2b2b",
                      borderRadius: "18px",
                      overflow: "hidden",
                    }}
                  >
                    <PressableButton
                      onClick={() => {
                        setExpandedLayers((prev) => ({
                          ...prev,
                          [layerName]: !prev[layerName],
                        }));
                        setActiveClosetLayer(layerName);
                      }}
                      style={{
                        width: "100%",
                        padding: "16px 18px",
                        background: "#181818",
                        border: "none",
                        borderBottom: expandedLayers[layerName]
                          ? "1px solid #2b2b2b"
                          : "none",
                        color: "white",
                        textAlign: "left",
                        fontSize: "18px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{layerName}</span>
                      <span>{expandedLayers[layerName] ? "−" : "+"}</span>
                    </PressableButton>

                    {expandedLayers[layerName] && (
                      <div style={{ padding: "16px" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginBottom: "14px",
                            alignItems: "center",
                          }}
                        >
                          <PressableButton
                            onClick={() =>
                              setLayerViewFilter((prev) => ({
                                ...prev,
                                [layerName]: "All",
                              }))
                            }
                            active={layerViewFilter[layerName] === "All"}
                            style={{
                              width: "46px",
                              height: "46px",
                              borderRadius: "999px",
                              border: "1px solid #333",
                              background: layerViewFilter[layerName] === "All" ? "#ffffff" : "#181818",
                              color: layerViewFilter[layerName] === "All" ? "#111" : "white",
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                          >
                            All
                          </PressableButton>

                          {subsectionConfig[layerName].map((sub) => (
                            <div
                              key={sub}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "#181818",
                                border: "1px solid #2b2b2b",
                                borderRadius: "999px",
                                padding: "4px",
                              }}
                            >
                              <PressableButton
                                onClick={() =>
                                  setLayerViewFilter((prev) => ({
                                    ...prev,
                                    [layerName]: sub,
                                  }))
                                }
                                active={layerViewFilter[layerName] === sub}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "999px",
                                  border: "none",
                                  background:
                                    layerViewFilter[layerName] === sub ? "#ffffff" : "transparent",
                                  color: layerViewFilter[layerName] === sub ? "#111" : "white",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                {sub}
                              </PressableButton>

                              <PressableButton
                                onClick={() => renameSubsection(layerName, sub)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "999px",
                                  border: "none",
                                  background: "transparent",
                                  color: "#cfcfcf",
                                  cursor: "pointer",
                                }}
                              >
                                ✎
                              </PressableButton>

                              <PressableButton
                                onClick={() => deleteSubsection(layerName, sub)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "999px",
                                  border: "none",
                                  background: "transparent",
                                  color: "#cfcfcf",
                                  cursor: "pointer",
                                }}
                              >
                                ×
                              </PressableButton>
                            </div>
                          ))}

                          <PressableButton
                            onClick={async () => {
                              const value = window.prompt("New subcategory");
                              if (!value) return;
                              await addSubsection(layerName, value);
                            }}
                            style={{
                              width: "46px",
                              height: "46px",
                              borderRadius: "999px",
                              border: "1px solid #333",
                              background: "#181818",
                              color: "white",
                              cursor: "pointer",
                              fontSize: "24px",
                              lineHeight: 1,
                            }}
                          >
                            +
                          </PressableButton>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: isMobile
                              ? "repeat(2, minmax(0, 1fr))"
                              : "repeat(4, minmax(0, 1fr))",
                            gap: "12px",
                          }}
                        >
                          <PressableButton
                            onClick={() => openAddModalForLayer(layerName)}
                            style={{
                              minHeight: "220px",
                              borderRadius: "16px",
                              border: "1px dashed #3a3a3a",
                              background: "#181818",
                              color: "white",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "44px",
                            }}
                          >
                            +
                          </PressableButton>

                          {visibleItems.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                minHeight: "220px",
                                borderRadius: "16px",
                                border:
                                  highlightedItemId === item.id
                                    ? "2px solid #ffffff"
                                    : "1px solid #2b2b2b",
                                background: "#181818",
                                padding: "12px",
                                display: "flex",
                                flexDirection: "column",
                                position: "relative",
                              }}
                            >
                              <PressableButton
                                onClick={() => jumpToItemInCloset(item)}
                                style={{
                                  position: "absolute",
                                  top: "10px",
                                  left: "10px",
                                  padding: "6px 10px",
                                  borderRadius: "10px",
                                  border: "1px solid #333",
                                  background: loadedFlashId === item.id ? "#b88912" : "#101010",
                                  color: loadedFlashId === item.id ? "#111" : "white",
                                  cursor: "pointer",
                                  zIndex: 2,
                                  fontSize: "12px",
                                  transition:
                                    "background 0.18s ease, color 0.18s ease, transform 0.08s ease",
                                }}
                              >
                                Load
                              </PressableButton>

                              <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 3 }}>
                                <PressableButton
                                  onClick={() =>
                                    setItemMenuOpenId((prev) => (prev === item.id ? null : item.id))
                                  }
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    borderRadius: "10px",
                                    border: "1px solid #333",
                                    background: "#101010",
                                    color: "white",
                                    cursor: "pointer",
                                  }}
                                >
                                  ⚙
                                </PressableButton>

                                {itemMenuOpenId === item.id && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "40px",
                                      right: 0,
                                      width: "170px",
                                      background: "#171717",
                                      border: "1px solid #2b2b2b",
                                      borderRadius: "12px",
                                      padding: "8px",
                                      boxShadow: "0 16px 30px rgba(0,0,0,0.35)",
                                      zIndex: 1000,
                                      display: "grid",
                                      gap: "6px",
                                    }}
                                  >
                                    <PressableButton
                                      onClick={() => renameItem(item)}
                                      style={{
                                        height: "36px",
                                        borderRadius: "10px",
                                        border: "1px solid #333",
                                        background: "#101010",
                                        color: "white",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Rename
                                    </PressableButton>

                                    <PressableButton
                                      onClick={() => {
                                        setMoveItemModal(item);
                                        setItemMenuOpenId(null);
                                      }}
                                      style={{
                                        height: "36px",
                                        borderRadius: "10px",
                                        border: "1px solid #333",
                                        background: "#101010",
                                        color: "white",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Move Category
                                    </PressableButton>

                                    <PressableButton
                                      onClick={() => deleteItem(item.id)}
                                      style={{
                                        height: "36px",
                                        borderRadius: "10px",
                                        border: "1px solid #333",
                                        background: "#101010",
                                        color: "white",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Delete
                                    </PressableButton>
                                  </div>
                                )}
                              </div>

                              <PressableButton
                                onClick={() => jumpToItemInCloset(item)}
                                style={{
                                  flex: 1,
                                  border: "none",
                                  background: "#101010",
                                  borderRadius: "12px",
                                  marginBottom: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  padding: "8px",
                                }}
                              >
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  style={{ maxHeight: "120px", maxWidth: "100%" }}
                                />
                              </PressableButton>

                              <div style={{ color: "white", fontWeight: 700 }}>{item.name}</div>
                              <div style={{ color: "#cfcfcf", fontSize: "13px", marginTop: "4px" }}>
                                {item.subsection}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}

      {clearClosetModalOpen && (
        <>
          <div
            onClick={() => {
              if (!isClearingCloset) {
                setClearClosetModalOpen(false);
                setClearConfirmTarget(null);
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              zIndex: 5000,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(460px, 92vw)",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "20px",
              padding: "20px",
              zIndex: 5001,
            }}
          >
            {!clearConfirmTarget ? (
              <>
                <h3 style={{ color: "white", marginTop: 0 }}>Clear Whole or Section of Closet</h3>
                <div style={{ color: "#d5d5d5", fontSize: "14px", marginBottom: "14px" }}>
                  Choose what you want to clear:
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    maxHeight: "320px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  <PressableButton
                    onClick={() => setClearConfirmTarget("All")}
                    style={{
                      height: "42px",
                      borderRadius: "12px",
                      border: "1px solid #333",
                      background: "#101010",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    All
                  </PressableButton>

                  {LAYERS.map((layer) => (
                    <PressableButton
                      key={layer}
                      onClick={() => setClearConfirmTarget(layer)}
                      style={{
                        height: "42px",
                        borderRadius: "12px",
                        border: "1px solid #333",
                        background: "#101010",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {layer}
                    </PressableButton>
                  ))}

                  <PressableButton
                    onClick={() => setClearConfirmTarget("Saved Outfits")}
                    style={{
                      height: "42px",
                      borderRadius: "12px",
                      border: "1px solid #333",
                      background: "#101010",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Saved Outfits
                  </PressableButton>
                </div>

                <PressableButton
                  onClick={() => setClearClosetModalOpen(false)}
                  style={{
                    marginTop: "14px",
                    width: "100%",
                    height: "42px",
                    borderRadius: "12px",
                    border: "1px solid #333",
                    background: "#181818",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </PressableButton>
              </>
            ) : (
              <>
                <h3 style={{ color: "white", marginTop: 0 }}>Are You Sure?</h3>
                <div style={{ color: "#d5d5d5", lineHeight: 1.55, fontSize: "14px", marginBottom: "14px" }}>
                  {clearConfirmTarget === "All"
                    ? "Are you sure you want to clear your whole closet and all saved outfits?"
                    : clearConfirmTarget === "Saved Outfits"
                    ? 'Are you sure you want to clear all "Saved Outfits"?'
                    : `Are you sure you want to clear your whole "${clearConfirmTarget}" category?`}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <PressableButton
                    onClick={() => setClearConfirmTarget(null)}
                    disabled={isClearingCloset}
                    style={{
                      flex: 1,
                      height: "42px",
                      borderRadius: "12px",
                      border: "1px solid #333",
                      background: "#181818",
                      color: "white",
                      cursor: isClearingCloset ? "default" : "pointer",
                      opacity: isClearingCloset ? 0.6 : 1,
                    }}
                  >
                    Back
                  </PressableButton>

                  <PressableButton
                    onClick={() => handleClearCloset(clearConfirmTarget)}
                    disabled={isClearingCloset}
                    style={{
                      flex: 1,
                      height: "42px",
                      borderRadius: "12px",
                      border: "1px solid #333",
                      background: "#ffffff",
                      color: "#111",
                      cursor: isClearingCloset ? "default" : "pointer",
                      fontWeight: 700,
                      opacity: isClearingCloset ? 0.6 : 1,
                    }}
                  >
                    {isClearingCloset ? "Clearing..." : "Yes, Clear It"}
                  </PressableButton>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {addModalOpen && (
        <>
          <div
            onClick={() => setAddModalOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 50,
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(520px, 92vw)",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "20px",
              padding: "20px",
              zIndex: 60,
              boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 style={{ margin: 0, color: "white" }}>Add {activeClosetLayer}</h3>
              <PressableButton
                onClick={() => setAddModalOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#101010",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Close
              </PressableButton>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ color: "white", display: "block" }}>Item name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Black hoodie"
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#181818",
                  color: "white",
                  fontSize: "16px",
                }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ color: "white", display: "block" }}>Subcategory</label>
              <select
                value={subsection}
                onChange={(e) => setSubsection(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#181818",
                  color: "white",
                  fontSize: "16px",
                }}
              >
                {subsectionConfig[activeClosetLayer].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ color: "white", display: "block", marginBottom: "8px" }}>
                Clothing photo
              </label>

              <PressableButton
                onClick={() => {
                  if (!isProcessingImage) fileInputRef.current?.click();
                }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid #333",
                  background: "#181818",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                  opacity: isProcessingImage ? 0.6 : 1,
                }}
              >
                Upload Photo
              </PressableButton>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>

            <div
              style={{
                border: "1px dashed #333",
                borderRadius: "16px",
                background: "#181818",
                padding: "16px",
                marginBottom: "14px",
              }}
            >
              <div style={{ color: "white", marginBottom: "10px" }}>Preview</div>

              {isProcessingImage && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "12px",
                    color: "white",
                    fontSize: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "2px solid #555",
                      borderTop: "2px solid #ffffff",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>Working...</span>
                </div>
              )}

              <div
                style={{
                  minHeight: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: preview ? "12px" : "0",
                }}
              >
                {preview ? (
                  <img src={preview} alt="Preview" style={{ maxHeight: "180px", maxWidth: "100%" }} />
                ) : (
                  <div style={{ color: "#888" }}>Upload a clothing item</div>
                )}
              </div>

              {preview && (
                <PressableButton
                  onClick={() => {
                    setPreview("");
                    setEditorImage(originalEditorImage);
                    setEditorOpen(true);
                    setStatus("Redoing cutout from original image...");
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #333",
                    background: "#101010",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Redo Cutout
                </PressableButton>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <PressableButton
                onClick={addItem}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#ffffff",
                  color: "#111",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Save item
              </PressableButton>

              <PressableButton
                onClick={clearDraft}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#181818",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Clear
              </PressableButton>
            </div>

            <div
              style={{
                background: "#181818",
                padding: "12px",
                borderRadius: "12px",
                color: "#e5e5e5",
                border: "1px solid #2b2b2b",
                fontSize: "14px",
              }}
            >
              {status}
            </div>
          </div>
        </>
      )}

      {editorOpen && (
        <ImageCutoutEditor
          imageSrc={editorImage}
          onCancel={() => {
            setEditorOpen(false);
            setStatus("Cutout canceled.");
          }}
          onApply={async (cutoutDataUrl) => {
            try {
              setIsProcessingImage(true);
              setStatus("Processing cutout...");
              const processed = await resizeImage(cutoutDataUrl, 500, 500);
              setPreview(processed);
              setEditorOpen(false);
              setStatus("Cutout ready. Save item when you're ready.");
            } catch (error) {
              console.error(error);
              setStatus("Could not finish cutout.");
            } finally {
              setIsProcessingImage(false);
            }
          }}
        />
      )}

      {saveOutfitModalOpen && (
        <>
          <div
            onClick={() => setSaveOutfitModalOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 70,
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(420px, 92vw)",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "20px",
              padding: "20px",
              zIndex: 80,
            }}
          >
            <h3 style={{ color: "white", marginTop: 0 }}>Save Outfit</h3>

            <input
              value={outfitTitle}
              onChange={(e) => setOutfitTitle(e.target.value)}
              placeholder="Outfit title"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #333",
                background: "#181818",
                color: "white",
                marginBottom: "14px",
                fontSize: "16px",
              }}
            />

            <div style={{ display: "flex", gap: "8px" }}>
              <PressableButton
                onClick={saveCurrentOutfit}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#ffffff",
                  color: "#111",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Save
              </PressableButton>

              <PressableButton
                onClick={() => setSaveOutfitModalOpen(false)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#181818",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </PressableButton>
            </div>
          </div>
        </>
      )}

      {savedOutfitsOpen && (
        <>
          <div
            onClick={() => setSavedOutfitsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 90,
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(1100px, 92vw)",
              maxHeight: "88vh",
              overflowY: "auto",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "20px",
              padding: "20px",
              zIndex: 100,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 style={{ color: "white", margin: 0 }}>Saved Outfits</h3>
              <PressableButton
                onClick={() => setSavedOutfitsOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #333",
                  background: "#101010",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Close
              </PressableButton>
            </div>

            {savedOutfits.length === 0 ? (
              <div style={{ color: "#888" }}>No saved outfits yet.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(1, minmax(0, 1fr))"
                    : "repeat(4, minmax(0, 1fr))",
                  gap: "14px",
                }}
              >
                {savedOutfits.map((outfit) => {
                  const hat = findItemById(outfit.hatItemId);
                  const top = findItemById(outfit.topItemId);
                  const jacket = findItemById(outfit.jacketItemId);
                  const bottoms = findItemById(outfit.bottomsItemId);
                  const shoes = findItemById(outfit.shoesItemId);

                  return (
                    <div
                      key={outfit.id}
                      style={{
                        background: "#181818",
                        border: "1px solid #2b2b2b",
                        borderRadius: "16px",
                        padding: "12px",
                      }}
                    >
                      <PressableButton
                        onClick={() => loadSavedOutfit(outfit)}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "#101010",
                          borderRadius: "12px",
                          marginBottom: "10px",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "center",
                          padding: "10px",
                        }}
                      >
                        <OutfitPreview
                          hat={hat}
                          top={top}
                          jacket={jacket}
                          bottoms={bottoms}
                          shoes={shoes}
                          scales={layerScales}
                        />
                      </PressableButton>

                      <div style={{ color: "white", fontWeight: 700 }}>{outfit.title}</div>
                      <div style={{ color: "#8a8a8a", fontSize: "12px", marginTop: "4px" }}>
                        Saved {outfit.createdAt}
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        <PressableButton
                          onClick={() => loadSavedOutfit(outfit)}
                          style={{
                            flex: 1,
                            padding: "8px 10px",
                            borderRadius: "10px",
                            border: "1px solid #333",
                            background: "#101010",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          Load
                        </PressableButton>

                        <PressableButton
                          onClick={async () => {
                            await deleteSavedOutfit(outfit.id);
                            setSavedOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 10px",
                            borderRadius: "10px",
                            border: "1px solid #333",
                            background: "#101010",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </PressableButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}