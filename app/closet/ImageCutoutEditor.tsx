"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BrushMode = "add" | "remove";
type EditorMode = "auto" | "touchup";

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onApply: (cutoutDataUrl: string) => void | Promise<void>;
};

const LABEL_FOREGROUND = 1;
const LABEL_BACKGROUND = 2;

type Rgb = { r: number; g: number; b: number };

const BRUSH_MIN = 8;
const BRUSH_MAX = 140;
const BRUSH_DEFAULT = 24;

const TOLERANCE_MIN = 25;
const TOLERANCE_MAX = 85;
const TOLERANCE_DEFAULT = 85;

function percentToValue(percent: number, min: number, max: number) {
  return Math.round(min + (percent / 100) * (max - min));
}

function valueToPercent(value: number, min: number, max: number) {
  return Math.round(((value - min) / (max - min)) * 100);
}

function getPixelIndex(x: number, y: number, width: number) {
  return (y * width + x) * 4;
}

function colorDistanceRgb(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getCornerAverage(data: Uint8ClampedArray, width: number, height: number): Rgb {
  const sampleSize = Math.max(10, Math.min(24, Math.floor(Math.min(width, height) * 0.04)));

  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y++) {
      for (let x = startX; x < startX + sampleSize; x++) {
        const i = getPixelIndex(x, y, width);
        totalR += data[i];
        totalG += data[i + 1];
        totalB += data[i + 2];
        count++;
      }
    }
  }

  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count,
  };
}

function paintCircle(
  labels: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  label: number
) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        labels[y * width + x] = label;
      }
    }
  }
}

function buildMask(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  labels: Uint8Array,
  tolerance: number
) {
  const totalPixels = width * height;
  const background = new Uint8Array(totalPixels);
  const visited = new Uint8Array(totalPixels);

  const bgAvg = getCornerAverage(sourceData, width, height);

  const qx: number[] = [];
  const qy: number[] = [];
  let head = 0;

  function enqueue(x: number, y: number) {
    const idx = y * width + x;
    if (visited[idx]) return;
    if (labels[idx] === LABEL_FOREGROUND) return;

    const i = getPixelIndex(x, y, width);
    const distToBg = colorDistanceRgb(
      sourceData[i],
      sourceData[i + 1],
      sourceData[i + 2],
      bgAvg.r,
      bgAvg.g,
      bgAvg.b
    );

    if (labels[idx] === LABEL_BACKGROUND || distToBg <= tolerance) {
      visited[idx] = 1;
      qx.push(x);
      qy.push(y);
    }
  }

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < qx.length) {
    const x = qx[head];
    const y = qy[head];
    head++;

    const idx = y * width + x;
    background[idx] = 1;

    const currentPixel = getPixelIndex(x, y, width);

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      if (labels[nIdx] === LABEL_FOREGROUND) continue;

      const ni = getPixelIndex(nx, ny, width);

      const distToBg = colorDistanceRgb(
        sourceData[ni],
        sourceData[ni + 1],
        sourceData[ni + 2],
        bgAvg.r,
        bgAvg.g,
        bgAvg.b
      );

      const distToCurrent = colorDistanceRgb(
        sourceData[ni],
        sourceData[ni + 1],
        sourceData[ni + 2],
        sourceData[currentPixel],
        sourceData[currentPixel + 1],
        sourceData[currentPixel + 2]
      );

      const shouldGrow =
        labels[nIdx] === LABEL_BACKGROUND ||
        distToBg <= tolerance ||
        distToCurrent <= tolerance * 0.6;

      if (shouldGrow) {
        visited[nIdx] = 1;
        qx.push(nx);
        qy.push(ny);
      }
    }
  }

  const mask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    mask[i] = background[i] ? 0 : 1;
    if (labels[i] === LABEL_FOREGROUND) mask[i] = 1;
    if (labels[i] === LABEL_BACKGROUND) mask[i] = 0;
  }

  const fgSeedIndices: number[] = [];
  let fgR = 0;
  let fgG = 0;
  let fgB = 0;
  let fgCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    if (labels[i] === LABEL_FOREGROUND) {
      fgSeedIndices.push(i);
      const px = i * 4;
      fgR += sourceData[px];
      fgG += sourceData[px + 1];
      fgB += sourceData[px + 2];
      fgCount++;
    }
  }

  if (fgCount > 0) {
    const fgAvg = {
      r: fgR / fgCount,
      g: fgG / fgCount,
      b: fgB / fgCount,
    };

    const fgVisited = new Uint8Array(totalPixels);
    const fgQx: number[] = [];
    const fgQy: number[] = [];
    let fgHead = 0;

    for (const seedIndex of fgSeedIndices) {
      const x = seedIndex % width;
      const y = Math.floor(seedIndex / width);
      fgVisited[seedIndex] = 1;
      fgQx.push(x);
      fgQy.push(y);
      mask[seedIndex] = 1;
    }

    while (fgHead < fgQx.length) {
      const x = fgQx[fgHead];
      const y = fgQy[fgHead];
      fgHead++;

      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const idx = ny * width + nx;
        if (fgVisited[idx]) continue;
        if (labels[idx] === LABEL_BACKGROUND) continue;

        const i = idx * 4;

        const distToFg = colorDistanceRgb(
          sourceData[i],
          sourceData[i + 1],
          sourceData[i + 2],
          fgAvg.r,
          fgAvg.g,
          fgAvg.b
        );

        const allow = mask[idx] === 1 || distToFg <= tolerance * 1.05;

        if (allow) {
          fgVisited[idx] = 1;
          mask[idx] = 1;
          fgQx.push(nx);
          fgQy.push(ny);
        }
      }
    }
  }

  return mask;
}

function exportCutout(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  canvas.width = width;
  canvas.height = height;

  const output = new ImageData(width, height);

  for (let i = 0; i < width * height; i++) {
    const src = i * 4;
    output.data[src] = sourceData[src];
    output.data[src + 1] = sourceData[src + 1];
    output.data[src + 2] = sourceData[src + 2];
    output.data[src + 3] = mask[i] ? 255 : 0;
  }

  ctx.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function ImageCutoutEditor({
  imageSrc,
  onCancel,
  onApply,
}: Props) {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const sourceDataRef = useRef<Uint8ClampedArray | null>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const labelsRef = useRef<Uint8Array | null>(null);
  const maskRef = useRef<Uint8Array | null>(null);

  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRebuildRef = useRef<number | null>(null);

  const [editorMode, setEditorMode] = useState<EditorMode>("auto");
  const [brushMode, setBrushMode] = useState<BrushMode>("add");
  const [brushSize, setBrushSize] = useState(BRUSH_DEFAULT);
  const [tolerance, setTolerance] = useState(TOLERANCE_DEFAULT);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 900 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const brushPercent = useMemo(
    () => valueToPercent(brushSize, BRUSH_MIN, BRUSH_MAX),
    [brushSize]
  );

  const tolerancePercent = useMemo(
    () => valueToPercent(tolerance, TOLERANCE_MIN, TOLERANCE_MAX),
    [tolerance]
  );

  function redrawOverlay() {
    const overlayCanvas = overlayCanvasRef.current;
    const mask = maskRef.current;
    const labels = labelsRef.current;
    if (!overlayCanvas || !mask || !labels) return;

    const width = widthRef.current;
    const height = heightRef.current;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    overlayCanvas.width = width;
    overlayCanvas.height = height;

    const overlay = ctx.createImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      const px = i * 4;

      if (mask[i]) {
        overlay.data[px] = 186;
        overlay.data[px + 1] = 142;
        overlay.data[px + 2] = 0;
        overlay.data[px + 3] = 135;
      }

      if (labels[i] === LABEL_FOREGROUND) {
        overlay.data[px] = 214;
        overlay.data[px + 1] = 155;
        overlay.data[px + 2] = 0;
        overlay.data[px + 3] = 210;
      }

      if (labels[i] === LABEL_BACKGROUND) {
        overlay.data[px] = 95;
        overlay.data[px + 1] = 24;
        overlay.data[px + 2] = 24;
        overlay.data[px + 3] = 120;
      }
    }

    ctx.putImageData(overlay, 0, 0);
  }

  function rebuildMask() {
    const sourceData = sourceDataRef.current;
    const labels = labelsRef.current;
    const width = widthRef.current;
    const height = heightRef.current;
    if (!sourceData || !labels || !width || !height) return;

    maskRef.current = buildMask(sourceData, width, height, labels, tolerance);
    redrawOverlay();
  }

  function scheduleMaskRebuild() {
    if (pendingRebuildRef.current !== null) return;

    pendingRebuildRef.current = window.requestAnimationFrame(() => {
      pendingRebuildRef.current = null;
      rebuildMask();
    });
  }

  function resetAutoSelection() {
    const width = widthRef.current;
    const height = heightRef.current;
    labelsRef.current = new Uint8Array(width * height);
    rebuildMask();
  }

  function applyCurrentCutout() {
    const sourceData = sourceDataRef.current;
    const mask = maskRef.current;
    const width = widthRef.current;
    const height = heightRef.current;
    if (!sourceData || !mask || !width || !height) return;

    const output = exportCutout(sourceData, width, height, mask);
    onApply(output);
  }

  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      const baseCanvas = baseCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!baseCanvas || !overlayCanvas) return;

      const width = img.width;
      const height = img.height;

      widthRef.current = width;
      heightRef.current = height;

      baseCanvas.width = width;
      baseCanvas.height = height;
      overlayCanvas.width = width;
      overlayCanvas.height = height;

      const baseCtx = baseCanvas.getContext("2d");
      if (!baseCtx) return;

      baseCtx.clearRect(0, 0, width, height);
      baseCtx.drawImage(img, 0, 0);

      const imageData = baseCtx.getImageData(0, 0, width, height);
      sourceDataRef.current = new Uint8ClampedArray(imageData.data);
      labelsRef.current = new Uint8Array(width * height);
      maskRef.current = buildMask(
        sourceDataRef.current,
        width,
        height,
        labelsRef.current,
        tolerance
      );

      redrawOverlay();
      setImageLoaded(true);
    };

    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (!imageLoaded) return;
    rebuildMask();
  }, [tolerance, imageLoaded]);

  useEffect(() => {
    return () => {
      if (pendingRebuildRef.current !== null) {
        window.cancelAnimationFrame(pendingRebuildRef.current);
      }
    };
  }, []);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);

    return { x, y };
  }

  function applyBrushAtPoint(x: number, y: number) {
    const labels = labelsRef.current;
    const width = widthRef.current;
    const height = heightRef.current;
    if (!labels || !width || !height) return;

    paintCircle(
      labels,
      width,
      height,
      x,
      y,
      brushSize,
      brushMode === "add" ? LABEL_FOREGROUND : LABEL_BACKGROUND
    );
  }

  function applyBrushStroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.ceil(distance / Math.max(3, brushSize * 0.22)));

    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const x = Math.round(from.x + dx * t);
      const y = Math.round(from.y + dy * t);
      applyBrushAtPoint(x, y);
    }
  }

  const toolPanel = (
    <div
      style={{
        width: "100%",
        background: "#111111",
        border: "1px solid #2b2b2b",
        borderRadius: "16px",
        padding: "12px",
        display: "grid",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div style={{ color: "white", fontSize: isMobile ? "20px" : "24px", fontWeight: 700 }}>
          Cutout Editor
        </div>

        <button
          onClick={() => setInfoOpen(true)}
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "999px",
            border: "1px solid #333",
            background: "#181818",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "18px",
            lineHeight: 1,
          }}
          title="How it works"
        >
          i
        </button>
      </div>

      <div style={{ display: "grid", gap: "8px" }}>
        <div style={{ color: "white", fontWeight: 700 }}>Mode</div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setEditorMode("auto")}
            style={{
              flex: 1,
              height: "42px",
              borderRadius: "12px",
              border: "1px solid #333",
              background: editorMode === "auto" ? "#ffffff" : "#181818",
              color: editorMode === "auto" ? "#111" : "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Auto Select
          </button>

          <button
            onClick={() => setEditorMode("touchup")}
            style={{
              flex: 1,
              height: "42px",
              borderRadius: "12px",
              border: "1px solid #333",
              background: editorMode === "touchup" ? "#ffffff" : "#181818",
              color: editorMode === "touchup" ? "#111" : "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Touch Up
          </button>
        </div>
      </div>

      {editorMode === "touchup" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ color: "white", fontWeight: 700 }}>Brush Mode</div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setBrushMode("add")}
              style={{
                flex: 1,
                height: "42px",
                borderRadius: "12px",
                border: "1px solid #333",
                background: brushMode === "add" ? "#ffffff" : "#181818",
                color: brushMode === "add" ? "#111" : "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Add
            </button>

            <button
              onClick={() => setBrushMode("remove")}
              style={{
                flex: 1,
                height: "42px",
                borderRadius: "12px",
                border: "1px solid #333",
                background: brushMode === "remove" ? "#ffffff" : "#181818",
                color: brushMode === "remove" ? "#111" : "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {editorMode === "touchup" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ color: "white", fontWeight: 700 }}>
            Brush Size: {brushPercent}/100
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={brushPercent}
            onChange={(e) =>
              setBrushSize(percentToValue(Number(e.target.value), BRUSH_MIN, BRUSH_MAX))
            }
          />
        </div>
      )}

      <div style={{ display: "grid", gap: "8px" }}>
        <div style={{ color: "white", fontWeight: 700 }}>
          Auto Select Strength: {tolerancePercent}/100
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={tolerancePercent}
          onChange={(e) =>
            setTolerance(percentToValue(Number(e.target.value), TOLERANCE_MIN, TOLERANCE_MAX))
          }
        />
      </div>
    </div>
  );

  const bottomActionBox = (
    <div
      style={{
        width: "100%",
        background: "#111111",
        border: "1px solid #2b2b2b",
        borderRadius: "16px",
        padding: "12px",
        display: "grid",
        gap: "8px",
      }}
    >
      <button
        onClick={resetAutoSelection}
        style={{
          height: "42px",
          borderRadius: "12px",
          border: "1px solid #333",
          background: "#181818",
          color: "white",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Reset Auto Selection
      </button>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            height: "44px",
            borderRadius: "12px",
            border: "1px solid #333",
            background: "#181818",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Cancel
        </button>

        <button
          onClick={applyCurrentCutout}
          style={{
            flex: 1,
            height: "44px",
            borderRadius: "12px",
            border: "1px solid #333",
            background: "#ffffff",
            color: "#111",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Apply Cutout
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.72)",
          zIndex: 110,
        }}
      />

      {infoOpen && (
        <>
          <div
            onClick={() => setInfoOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 121,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(420px, 90vw)",
              background: "#171717",
              border: "1px solid #2b2b2b",
              borderRadius: "18px",
              padding: "18px",
              zIndex: 122,
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                color: "white",
                fontSize: "20px",
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              Cutout Help
            </div>

            <div style={{ color: "#d5d5d5", lineHeight: 1.5, fontSize: "14px" }}>
              <div style={{ marginBottom: "10px" }}>
                <strong>Auto Select</strong> lets you click or tap the clothing item to make the first selection.
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Touch Up</strong> lets you manually add or remove areas.
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Brush Size</strong> changes how large your paint area is.
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Auto Select Strength</strong> controls how aggressively the first guess spreads.
              </div>
              <div style={{ marginBottom: "10px" }}>
                Start with Auto Select, then switch to Touch Up if needed.
              </div>
              <div>
                When it looks good, press <strong>Apply Cutout</strong>.
              </div>
            </div>

            <button
              onClick={() => setInfoOpen(false)}
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
            </button>
          </div>
        </>
      )}

      <div
        style={{
          position: "fixed",
          inset: isMobile ? "1.5vh 2vw" : "4vh 4vw",
          background: "#171717",
          border: "1px solid #2b2b2b",
          borderRadius: "22px",
          zIndex: 120,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        {!isMobile && (
          <div
            style={{
              width: "320px",
              borderRight: "1px solid #2b2b2b",
              padding: "20px",
              background: "#111111",
              display: "grid",
              alignContent: "start",
              gap: "14px",
              overflowY: "auto",
            }}
          >
            {toolPanel}
            {bottomActionBox}
          </div>
        )}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            background: "#0f0f0f",
            overflowY: "auto",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            padding: isMobile ? "12px" : "20px",
          }}
        >
          {isMobile && toolPanel}

          <div
            style={{
              width: "100%",
              maxWidth: "900px",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              flex: "0 0 auto",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                background: "#0b0b0b",
                border: "1px solid #232323",
                borderRadius: "18px",
                padding: isMobile ? "8px" : "10px",
                overflow: "hidden",
              }}
            >
              <canvas
                ref={baseCanvasRef}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: "14px",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: isMobile ? "auto" : "18px",
                  bottom: isMobile ? "18px" : "auto",
                  left: "18px",
                  right: isMobile ? "18px" : "auto",
                  zIndex: 2,
                  background: "rgba(0,0,0,0.72)",
                  color: "#f2d370",
                  padding: "8px 12px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.12)",
                  pointerEvents: "none",
                  width: isMobile ? "calc(100% - 36px)" : "auto",
                  textAlign: isMobile ? "center" : "left",
                  whiteSpace: isMobile ? "nowrap" : "normal",
                }}
              >
                {editorMode === "auto"
                  ? "Click or tap clothing item to auto select"
                  : "Brush to add or remove areas"}
              </div>

              <canvas
                ref={overlayCanvasRef}
                onPointerDown={(event) => {
                  const point = getCanvasPoint(event);
                  if (!point) return;

                  if (editorMode === "auto") {
                    const labels = labelsRef.current;
                    const width = widthRef.current;
                    const height = heightRef.current;
                    if (!labels || !width || !height) return;

                    paintCircle(labels, width, height, point.x, point.y, brushSize, LABEL_FOREGROUND);
                    rebuildMask();
                    return;
                  }

                  setIsDrawing(true);
                  lastDrawPointRef.current = point;
                  applyBrushAtPoint(point.x, point.y);
                  scheduleMaskRebuild();
                }}
                onPointerMove={(event) => {
                  if (editorMode !== "touchup" || !isDrawing) return;
                  const point = getCanvasPoint(event);
                  if (!point) return;

                  if (lastDrawPointRef.current) {
                    applyBrushStroke(lastDrawPointRef.current, point);
                  } else {
                    applyBrushAtPoint(point.x, point.y);
                  }

                  lastDrawPointRef.current = point;
                  scheduleMaskRebuild();
                }}
                onPointerUp={() => {
                  setIsDrawing(false);
                  lastDrawPointRef.current = null;
                }}
                onPointerLeave={() => {
                  setIsDrawing(false);
                  lastDrawPointRef.current = null;
                }}
                style={{
                  position: "absolute",
                  inset: isMobile ? "8px" : "10px",
                  width: `calc(100% - ${isMobile ? 16 : 20}px)`,
                  height: `calc(100% - ${isMobile ? 16 : 20}px)`,
                  display: "block",
                  borderRadius: "14px",
                  cursor:
                    editorMode === "auto"
                      ? "pointer"
                      : brushMode === "add"
                      ? "copy"
                      : "not-allowed",
                  touchAction: "none",
                }}
              />
            </div>
          </div>

          {isMobile && bottomActionBox}
        </div>
      </div>
    </>
  );
}


