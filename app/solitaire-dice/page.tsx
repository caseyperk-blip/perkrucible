"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./dice.module.css";
import { DEFAULT_DICE_PROGRESS, DICE_SKINS, MAX_POSSIBLE_SCORE, readDiceProgress, saveDiceProgress, type DiceProgress, type DiceSkinId } from "./dice-progress";

const SCORE: Record<number, number> = { 2: 100, 3: 70, 4: 60, 5: 50, 6: 40, 7: 30, 8: 40, 9: 50, 10: 60, 11: 70, 12: 100 };
const BEST_KEY = "perkrucible:solitaire-dice:top-score:v1";
const CLOSE_INSTRUCTIONS_KEY = "perkrucible:solitaire-dice:close-instructions:v1";
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
type Turn = { dice: number[]; pairA: number; pairB: number; discarded: number; freeRide: boolean };

type V3 = [number, number, number];
type CubeFace = { normal: V3; right: V3; up: V3; value: number; shade: number };
type DieLayout = { x: number; y: number; size: number };
type PanelLayout = { x: number; y: number; width: number; height: number };
type OverlayPanel = "ledger" | "status" | "setup";
type PanelDimension = keyof PanelLayout;
type Layout = { dice: DieLayout[]; buttonSize: number; buttonX: number; buttonY: number; feltSize: number; feltWidth: number; feltX: number; feltY: number; ledger: PanelLayout; status: PanelLayout; setup: PanelLayout };
const LAYOUT_KEY = "perkrucible:solitaire-dice:layout:v2";
const DEFAULT_LAYOUT: Layout = { dice: [27.5, 43.4, 58.9, 74.2, 89.5].map(x => ({ x, y: 56, size: 14 })), buttonSize: 7.7, buttonX: 0, buttonY: 0, feltSize: 100, feltWidth: 100, feltX: 0, feltY: 0, ledger: { x: 4, y: 5, width: 25, height: 90 }, status: { x: 71, y: 5, width: 25, height: 90 }, setup: { x: 50, y: 51, width: 56, height: 32 } };
const PANEL_RANGE_CONTROLS: { dimension: PanelDimension; label: string; min: number; max: number }[] = [
  { dimension: "x", label: "Left / X", min: -25, max: 125 },
  { dimension: "y", label: "Top / Y", min: -25, max: 125 },
  { dimension: "width", label: "Width", min: 10, max: 80 },
  { dimension: "height", label: "Height", min: 20, max: 100 },
];
type PanelDrag = { panel: OverlayPanel; pointerId: number; startX: number; startY: number; originX: number; originY: number; stageWidth: number; stageHeight: number };
const RESTING_ANGLE: V3 = [0, 0, 0];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

function rotate(point: V3, angles: V3): V3 {
  const [x, y, z] = point;
  const cx = Math.cos(angles[0]), sx = Math.sin(angles[0]);
  const cy = Math.cos(angles[1]), sy = Math.sin(angles[1]);
  const cz = Math.cos(angles[2]), sz = Math.sin(angles[2]);
  const x1 = x, y1 = y * cx - z * sx, z1 = y * sx + z * cx;
  const x2 = x1 * cy + z1 * sy, y2 = y1, z2 = -x1 * sy + z1 * cy;
  return [x2 * cz - y2 * sz, x2 * sz + y2 * cz, z2];
}

function drawCube(canvas: HTMLCanvasElement, value: number, angles: V3, skin: DiceSkinId = "classic") {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = bounds.width, height = bounds.height;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const extent = Math.min(width, height) * .68;
  const camera = 3.6;
  const project = (local: V3): [number, number, number] => {
    const p = rotate(local, angles);
    const factor = camera / (camera - p[2]);
    return [width / 2 + p[0] * extent * factor, height / 2 - p[1] * extent * factor, p[2]];
  };
  const opposite = value === 1 ? 6 : 7 - value;
  const faces: CubeFace[] = [
    { normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0], value, shade: 1 },
    { normal: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0], value: opposite, shade: .58 },
    { normal: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0], value: 2, shade: .79 },
    { normal: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0], value: 5, shade: .72 },
    { normal: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1], value: 3, shade: .92 },
    { normal: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1], value: 4, shade: .55 },
  ];
  const visible = faces.map(face => ({ face, normal: rotate(face.normal, angles) }))
    .filter(item => item.normal[2] > 0.015)
    .sort((a, b) => a.normal[2] - b.normal[2]);
  for (const { face, normal } of visible) {
    const localPoint = (u: number, v: number): V3 => add(scale(face.normal, .5), add(scale(face.right, u), scale(face.up, v)));
    const faceCorners: [number, number][] = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
    const corners = faceCorners.map(([u,v]) => project(localPoint(u,v)));
    const light = Math.max(0, dot(normal, [-.35,.55,.75]));
    const brightness = Math.min(1, face.shade * (.75 + light * .32));
    const tone = Math.round(190 + brightness * 48);
    ctx.beginPath();
    const radius = extent * .055;
    for (let i = 0; i < corners.length; i++) {
      const previous = corners[(i + corners.length - 1) % corners.length];
      const current = corners[i];
      const next = corners[(i + 1) % corners.length];
      const before: [number, number] = [current[0] + (previous[0] - current[0]) * Math.min(radius / Math.hypot(previous[0]-current[0], previous[1]-current[1]), .22), current[1] + (previous[1] - current[1]) * Math.min(radius / Math.hypot(previous[0]-current[0], previous[1]-current[1]), .22)];
      const after: [number, number] = [current[0] + (next[0] - current[0]) * Math.min(radius / Math.hypot(next[0]-current[0], next[1]-current[1]), .22), current[1] + (next[1] - current[1]) * Math.min(radius / Math.hypot(next[0]-current[0], next[1]-current[1]), .22)];
      if (i === 0) ctx.moveTo(before[0], before[1]); else ctx.lineTo(before[0], before[1]);
      ctx.quadraticCurveTo(current[0], current[1], after[0], after[1]);
    }
    ctx.closePath();
    const faceGradient = ctx.createLinearGradient(corners[0][0], corners[0][1], corners[2][0], corners[2][1]);
    const palettes: Record<DiceSkinId, { top: string; mid: string; low: string; stroke: string; pip: string; sheen: string }> = {
      classic: { top: `rgb(${Math.min(255,tone+24)},${Math.min(255,Math.round(tone*.97+24))},${Math.min(255,Math.round(tone*.9+22))})`, mid: `rgb(${tone},${Math.round(tone*.97)},${Math.round(tone*.9)})`, low: `rgb(${Math.round(tone*.78)},${Math.round(tone*.75)},${Math.round(tone*.7)})`, stroke: "rgba(93,74,57,.84)", pip: "#292522", sheen: "rgba(255,255,255,.34)" },
      cream: { top: `rgb(${Math.min(255,tone+39)},${Math.min(255,tone+29)},${Math.min(255,tone+8)})`, mid: `rgb(${tone},${Math.round(tone*.93)},${Math.round(tone*.7)})`, low: `rgb(${Math.round(tone*.78)},${Math.round(tone*.68)},${Math.round(tone*.45)})`, stroke: "rgba(117,87,51,.9)", pip: "#352719", sheen: "rgba(255,244,216,.38)" },
      ruby: { top: `rgba(${Math.min(255,tone+46)},${Math.round(tone*.46)},${Math.round(tone*.5)},.93)`, mid: `rgba(${Math.round(tone*.78)},${Math.round(tone*.12)},${Math.round(tone*.18)},.9)`, low: `rgba(${Math.round(tone*.38)},${Math.round(tone*.06)},${Math.round(tone*.1)},.96)`, stroke: "rgba(255,155,143,.9)", pip: "#fff2e9", sheen: "rgba(255,225,212,.4)" },
      steel: { top: `rgb(${Math.min(255,tone+39)},${Math.min(255,tone+42)},${Math.min(255,tone+45)})`, mid: `rgb(${tone},${tone},${Math.min(255,tone+5)})`, low: `rgb(${Math.round(tone*.59)},${Math.round(tone*.62)},${Math.round(tone*.67)})`, stroke: "rgba(45,49,55,.95)", pip: "#17191c", sheen: "rgba(255,255,255,.55)" },
      gold: { top: `rgb(${Math.min(255,tone+48)},${Math.min(255,tone+29)},${Math.round(tone*.58)})`, mid: `rgb(${tone},${Math.round(tone*.72)},${Math.round(tone*.3)})`, low: `rgb(${Math.round(tone*.63)},${Math.round(tone*.42)},${Math.round(tone*.12)})`, stroke: "rgba(95,57,13,.95)", pip: "#301d08", sheen: "rgba(255,244,190,.5)" },
    };
    const palette = palettes[skin];
    faceGradient.addColorStop(0, palette.top);
    faceGradient.addColorStop(.58, palette.mid);
    faceGradient.addColorStop(1, palette.low);
    ctx.fillStyle = faceGradient; ctx.fill();
    ctx.strokeStyle = palette.stroke; ctx.lineWidth = 1.4; ctx.lineJoin = "round"; ctx.stroke();
    ctx.save(); ctx.clip();
    const sheen = ctx.createLinearGradient(corners[0][0], corners[0][1], corners[2][0], corners[2][1]);
    sheen.addColorStop(0, palette.sheen); sheen.addColorStop(.28, "rgba(255,255,255,.12)"); sheen.addColorStop(.62, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen; ctx.fill();
    const pipIndices = PIPS[face.value] ?? [];
    for (const pipIndex of pipIndices) {
      const col = pipIndex % 3, row = Math.floor(pipIndex / 3);
      const u = (col - 1) * .29, v = (1 - row) * .29;
      const center = project(localPoint(u, v));
      const radius = extent * .085;
      ctx.beginPath(); ctx.arc(center[0], center[1], radius, 0, Math.PI * 2); ctx.fillStyle = palette.pip; ctx.fill();
    }
    ctx.restore();
  }
}

function DieCanvas({ value, spinning, index, skin = "classic" }: { value: number; spinning: boolean; index: number; skin?: DiceSkinId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const duration = 1900 + index * 245;
    const delay = index * 72;
    const settled = RESTING_ANGLE;
    const paint = (angles: V3) => drawCube(canvas, valueRef.current, angles, skin);
    if (spinning) {
      const begin = performance.now() + delay;
      const animate = (now: number) => {
        if (now < begin) { paint(settled); frame = requestAnimationFrame(animate); return; }
        const p = Math.min(1, (now - begin) / duration);
        const eased = p < .2 ? .16 * (p / .2) ** 2 : p < .84 ? .16 + (p - .2) * ( .72 / .64) : .88 + .12 * (1 - ((1 - (p - .84) / .16) ** 2));
        paint([settled[0] + eased * Math.PI * 12, 0, 0]);
        if (p < 1) frame = requestAnimationFrame(animate);
        else paint(settled);
      };
      frame = requestAnimationFrame(animate);
    } else paint(settled);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => paint(settled)); observer.observe(canvas);
    }
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [spinning, index, skin]);
  useEffect(() => { if (!spinning && canvasRef.current) drawCube(canvasRef.current, value, RESTING_ANGLE, skin); }, [value, spinning, skin]);
  return <canvas ref={canvasRef} className={styles.dieCanvas} aria-hidden="true" />;
}

function Tally({ count }: { count: number }) {
  if (!count) return <span className={styles.emptyTally}>—</span>;
  return <span className={styles.tallyMarks} aria-label={`${count} tallies`}>
    {Array.from({ length: Math.ceil(count / 5) }, (_, group) => {
      const size = Math.min(5, count - group * 5);
      return <span className={`${styles.tallyGroup} ${size === 5 ? styles.tallyFive : ""}`} key={group}>
        {Array.from({ length: size === 5 ? 4 : size }, (_, i) => <i key={i} />)}
      </span>;
    })}
  </span>;
}

export default function SolitaireDicePage() {
  const [dice, setDice] = useState<number[] | null>(null);
  const [displayDice, setDisplayDice] = useState<number[]>([1, 2, 3, 4, 5]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false, false, false]);
  const [isRolling, setIsRolling] = useState(false);
  const [pairOne, setPairOne] = useState<number[]>([]);
  const [rejectIndex, setRejectIndex] = useState<number | null>(null);
  const [pairCounts, setPairCounts] = useState<Record<number, number>>({});
  const [rejectCounts, setRejectCounts] = useState<Record<number, number>>({});
  const [rejectNumbers, setRejectNumbers] = useState<number[]>([]);
  const [history, setHistory] = useState<Turn[]>([]);
  const [instructionsDismissed, setInstructionsDismissed] = useState(false);
  const [instructionPromptHandled, setInstructionPromptHandled] = useState(false);
  const [askToCloseInstructions, setAskToCloseInstructions] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [topScore, setTopScore] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [diceProgress, setDiceProgress] = useState<DiceProgress>(DEFAULT_DICE_PROGRESS);
  const [showDiceVault, setShowDiceVault] = useState(false);
  const [freeRidesThisGame, setFreeRidesThisGame] = useState(0);
  const [newlyUnlockedDice, setNewlyUnlockedDice] = useState<DiceSkinId[]>([]);
  const [showUnlockNotice, setShowUnlockNotice] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stageRef = useRef<HTMLElement | null>(null);
  const panelDragRef = useRef<PanelDrag | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    const progress = readDiceProgress();
    setDiceProgress(progress);
    if (window.location.hash === "#dice-vault") setShowDiceVault(true);
    try {
      const saved = window.localStorage.getItem(BEST_KEY);
      const best = saved !== null && Number.isFinite(Number(saved)) ? Number(saved) : progress.bestScore;
      if (best !== null) setTopScore(best);
      if (window.localStorage.getItem(CLOSE_INSTRUCTIONS_KEY) === "yes") setInstructionsDismissed(true);
    } catch { /* Local score storage may be unavailable in private browsing. */ }
    try {
      const savedLayout = window.localStorage.getItem(LAYOUT_KEY);
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout) as Partial<Layout>;
        setLayout({
          ...DEFAULT_LAYOUT,
          ...parsed,
          dice: Array.isArray(parsed.dice) && parsed.dice.length === 5 ? parsed.dice : DEFAULT_LAYOUT.dice,
          ledger: parsed.ledger && typeof parsed.ledger === "object" ? { ...DEFAULT_LAYOUT.ledger, ...parsed.ledger } : DEFAULT_LAYOUT.ledger,
          status: parsed.status && typeof parsed.status === "object" ? { ...DEFAULT_LAYOUT.status, ...parsed.status } : DEFAULT_LAYOUT.status,
          setup: parsed.setup && typeof parsed.setup === "object" ? { ...DEFAULT_LAYOUT.setup, ...parsed.setup } : DEFAULT_LAYOUT.setup,
        });
      }
    } catch { /* Use defaults when saved layout is unavailable. */ }
    return () => { timersRef.current.forEach(clearTimeout); audioRef.current?.close(); };
  }, []);

  useEffect(() => {
    if (!showDiceVault) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setShowDiceVault(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showDiceVault]);

  const playSound = useCallback((kind: "roll" | "stop" | "click" | "button") => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioRef.current ?? new Ctx(); audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      if (kind === "roll") {
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .22), ctx.sampleRate);
        const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const noise = ctx.createBufferSource(); noise.buffer = buffer;
        const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(1500, now); filter.frequency.exponentialRampToValueAtTime(240, now + .22);
        const gain = ctx.createGain(); gain.gain.setValueAtTime(.24, now); gain.gain.exponentialRampToValueAtTime(.001, now + .22);
        noise.connect(filter).connect(gain).connect(ctx.destination); noise.start(now);
      } else if (kind === "click" || kind === "button") {
        const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .1), ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * .12));
        const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = kind === "button" ? 620 : 380;
        const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(kind === "button" ? .32 : .14, now); noiseGain.gain.exponentialRampToValueAtTime(.001, now + (kind === "button" ? .085 : .045));
        noise.connect(filter).connect(noiseGain).connect(ctx.destination); noise.start(now);
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "triangle"; osc.frequency.setValueAtTime(kind === "button" ? 92 : 72, now); osc.frequency.exponentialRampToValueAtTime(kind === "button" ? 32 : 38, now + (kind === "button" ? .12 : .055));
        gain.gain.setValueAtTime(kind === "button" ? .38 : .2, now); gain.gain.exponentialRampToValueAtTime(.001, now + (kind === "button" ? .14 : .065));
        osc.connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now + (kind === "button" ? .15 : .07));
      } else {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "triangle"; osc.frequency.setValueAtTime(210, now); osc.frequency.exponentialRampToValueAtTime(75, now + .065);
        gain.gain.setValueAtTime(.22, now); gain.gain.exponentialRampToValueAtTime(.001, now + .075);
        osc.connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now + .08);
      }
    } catch { /* Sound is an enhancement; rolling remains playable without it. */ }
  }, [soundOn]);

  useEffect(() => {
    if (!isRolling || !dice) return;
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const starts = Date.now();
    const durations = dice.map((_, i) => 1900 + i * 245 + i * 72);
    const clickLoop = setInterval(() => playSound("click"), 84);
    const cycle = (index: number) => {
      if (cancelled) return;
      const elapsed = Date.now() - starts;
      const remaining = durations[index] - elapsed;
      if (remaining <= 0) {
        setDisplayDice(current => current.map((v, j) => j === index ? dice[index] : v));
        setSpinning(current => current.map((v, j) => j === index ? false : v));
        playSound("stop");
        if (index === dice.length - 1) setIsRolling(false);
        return;
      }
      if (elapsed >= durations[index] * .78) {
        setDisplayDice(current => current.map((v, j) => j === index ? dice[index] : v));
        const timer = setTimeout(() => cycle(index), remaining);
        timeouts.push(timer); timersRef.current.push(timer);
        return;
      }
      setDisplayDice(current => current.map((v, j) => j === index ? (v % 6) + 1 : v));
      const progress = elapsed / durations[index];
      const delay = progress < .58 ? 58 : progress < .82 ? 82 : 112 + Math.floor((progress - .82) * 420);
      const timer = setTimeout(() => cycle(index), Math.min(delay, remaining));
      timeouts.push(timer); timersRef.current.push(timer);
    };
    playSound("roll");
    dice.forEach((_, index) => { const timer = setTimeout(() => cycle(index), index * 72); timeouts.push(timer); timersRef.current.push(timer); });
    return () => { cancelled = true; clearInterval(clickLoop); timeouts.forEach(clearTimeout); };
  }, [isRolling, dice, playSound]);

  const rollDice = () => {
    if (gameOver || isRolling) return;
    const beginningNextTurn = Boolean(dice);
    if (dice) {
      if (pairOne.length !== 2 || rejectIndex === null) return;
      const turnEndedGame = markTurn(rejectIndex);
      if (turnEndedGame) return;
    }
    const next = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
    playSound("button");
    setDice(next); setPairOne([]); setRejectIndex(null); setSpinning([true, true, true, true, true]); setIsRolling(true);
    if (beginningNextTurn && history.length === 0) setAskToCloseInstructions(true);
  };

  const togglePair = (index: number) => {
    if (isRolling || !dice || rejectIndex !== null) return;
    setPairOne(current => current.includes(index) ? current.filter(i => i !== index) : current.length < 2 ? [...current, index] : current);
  };

  const scoreFor = (counts: Record<number, number>) => Object.entries(counts).reduce((sum, [raw, count]) => {
    const value = Number(raw);
    const rowScore = count === 0 ? 0 : count < 5 ? -200 : count === 5 ? 0 : (count - 5) * SCORE[value];
    return sum + rowScore;
  }, 0);

  function markTurn(rejectedIndex: number): boolean {
    if (!dice || isRolling || pairOne.length !== 2) return false;
    const selectedPair = pairOne.map(i => dice[i]);
    const remaining = dice.filter((_, i) => !pairOne.includes(i) && i !== rejectedIndex);
    const pairB = remaining.reduce((sum, value) => sum + value, 0);
    const chosenReject = dice[rejectedIndex];
    const unpaired = dice.filter((_, i) => !pairOne.includes(i));
    const freeRide = rejectNumbers.length >= 3 && !unpaired.some(value => rejectNumbers.includes(value));
    const nextPairs = { ...pairCounts };
    const a = selectedPair[0] + selectedPair[1]; nextPairs[a] = (nextPairs[a] ?? 0) + 1;
    nextPairs[pairB] = (nextPairs[pairB] ?? 0) + 1;
    // Free rides discard a die without creating or advancing a fourth throwaway value.
    const nextRejects = freeRide ? rejectCounts : { ...rejectCounts, [chosenReject]: (rejectCounts[chosenReject] ?? 0) + 1 };
    const ridesAfterTurn = freeRidesThisGame + (freeRide ? 1 : 0);
    const nextScore = scoreFor(nextPairs);
    setPairCounts(nextPairs); setRejectCounts(nextRejects); setScore(nextScore);
    if (!freeRide) setRejectNumbers(current => current.includes(chosenReject) ? current : [...current, chosenReject]);
    setHistory(current => [{ dice, pairA: a, pairB, discarded: chosenReject, freeRide }, ...current]);
    setFreeRidesThisGame(ridesAfterTurn);
    if (!freeRide && nextRejects[chosenReject] >= 8) {
      setGameOver(true);
      const completedGames = diceProgress.completedGames + 1;
      const bestScore = diceProgress.bestScore === null ? nextScore : Math.max(diceProgress.bestScore, nextScore);
      const unlocked = new Set<DiceSkinId>(diceProgress.unlocked);
      if (completedGames >= 1) unlocked.add("cream");
      if (completedGames >= 5) unlocked.add("ruby");
      if (ridesAfterTurn >= 3) unlocked.add("steel");
      if (nextScore >= MAX_POSSIBLE_SCORE) unlocked.add("gold");
      setNewlyUnlockedDice([...unlocked].filter(id => !diceProgress.unlocked.includes(id)));
      const updatedProgress: DiceProgress = { completedGames, unlocked: [...unlocked], selected: diceProgress.selected, bestScore };
      setDiceProgress(updatedProgress);
      saveDiceProgress(updatedProgress);
      setTopScore(current => {
        const best = current === null ? nextScore : Math.max(current, nextScore);
        try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* Keep score in session if storage is disabled. */ }
        return best;
      });
      return true;
    }
    return false;
  }

  const selectReject = (index: number) => {
    if (isRolling || !dice || pairOne.length !== 2) return;
    const values = dice.filter((_, i) => !pairOne.includes(i));
    const selectedValue = dice[index];
    const isFreeRide = rejectNumbers.length >= 3 && !values.some(v => rejectNumbers.includes(v));
    if (rejectNumbers.length >= 3 && !isFreeRide && !rejectNumbers.includes(selectedValue)) return;
    setRejectIndex(index);
  };

  // Choose the first pair, choose a throwaway, then press the button to score and roll again.
  const onDieClick = (index: number) => {
    if (isRolling || !dice || gameOver) return;
    if (pairOne.includes(index)) {
      setPairOne(current => current.filter(selected => selected !== index));
      setRejectIndex(null);
      return;
    }
    if (rejectIndex === index) { setRejectIndex(null); return; }
    if (pairOne.length < 2) { togglePair(index); return; }
    if (pairOne.length === 2) selectReject(index);
  };

  const newGame = () => {
    timersRef.current.forEach(clearTimeout); timersRef.current = [];
    setDice(null); setDisplayDice([1, 2, 3, 4, 5]); setSpinning([false, false, false, false, false]); setIsRolling(false);
    setPairOne([]); setRejectIndex(null); setPairCounts({}); setRejectCounts({}); setRejectNumbers([]); setHistory([]); setScore(0); setGameOver(false);
    setFreeRidesThisGame(0);
    setInstructionPromptHandled(false); setAskToCloseInstructions(false);
  };

  const playAgain = () => {
    newGame();
    if (newlyUnlockedDice.length) setShowUnlockNotice(true);
  };

  const totalTurns = Object.values(rejectCounts).reduce((a, b) => a + b, 0);
  const rejectCandidates = dice && pairOne.length === 2 ? dice.map((value, index) => ({ value, index })).filter(({ index }) => !pairOne.includes(index)) : [];
  const hasRequiredReject = rejectNumbers.length < 3 || rejectCandidates.some(d => rejectNumbers.includes(d.value));
  const machineStyle = { "--button-size": `${layout.buttonSize}%`, "--button-x": `${layout.buttonX}%`, "--button-y": `${layout.buttonY}%`, "--felt-size": `${layout.feltSize}%`, "--felt-width": `${layout.feltWidth}%`, "--felt-x": `${layout.feltX}%`, "--felt-y": `${layout.feltY}%` } as CSSProperties;
  const panelStyle = (panel: PanelLayout) => ({ "--panel-x": `${panel.x}%`, "--panel-y": `${panel.y}%`, "--panel-width": `${panel.width}%`, "--panel-height": `${panel.height}%`, "--mobile-panel-x": `${panel.x === 4 && panel.width === 25 ? 2 : panel.x === 71 && panel.width === 25 ? 52 : panel.x}%`, "--mobile-panel-y": `${panel.y === 5 && panel.height === 90 ? 2 : panel.y}%`, "--mobile-panel-width": `${panel.width === 25 && panel.height === 90 ? 46 : panel.width}%`, "--mobile-panel-height": `${panel.width === 25 && panel.height === 90 ? 62 : panel.height}%`, "--mobile-setup-x": `${layout.setup.x}%`, "--mobile-setup-y": `${layout.setup.y === 51 ? 78 : layout.setup.y}%`, "--mobile-setup-width": `${layout.setup.width === 56 ? 92 : layout.setup.width}%`, "--mobile-setup-height": `${layout.setup.height === 32 ? 25 : layout.setup.height}%` }) as CSSProperties;
  const saveLayout = (next: Layout) => {
    layoutRef.current = next;
    setLayout(next);
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); } catch { /* Keep panel placement for this visit if browser storage is unavailable. */ }
  };
  const updatePanel = (panel: OverlayPanel, dimension: PanelDimension, value: number, persist = true) => {
    const current = layoutRef.current;
    const next = { ...current, [panel]: { ...current[panel], [dimension]: value } };
    layoutRef.current = next;
    setLayout(next);
    if (persist) {
      try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); } catch { /* Keep panel placement for this visit if browser storage is unavailable. */ }
    }
  };
  const beginPanelDrag = (panel: OverlayPanel) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button,input,a,summary")) return;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    panelDragRef.current = { panel, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: layoutRef.current[panel].x, originY: layoutRef.current[panel].y, stageWidth: stage.width, stageHeight: stage.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePanelDrag = (panel: OverlayPanel) => (event: ReactPointerEvent<HTMLElement>) => {
    const drag = panelDragRef.current;
    if (!drag || drag.panel !== panel || drag.pointerId !== event.pointerId) return;
    updatePanel(panel, "x", Math.max(-25, Math.min(125, drag.originX + (event.clientX - drag.startX) / drag.stageWidth * 100)), false);
    updatePanel(panel, "y", Math.max(-25, Math.min(125, drag.originY + (event.clientY - drag.startY) / drag.stageHeight * 100)), false);
  };
  const endPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (panelDragRef.current?.pointerId !== event.pointerId) return;
    panelDragRef.current = null;
    saveLayout(layoutRef.current);
  };
  const resetPanelLayout = () => saveLayout({ ...layoutRef.current, ledger: DEFAULT_LAYOUT.ledger, status: DEFAULT_LAYOUT.status, setup: DEFAULT_LAYOUT.setup });

  return <main className={styles.page}>
    <h1 className="visually-hidden">Solitaire Dice</h1>

    <section ref={stageRef} className={styles.game} aria-label="Solitaire Dice game">
      <div className={styles.scoreboard}>
        <section className={styles.pairSection} style={panelStyle(layout.ledger)} aria-label="Pair score ledger" onPointerDown={beginPanelDrag("ledger")} onPointerMove={movePanelDrag("ledger")} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}>
          <Image className={styles.ledgerFrame} src="/images/ornate-score-ledger-frame.png" alt="" fill sizes="(min-width: 1100px) 25vw, 0px" />
          <h2>PAIR TOTALS <span>· {totalTurns} TURNS</span></h2>
          <div className={styles.pairContent}><div className={styles.pairGrid}>{Object.keys(SCORE).map(Number).sort((a, b) => a - b).map(n => {
            const count = pairCounts[n] ?? 0;
            const rowScore = count === 0 ? 0 : count < 5 ? -200 : count === 5 ? 0 : (count - 5) * SCORE[n];
            return <div className={`${styles.pairCell} ${rowScore < 0 ? styles.negative : rowScore > 0 ? styles.positive : ""}`} key={n}>
              <b>{n}</b><span className={styles.pointValue}>({SCORE[n]})</span><Tally count={count} /><span className={styles.scoreValue}>{rowScore > 0 ? `+${rowScore}` : rowScore}</span>
            </div>;
          })}</div></div>
        </section>
        <section className={styles.statusPanel} style={panelStyle(layout.status)} aria-label="Game status" onPointerDown={beginPanelDrag("status")} onPointerMove={movePanelDrag("status")} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}>
          <Image className={styles.statusFrame} src="/images/ornate-game-status-frame.png" alt="" fill sizes="(min-width: 1100px) 25vw, 0px" />
          <div className={styles.statusContent}>
            <div className={styles.turnCount}><span>TURNS</span><strong>{totalTurns}</strong></div>
            <div className={styles.scoreStack}>
              <div className={styles.total}><span>CURRENT SCORE</span><strong>{score}</strong></div>
              <div className={styles.total}><span>BEST SCORE</span><strong className={styles.bestScore}>{topScore ?? "—"}</strong></div>
              <button className={styles.newGame} onClick={newGame}>NEW GAME</button>
              <a className={styles.utilityButton} href="/solitaire-dice/how-to">HOW TO PLAY</a>
              <button id="dice-vault" className={styles.utilityButton} onClick={() => setShowDiceVault(true)}>DICE VAULT</button>
            </div>
          </div>
        </section>
      </div>

      <details className={styles.layoutEditor}>
        <summary>ARRANGE GAME</summary>
        {(["ledger", "status", "setup"] as const).map(panel => <fieldset key={panel}>
          <legend>{panel === "ledger" ? "SCORE LEDGER" : panel === "status" ? "GAME STATUS" : "DICE SETUP"}</legend>
          {PANEL_RANGE_CONTROLS.map(control => <label key={control.dimension}>
            <span>{control.label}</span><output>{Math.round(layout[panel][control.dimension])}%</output>
            <input type="range" min={control.min} max={control.max} value={layout[panel][control.dimension]} onChange={event => updatePanel(panel, control.dimension, Number(event.currentTarget.value))} />
          </label>)}
        </fieldset>)}
        <button type="button" onClick={resetPanelLayout}>RESET FRAME PLACEMENT</button>
      </details>

      <div className={styles.playArea} style={panelStyle(layout.setup)} onPointerDown={beginPanelDrag("setup")} onPointerMove={movePanelDrag("setup")} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}>
        <button className={styles.soundToggle} onClick={() => setSoundOn(v => !v)} aria-label={soundOn ? "Mute sound" : "Unmute sound"} aria-pressed={soundOn} title={soundOn ? "Mute sound" : "Unmute sound"}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10v4h4l5 4V6l-5 4H4z" />
            {soundOn ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></> : <path d="m17 9 5 6m0-6-5 6" />}
          </svg>
        </button>
        <div className={styles.machine} style={machineStyle}>
          <div className={styles.machineLight} aria-hidden="true" />
          <Image className={styles.feltLayer} src="/images/solitaire-dice-felt-red.png" alt="" fill sizes="(max-width: 1100px) 100vw, 1060px" unoptimized preload />
          <div className={styles.diceTray} aria-label="Five dice in the framed felt tray">
            {displayDice.map((value, index) => <button key={index} type="button" className={`${styles.die} ${spinning[index] ? styles.spinning : dice && !spinning[index] ? styles.settled : ""} ${pairOne.includes(index) ? styles.pairSelected : ""} ${pairOne.length === 2 && rejectIndex !== null && !pairOne.includes(index) && index !== rejectIndex ? styles.secondPair : ""} ${rejectIndex === index ? styles.rejected : ""}`}
              style={{ left: `${layout.dice[index]?.x ?? DEFAULT_LAYOUT.dice[index].x}%`, top: `${layout.dice[index]?.y ?? 56}%`, width: `${layout.dice[index]?.size ?? 14}%` }}
              onClick={() => onDieClick(index)} disabled={!dice || isRolling || gameOver} aria-label={`Die ${index + 1}: ${value}${pairOne.includes(index) ? ", selected for pair" : ""}`}>
              <DieCanvas value={value} spinning={spinning[index]} index={index} skin={diceProgress.selected} />
            </button>)}
          </div>
          <button className={`${styles.rollButton} ${isRolling ? styles.buttonPressed : ""}`} onClick={rollDice} disabled={isRolling || gameOver || Boolean(dice && (pairOne.length !== 2 || rejectIndex === null))} aria-label={dice ? "Score the turn and roll again" : "Press the red button to roll the dice"}>
            <span className={styles.buttonCap} aria-hidden="true" />
          </button>
          <Image className={styles.frameLayer} src="/images/solitaire-dice-frame.png" alt="" fill sizes="(max-width: 1100px) 100vw, 1060px" priority />
        </div>
        <div className={styles.instructions} aria-live="polite">
          {askToCloseInstructions && !instructionPromptHandled && !instructionsDismissed && !isRolling ? <div className={styles.instructionPrompt}>
            <p>Would you like to close the instructions from now on?</p>
            <button onClick={() => { setInstructionsDismissed(true); setInstructionPromptHandled(true); try { window.localStorage.setItem(CLOSE_INSTRUCTIONS_KEY, "yes"); } catch { /* Keep the choice for this session. */ } }}>CLOSE FROM NOW ON</button>
            <button onClick={() => setInstructionPromptHandled(true)}>KEEP THEM</button>
          </div> : !instructionsDismissed && <p>{isRolling ? "The dice are tumbling…" : !dice ? "Press the button to roll five dice." : pairOne.length < 2 ? `Choose ${2 - pairOne.length} ${pairOne.length === 1 ? "more die" : "dice"} to make your first pair.` : rejectIndex === null ? (hasRequiredReject ? "Choose a throwaway die." : "Free ride: choose any remaining die to set aside.") : "The two glowing dice make your second pair. Press the red button to score and roll again."}</p>}
        </div>
      </div>
    </section>

    {showDiceVault && <div className={styles.vaultBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setShowDiceVault(false); }}>
      <section className={styles.vaultDialog} role="dialog" aria-modal="true" aria-labelledby="vault-title">
        <div className={styles.vaultHeader}><div><span>DICE COLLECTION</span><h2 id="vault-title">The Dice Vault</h2><p>{diceProgress.completedGames} full {diceProgress.completedGames === 1 ? "game" : "games"} completed</p></div><button className={styles.vaultClose} onClick={() => setShowDiceVault(false)} aria-label="Close dice vault">×</button></div>
        <div className={styles.vaultList}>{DICE_SKINS.filter(skin => !skin.secret || diceProgress.unlocked.includes(skin.id)).map((skin, index) => {
          const unlocked = diceProgress.unlocked.includes(skin.id);
          const selected = diceProgress.selected === skin.id;
          return <article key={skin.id} className={`${styles.skinCard} ${selected ? styles.skinSelected : ""}`}>
            <div className={styles.skinPreview}>{unlocked ? <DieCanvas value={5} spinning={false} index={index} skin={skin.id} /> : <span>?</span>}</div>
            <div className={styles.skinInfo}><h3>{skin.secret && !unlocked ? "???" : skin.name}</h3><p>{unlocked ? skin.challenge ?? "Reach the highest possible score." : skin.secret ? "A hidden challenge." : skin.challenge}</p></div>
            {unlocked ? <button className={styles.skinAction} aria-pressed={selected} onClick={() => { const updated = { ...diceProgress, selected: skin.id }; setDiceProgress(updated); saveDiceProgress(updated); }}>{selected ? "EQUIPPED" : "EQUIP"}</button> : <span className={styles.skinLocked}>LOCKED</span>}
          </article>;
        })}</div>
      </section>
    </div>}

    {gameOver && <div className={styles.result} role="dialog" aria-modal="true"><p>GAME OVER · A THROWAWAY REACHED EIGHT</p><strong>{score} POINTS</strong><span>{topScore === score ? "A new local best score." : `Your best score on this device is ${topScore}.`}</span><button onClick={playAgain}>PLAY AGAIN</button></div>}
    {showUnlockNotice && <div className={styles.result} role="dialog" aria-modal="true" aria-labelledby="unlock-title"><p>NEW DICE UNLOCKED</p><h2 id="unlock-title">You unlocked…</h2><div className={styles.unlockCards}>{newlyUnlockedDice.map((skinId,index) => {
      const skin = DICE_SKINS.find(item => item.id === skinId)!;
      return <div className={styles.unlockCard} key={skinId}><div><DieCanvas value={5} spinning={false} index={index} skin={skinId} /></div><strong>{skin.name}</strong></div>;
    })}</div><button onClick={() => setShowUnlockNotice(false)}>CONTINUE TO NEW GAME</button></div>}
  </main>;
}
