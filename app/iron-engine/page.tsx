
"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./iron.module.css";

type TabKey = "settings" | "routines" | "tracker";
type TrackerKind = "checklist" | "graph";
type GraphStyle = "bar" | "line";
type GraphPeriod = "day" | "month" | "year";
type WeightUnit = "lbs" | "kg";

type Workout = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  done: boolean;
};

type DayItem = {
  id: string;
  name: string;
  workouts: Workout[];
  completed: boolean;
  open: boolean;
};

type RoutineProgram = {
  id: string;
  name: string;
  days: DayItem[];
};

type ChecklistTask = {
  id: string;
  text: string;
  done: boolean;
};

type GraphPoint = {
  id: string;
  label: string;
  value: number;
};

type TrackerItem = {
  id: string;
  name: string;
  trackerKind: TrackerKind;
  open: boolean;
  checklistTasks: ChecklistTask[];
  graphStyle?: GraphStyle;
  graphPeriod?: GraphPeriod;
  graphPoints: GraphPoint[];
  completedCount: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xIsDate?: boolean;
  dataExpanded?: boolean;
};

type AppState = {
  activeTab: TabKey;
  routinePrograms: RoutineProgram[];
  pinnedProgramId: string | null;
  selectedProgramId: string | null;
  pinnedTrackerId: string | null;
  trackers: TrackerItem[];
  weightUnit: WeightUnit;
};

const STORAGE_KEY = "iron-engine-state-v9";
const DEFAULT_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TITLE_DESKTOP_WIDTH = 9077;
const TITLE_DESKTOP_OFFSET_Y = 493;
const TITLE_MOBILE_WIDTH = 900;
const TITLE_MOBILE_OFFSET_Y = 200;
const APP_DESKTOP_OFFSET_Y = -1090;
const APP_MOBILE_OFFSET_Y = -395;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildDefaultDays(): DayItem[] {
  return DEFAULT_DAY_NAMES.map((name) => ({
    id: uid(),
    name,
    workouts: [],
    completed: false,
    open: false,
  }));
}

function buildProgram(name: string): RoutineProgram {
  return { id: uid(), name, days: buildDefaultDays() };
}

function buildDefaultState(): AppState {
  const first = buildProgram("Routine 1");
  return {
    activeTab: "routines",
    routinePrograms: [first],
    pinnedProgramId: first.id,
    selectedProgramId: first.id,
    pinnedTrackerId: null,
    trackers: [],
    weightUnit: "lbs",
  };
}

function parseDateLabel(label: string): Date | null {
  const date = new Date(label);
  return Number.isNaN(date.getTime()) ? null : date;
}

function aggregateGraphPoints(points: GraphPoint[], period: GraphPeriod, xIsDate?: boolean): GraphPoint[] {
  if (!xIsDate || period === "day") return points;
  const buckets = new Map<string, { label: string; sum: number; count: number }>();

  for (const point of points) {
    const date = parseDateLabel(point.label);
    if (!date) continue;

    let key = "";
    let label = "";
    if (period === "month") {
      key = `${date.getFullYear()}-${date.getMonth()}`;
      label = date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    } else {
      key = `${date.getFullYear()}`;
      label = `${date.getFullYear()}`;
    }

    const current = buckets.get(key);
    if (current) {
      current.sum += point.value;
      current.count += 1;
    } else {
      buckets.set(key, { label, sum: point.value, count: 1 });
    }
  }

  return Array.from(buckets.entries()).map(([key, bucket]) => ({
    id: key,
    label: bucket.label,
    value: Number((bucket.sum / bucket.count).toFixed(2)),
  }));
}

function updateDayCompletion(day: DayItem): DayItem {
  const allDone = day.workouts.length > 0 && day.workouts.every((workout) => workout.done);
  return {
    ...day,
    completed: allDone,
    open: allDone ? false : day.open,
  };
}

function graphSelectionKey(point: GraphPoint, period: GraphPeriod, xIsDate?: boolean): string {
  if (!xIsDate || period === "day") return point.id;
  const date = parseDateLabel(point.label);
  if (!date) return point.id;
  if (period === "month") return `${date.getFullYear()}-${date.getMonth()}`;
  return `${date.getFullYear()}`;
}

function rowMatchesSelection(point: GraphPoint, selectedKey: string | null, period: GraphPeriod, xIsDate?: boolean): boolean {
  if (!selectedKey) return false;
  return graphSelectionKey(point, period, xIsDate) === selectedKey;
}

function GraphPreview({
  style,
  points,
  period,
  xAxisLabel,
  yAxisLabel,
  xIsDate,
  onTickSelect,
}: {
  style: GraphStyle;
  points: GraphPoint[];
  period: GraphPeriod;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xIsDate?: boolean;
  onTickSelect: (selectionKey: string) => void;
}) {
  const aggregated = aggregateGraphPoints(points, period, xIsDate);
  const renderPoints = aggregated;
  const maxValue = Math.max(...aggregated.map((point) => point.value), 1);

  const viewWidth = 460;
  const viewHeight = 250;
  const chartLeft = 70;
  const chartRight = 18;
  const chartTop = 24;
  const chartBottom = 66;
  const chartWidth = viewWidth - chartLeft - chartRight;
  const chartHeight = viewHeight - chartTop - chartBottom;

  const mapped = renderPoints.map((point, index) => {
    const x =
      renderPoints.length === 1
        ? chartLeft + chartWidth / 2
        : chartLeft + (index / Math.max(renderPoints.length - 1, 1)) * chartWidth;
    const y = chartTop + chartHeight - (point.value / maxValue) * chartHeight;
    return { ...point, x, y };
  });

  const linePath = mapped.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className={styles.graphShell}>

      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className={styles.graphSvg} role="img" aria-label={`${style} graph`}>
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = chartTop + (tick / 4) * chartHeight;
          const tickValue = Math.round(maxValue - (tick / 4) * maxValue);
          return (
            <g key={tick}>
              <line x1={chartLeft} y1={y} x2={viewWidth - chartRight} y2={y} className={styles.graphGridLine} />
              <text x={36} y={y + 4} className={styles.graphAxisText}>{tickValue}</text>
            </g>
          );
        })}

        <line x1={chartLeft} y1={chartTop + chartHeight} x2={viewWidth - chartRight} y2={chartTop + chartHeight} className={styles.graphAxis} />
        <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartTop + chartHeight} className={styles.graphAxis} />

        {style === "bar" &&
          mapped.map((point, index) => {
            const rawWidth = chartWidth / Math.max(mapped.length, 1) * 0.55;
            const barWidth = Math.max(16, Math.min(34, rawWidth));
            const baseX =
              mapped.length === 1
                ? chartLeft + chartWidth / 2
                : chartLeft + (index / Math.max(mapped.length - 1, 1)) * chartWidth;
            const barX = Math.max(chartLeft, Math.min(viewWidth - chartRight - barWidth, baseX - barWidth / 2));
            const barY = point.y;
            const barHeight = chartTop + chartHeight - point.y;

            return (
              <g key={point.id}>
                <rect x={barX} y={barY} width={barWidth} height={barHeight} rx={10} className={styles.graphBar} />
                <text x={barX + barWidth / 2} y={barY - 8} textAnchor="middle" className={styles.graphValueText}>{point.value}</text>
                <circle
                  cx={barX + barWidth / 2}
                  cy={chartTop + chartHeight}
                  r={7}
                  className={styles.graphTickPoint}
                  onClick={() => onTickSelect(point.id)}
                >
                  <title>{point.label}</title>
                </circle>
              </g>
            );
          })}

        {style === "line" && mapped.length > 0 && (
          <>
            <path d={linePath} className={styles.graphLinePath} />
            {mapped.map((point) => (
              <g key={point.id}>
                <circle cx={point.x} cy={point.y} r={6} className={styles.graphPoint}>
                  <title>{point.label}</title>
                </circle>
                <text x={point.x} y={point.y - 10} textAnchor="middle" className={styles.graphValueText}>{point.value}</text>
                <circle
                  cx={point.x}
                  cy={chartTop + chartHeight}
                  r={7}
                  className={styles.graphTickPoint}
                  onClick={() => onTickSelect(point.id)}
                >
                  <title>{point.label}</title>
                </circle>
              </g>
            ))}
          </>
        )}

        <text x={viewWidth / 2} y={viewHeight - 8} textAnchor="middle" className={styles.graphAxisLabel}>
          {xAxisLabel || "X Axis"}
        </text>
        <text
          x={12}
          y={viewHeight / 2}
          textAnchor="middle"
          className={styles.graphAxisLabel}
          transform={`rotate(-90 12 ${viewHeight / 2})`}
        >
          {yAxisLabel || "Y Axis"}
        </text>
      </svg>
    </div>
  );
}

export default function IronEnginePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tab, setTab] = useState<TabKey>("routines");
  const [routinePrograms, setRoutinePrograms] = useState<RoutineProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [pinnedProgramId, setPinnedProgramId] = useState<string | null>(null);
  const [pinnedTrackerId, setPinnedTrackerId] = useState<string | null>(null);
  const [trackers, setTrackers] = useState<TrackerItem[]>([]);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");
  const [hydrated, setHydrated] = useState(false);
  const [resettingProgramIds, setResettingProgramIds] = useState<string[]>([]);
  const [settingsMenu, setSettingsMenu] = useState<null | { type: "program" | "day" | "workout" | "tracker" | "task"; programId?: string; dayId?: string; workoutId?: string; trackerId?: string; taskId?: string; currentText?: string }>(null);

  const [workoutModalDayId, setWorkoutModalDayId] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<{ programId: string; dayId: string; workoutId: string } | null>(null);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutSets, setWorkoutSets] = useState("");
  const [workoutReps, setWorkoutReps] = useState("");
  const [workoutWeight, setWorkoutWeight] = useState("");

  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programNameDraft, setProgramNameDraft] = useState("");

  const [editDayId, setEditDayId] = useState<string | null>(null);
  const [editDayName, setEditDayName] = useState("");

  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [trackerName, setTrackerName] = useState("");
  const [trackerKind, setTrackerKind] = useState<TrackerKind>("checklist");
  const [graphStyle, setGraphStyle] = useState<GraphStyle>("line");
  const [graphXAxisLabel, setGraphXAxisLabel] = useState("");
  const [graphYAxisLabel, setGraphYAxisLabel] = useState("");
  const [graphXIsDate, setGraphXIsDate] = useState(false);
  const [graphPointLabel, setGraphPointLabel] = useState("");
  const [graphValue, setGraphValue] = useState("");

  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, string>>({});
  const [checklistModalTrackerId, setChecklistModalTrackerId] = useState<string | null>(null);
  const [checklistTaskInput, setChecklistTaskInput] = useState("");
  const [graphDrafts, setGraphDrafts] = useState<Record<string, { label: string; value: string }>>({});
  const [graphDataModalTrackerId, setGraphDataModalTrackerId] = useState<string | null>(null);
  const [graphTimeframeModalTrackerId, setGraphTimeframeModalTrackerId] = useState<string | null>(null);
  const [graphSelectedKey, setGraphSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const fallback = buildDefaultState();
      if (!raw) {
        setTab(fallback.activeTab);
        setRoutinePrograms(fallback.routinePrograms);
        setSelectedProgramId(fallback.selectedProgramId);
        setPinnedProgramId(fallback.pinnedProgramId);
        setPinnedTrackerId(fallback.pinnedTrackerId);
        setTrackers(fallback.trackers);
        setWeightUnit(fallback.weightUnit);
      } else {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        const routines = Array.isArray(parsed.routinePrograms) && parsed.routinePrograms.length > 0 ? parsed.routinePrograms : fallback.routinePrograms;
        setTab(parsed.activeTab || "routines");
        setRoutinePrograms(routines);
        setSelectedProgramId(parsed.selectedProgramId || routines[0]?.id || null);
        setPinnedProgramId(parsed.pinnedProgramId || routines[0]?.id || null);
        setPinnedTrackerId(parsed.pinnedTrackerId || null);
        setTrackers(Array.isArray(parsed.trackers) ? parsed.trackers : []);
        setWeightUnit(parsed.weightUnit || "lbs");
      }
    } catch {
      const fallback = buildDefaultState();
      setTab(fallback.activeTab);
      setRoutinePrograms(fallback.routinePrograms);
      setSelectedProgramId(fallback.selectedProgramId);
      setPinnedProgramId(fallback.pinnedProgramId);
      setPinnedTrackerId(fallback.pinnedTrackerId);
      setTrackers(fallback.trackers);
      setWeightUnit(fallback.weightUnit);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: AppState = {
      activeTab: tab,
      routinePrograms,
      pinnedProgramId,
      selectedProgramId,
      pinnedTrackerId,
      trackers,
      weightUnit,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, tab, routinePrograms, pinnedProgramId, selectedProgramId, pinnedTrackerId, trackers, weightUnit]);

  const selectedProgram = useMemo(
    () => routinePrograms.find((program) => program.id === selectedProgramId) ?? routinePrograms[0] ?? null,
    [routinePrograms, selectedProgramId]
  );

  const pinnedProgram = useMemo(
    () => routinePrograms.find((program) => program.id === pinnedProgramId) ?? null,
    [routinePrograms, pinnedProgramId]
  );

  const pinnedTracker = useMemo(
    () => trackers.find((tracker) => tracker.id === pinnedTrackerId) ?? null,
    [trackers, pinnedTrackerId]
  );

  const currentWorkoutContext = useMemo(() => {
    for (const program of routinePrograms) {
      for (const day of program.days) {
        if (day.id === workoutModalDayId) return { program, day };
      }
    }
    return null;
  }, [routinePrograms, workoutModalDayId]);


  useEffect(() => {
    const resetIds = routinePrograms
      .filter((program) => program.days.length > 0 && program.days.every((day) => day.completed))
      .map((program) => program.id);

    if (resetIds.length === 0) return;

    setResettingProgramIds((prev) => Array.from(new Set([...prev, ...resetIds])));

    const timeout = window.setTimeout(() => {
      setRoutinePrograms((prev) =>
        prev.map((program) =>
          resetIds.includes(program.id)
            ? {
                ...program,
                days: program.days.map((day) => ({
                  ...day,
                  completed: false,
                  workouts: day.workouts.map((workout) => ({ ...workout, done: false })),
                })),
              }
            : program
        )
      );
    }, 700);

    const clearAnimTimeout = window.setTimeout(() => {
      setResettingProgramIds((prev) => prev.filter((id) => !resetIds.includes(id)));
    }, 1200);

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(clearAnimTimeout);
    };
  }, [routinePrograms]);

  const trackerCountText = pinnedTracker
    ? pinnedTracker.trackerKind === "checklist"
      ? `${pinnedTracker.checklistTasks.filter((task) => task.done).length}/${pinnedTracker.checklistTasks.length || 0}`
      : `${aggregateGraphPoints(
          pinnedTracker.graphPoints,
          pinnedTracker.graphPeriod || "day",
          pinnedTracker.xIsDate
        ).length} pts`
    : "";

  const pinnedProgramCompletedCount = pinnedProgram?.days.filter((day) => day.completed).length ?? 0;
  const pinnedProgramTotalCount = pinnedProgram?.days.length ?? 0;

  const openProgramCreate = () => {
    setEditingProgramId(null);
    setProgramNameDraft(`Routine ${routinePrograms.length + 1}`);
    setProgramModalOpen(true);
  };

  const openProgramEdit = (program: RoutineProgram) => {
    setEditingProgramId(program.id);
    setProgramNameDraft(program.name);
    setProgramModalOpen(true);
  };

  const saveProgram = () => {
    const trimmed = programNameDraft.trim();
    if (!trimmed) return;

    if (editingProgramId) {
      setRoutinePrograms((prev) => prev.map((program) => (program.id === editingProgramId ? { ...program, name: trimmed } : program)));
    } else {
      const next = buildProgram(trimmed);
      setRoutinePrograms((prev) => [...prev, next]);
      setSelectedProgramId(next.id);
    }

    setProgramModalOpen(false);
    setEditingProgramId(null);
    setProgramNameDraft("");
  };

  const deleteProgram = (programId: string) => {
    setRoutinePrograms((prev) => {
      const next = prev.filter((program) => program.id !== programId);
      if (selectedProgramId === programId) setSelectedProgramId(next[0]?.id || null);
      if (pinnedProgramId === programId) setPinnedProgramId(next[0]?.id || null);
      return next;
    });
  };

  const addDayToProgram = (programId: string) => {
    setRoutinePrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? {
              ...program,
              days: [...program.days, { id: uid(), name: `Day ${program.days.length + 1}`, workouts: [], completed: false, open: false }],
            }
          : program
      )
    );
  };

  const startEditDay = (day: DayItem) => {
    setEditDayId(day.id);
    setEditDayName(day.name);
  };

  const saveDayName = (programId: string) => {
    const trimmed = editDayName.trim();
    if (!trimmed || !editDayId) return;
    setRoutinePrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? { ...program, days: program.days.map((day) => (day.id === editDayId ? { ...day, name: trimmed } : day)) }
          : program
      )
    );
    setEditDayId(null);
    setEditDayName("");
  };

  const deleteDay = (programId: string, dayId: string) => {
    setRoutinePrograms((prev) =>
      prev.map((program) =>
        program.id === programId ? { ...program, days: program.days.filter((day) => day.id !== dayId) } : program
      )
    );
  };

  const toggleDayOpen = (programId: string, dayId: string) => {
    setRoutinePrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? { ...program, days: program.days.map((day) => (day.id === dayId ? { ...day, open: !day.open } : day)) }
          : program
      )
    );
  };

  const toggleEntireDayComplete = (programId: string, dayId: string) => {
    setRoutinePrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? {
              ...program,
              days: program.days.map((day) => {
                if (day.id !== dayId) return day;
                const nextDone = !day.completed;
                return {
                  ...day,
                  completed: nextDone,
                  workouts: day.workouts.map((workout) => ({ ...workout, done: nextDone })),
                };
              }),
            }
          : program
      )
    );
  };

  const moveWorkout = (programId: string, dayId: string, fromIndex: number, toIndex: number) => {
    setRoutinePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== programId) return program;
        return {
          ...program,
          days: program.days.map((day) => {
            if (day.id !== dayId) return day;
            const next = [...day.workouts];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return updateDayCompletion({ ...day, workouts: next });
          }),
        };
      })
    );
  };

  const openAddWorkoutModal = (dayId: string) => {
    setWorkoutModalDayId(dayId);
    setEditingWorkout(null);
    setWorkoutName("");
    setWorkoutSets("");
    setWorkoutReps("");
    setWorkoutWeight("");
  };

  const openEditWorkoutModal = (programId: string, dayId: string, workoutId: string) => {
    const program = routinePrograms.find((item) => item.id === programId);
    const day = program?.days.find((item) => item.id === dayId);
    const workout = day?.workouts.find((item) => item.id === workoutId);
    if (!workout) return;

    setEditingWorkout({ programId, dayId, workoutId });
    setWorkoutModalDayId(dayId);
    setWorkoutName(workout.name);
    setWorkoutSets(workout.sets || "");
    setWorkoutReps(workout.reps);
    setWorkoutWeight(workout.weight);
  };

  const closeWorkoutModal = () => {
    setWorkoutModalDayId(null);
    setEditingWorkout(null);
  };

  const saveWorkout = () => {
    const trimmedName = workoutName.trim();
    if (!trimmedName || !workoutModalDayId || !currentWorkoutContext) return;

    setRoutinePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== currentWorkoutContext.program.id) return program;
        return {
          ...program,
          days: program.days.map((day) => {
            if (day.id !== workoutModalDayId) return day;
            if (editingWorkout?.dayId === workoutModalDayId) {
              return updateDayCompletion({
                ...day,
                workouts: day.workouts.map((workout) =>
                  workout.id === editingWorkout.workoutId
                    ? { ...workout, name: trimmedName, sets: workoutSets.trim(), reps: workoutReps.trim(), weight: workoutWeight.trim() }
                    : workout
                ),
              });
            }
            return updateDayCompletion({
              ...day,
              open: true,
              workouts: [...day.workouts, { id: uid(), name: trimmedName, sets: workoutSets.trim(), reps: workoutReps.trim(), weight: workoutWeight.trim(), done: false }],
            });
          }),
        };
      })
    );

    closeWorkoutModal();
  };

  const toggleWorkoutDone = (programId: string, dayId: string, workoutId: string) => {
    setRoutinePrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? {
              ...program,
              days: program.days.map((day) =>
                day.id === dayId
                  ? updateDayCompletion({
                      ...day,
                      workouts: day.workouts.map((workout) => (workout.id === workoutId ? { ...workout, done: !workout.done } : workout)),
                    })
                  : day
              ),
            }
          : program
      )
    );
  };

  const deleteWorkout = (programId: string, dayId: string, workoutId: string) => {
    setRoutinePrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? {
              ...program,
              days: program.days.map((day) =>
                day.id === dayId
                  ? updateDayCompletion({ ...day, workouts: day.workouts.filter((workout) => workout.id !== workoutId) })
                  : day
              ),
            }
          : program
      )
    );
  };

  const createTracker = () => {
    const trimmedName = trackerName.trim();
    if (!trimmedName) {
      alert("Give the tracker a title first.");
      return;
    }

    if (trackerKind === "checklist") {
      const tracker: TrackerItem = {
        id: uid(),
        name: trimmedName,
        trackerKind: "checklist",
        open: true,
        checklistTasks: [],
        graphPoints: [],
        completedCount: 0,
      };
      setTrackers((prev) => [...prev, tracker]);
    } else {
      const numericValue = Number(graphValue);
      if (!graphYAxisLabel.trim()) {
        alert("Give the graph a Y axis label.");
        return;
      }
      if (!graphXIsDate && !graphXAxisLabel.trim()) {
        alert("Give the graph an X axis label.");
        return;
      }
      if (!graphPointLabel.trim() || graphValue.trim() === "" || Number.isNaN(numericValue)) {
        alert("Graphs need a point label and a first value.");
        return;
      }

      const tracker: TrackerItem = {
        id: uid(),
        name: trimmedName,
        trackerKind: "graph",
        open: true,
        checklistTasks: [],
        graphStyle,
        graphPeriod: graphXIsDate ? "day" : "month",
        graphPoints: [{ id: uid(), label: graphPointLabel.trim(), value: numericValue }],
        completedCount: 0,
        xAxisLabel: graphXIsDate ? "Date" : graphXAxisLabel.trim(),
        yAxisLabel: graphYAxisLabel.trim(),
        xIsDate: graphXIsDate,
        dataExpanded: false,
      };
      setTrackers((prev) => [...prev, tracker]);
    }

    setTrackerModalOpen(false);
    setTrackerName("");
    setTrackerKind("checklist");
    setGraphStyle("line");
    setGraphXAxisLabel("");
    setGraphYAxisLabel("");
    setGraphXIsDate(false);
    setGraphPointLabel("");
    setGraphValue("");
  };

  const deleteTracker = (trackerId: string) => {
    setTrackers((prev) => prev.filter((tracker) => tracker.id !== trackerId));
    if (pinnedTrackerId === trackerId) setPinnedTrackerId(null);
  };

  const toggleTrackerOpen = (trackerId: string) => {
    setTrackers((prev) => prev.map((tracker) => (tracker.id === trackerId ? { ...tracker, open: !tracker.open } : tracker)));
  };

  const openChecklistPrompt = (trackerId: string) => {
    setChecklistModalTrackerId(trackerId);
    setChecklistTaskInput("");
  };

  const addChecklistTask = (trackerId: string, text?: string) => {
    const draft = (text ?? checklistDrafts[trackerId] ?? "").trim();
    if (!draft) return;

    setTrackers((prev) =>
      prev.map((tracker) =>
        tracker.id === trackerId
          ? { ...tracker, checklistTasks: [...tracker.checklistTasks, { id: uid(), text: draft, done: false }] }
          : tracker
      )
    );
    setChecklistDrafts((prev) => ({ ...prev, [trackerId]: "" }));
  };

  const editChecklistTask = (trackerId: string, taskId: string, currentText: string) => {
    const value = window.prompt("Edit checklist item", currentText);
    if (!value || !value.trim()) return;
    setTrackers((prev) =>
      prev.map((tracker) =>
        tracker.id === trackerId
          ? {
              ...tracker,
              checklistTasks: tracker.checklistTasks.map((task) =>
                task.id === taskId ? { ...task, text: value.trim() } : task
              ),
            }
          : tracker
      )
    );
  };

  const toggleChecklistTask = (trackerId: string, taskId: string) => {
    setTrackers((prev) =>
      prev.map((tracker) => {
        if (tracker.id !== trackerId) return tracker;
        const nextTasks = tracker.checklistTasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task));
        const allDone = nextTasks.length > 0 && nextTasks.every((task) => task.done);
        if (allDone) {
          return {
            ...tracker,
            checklistTasks: nextTasks.map((task) => ({ ...task, done: false })),
            completedCount: tracker.completedCount + 1,
            open: false,
          };
        }
        return { ...tracker, checklistTasks: nextTasks };
      })
    );
  };

  const deleteChecklistTask = (trackerId: string, taskId: string) => {
    setTrackers((prev) =>
      prev.map((tracker) =>
        tracker.id === trackerId
          ? { ...tracker, checklistTasks: tracker.checklistTasks.filter((task) => task.id !== taskId) }
          : tracker
      )
    );
  };

  const openGraphDataModal = (trackerId: string) => {
    setGraphDataModalTrackerId(trackerId);
    setGraphSelectedKey(null);
    setGraphDrafts((prev) => ({ ...prev, [trackerId]: prev[trackerId] || { label: "", value: "" } }));
  };

  const closeGraphDataModal = () => {
    setGraphDataModalTrackerId(null);
  };

  const addGraphPoint = (trackerId: string) => {
    const draft = graphDrafts[trackerId];
    const label = draft?.label?.trim() || "";
    const valueText = draft?.value || "";
    const value = Number(valueText);
    if (!label || valueText.trim() === "" || Number.isNaN(value)) {
      alert("Add a label and a valid number.");
      return;
    }

    setTrackers((prev) =>
      prev.map((tracker) =>
        tracker.id === trackerId
          ? { ...tracker, graphPoints: [...tracker.graphPoints, { id: uid(), label, value }] }
          : tracker
      )
    );

    setGraphDrafts((prev) => ({ ...prev, [trackerId]: { label: "", value: "" } }));
  };

  const deleteGraphPoint = (trackerId: string, pointId: string) => {
    setTrackers((prev) =>
      prev.map((tracker) =>
        tracker.id === trackerId
          ? { ...tracker, graphPoints: tracker.graphPoints.filter((point) => point.id !== pointId) }
          : tracker
      )
    );
  };

  const setTrackerPeriod = (trackerId: string, period: GraphPeriod) => {
    setTrackers((prev) => prev.map((tracker) => (tracker.id === trackerId ? { ...tracker, graphPeriod: period } : tracker)));
    setGraphSelectedKey(null);
  };

  const toggleDataExpanded = (trackerId: string) => {
    setTrackers((prev) => prev.map((tracker) => (tracker.id === trackerId ? { ...tracker, dataExpanded: !tracker.dataExpanded } : tracker)));
  };

  const handleGraphTickSelect = (trackerId: string, pointId: string) => {
    const tracker = trackers.find((item) => item.id === trackerId);
    const point = tracker?.graphPoints.find((item) => item.id === pointId);
    if (!tracker || !point) return;
    setGraphSelectedKey(graphSelectionKey(point, tracker.graphPeriod || "day", tracker.xIsDate));
    setTrackers((prev) =>
      prev.map((item) => (item.id === trackerId ? { ...item, dataExpanded: true, open: true } : item))
    );
  };


  const exportData = () => {
    const payload: AppState = {
      activeTab: tab,
      routinePrograms,
      pinnedProgramId,
      selectedProgramId,
      pinnedTrackerId,
      trackers,
      weightUnit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "iron-engine-export.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as AppState;
      const replaceAll = window.confirm("Press OK to replace all current Iron Engine data. Press Cancel to add imported data into your current data.");

      if (replaceAll) {
        const fallback = buildDefaultState();
        const routines = Array.isArray(parsed.routinePrograms) && parsed.routinePrograms.length > 0 ? parsed.routinePrograms : fallback.routinePrograms;
        setTab(parsed.activeTab || "routines");
        setRoutinePrograms(routines);
        setPinnedProgramId(parsed.pinnedProgramId || routines[0]?.id || null);
        setSelectedProgramId(parsed.selectedProgramId || routines[0]?.id || null);
        setPinnedTrackerId(parsed.pinnedTrackerId || null);
        setTrackers(Array.isArray(parsed.trackers) ? parsed.trackers : []);
        setWeightUnit(parsed.weightUnit || "lbs");
      } else {
        setRoutinePrograms((prev) => [
          ...prev,
          ...((parsed.routinePrograms || []).map((program) => ({
            ...program,
            id: uid(),
            days: (program.days || []).map((day) => ({
              ...day,
              id: uid(),
              workouts: (day.workouts || []).map((workout) => ({ ...workout, id: uid() })),
            })),
          }))),
        ]);
        setTrackers((prev) => [
          ...prev,
          ...((parsed.trackers || []).map((tracker) => ({
            ...tracker,
            id: uid(),
            checklistTasks: (tracker.checklistTasks || []).map((task) => ({ ...task, id: uid() })),
            graphPoints: (tracker.graphPoints || []).map((point) => ({ ...point, id: uid() })),
          }))),
        ]);
      }
    } catch {
      alert("That file could not be imported.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.backdropGlow} />

      <div
        className={styles.shell}
        style={
          {
            transform: `translateY(${APP_DESKTOP_OFFSET_Y}px)`,
            ["--mobile-shell-offset" as any]: `${APP_MOBILE_OFFSET_Y}px`,
          } as React.CSSProperties
        }
      >
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} className={styles.hiddenFileInput} />

        <div
          className={styles.titleImageWrapTop}
          style={
            {
              transform: `translate(0px, ${TITLE_DESKTOP_OFFSET_Y}px)`,
              ["--mobile-title-offset-y" as any]: `${TITLE_MOBILE_OFFSET_Y}px`,
            } as React.CSSProperties
          }
        >
          <img
            src="/images/iron-engine-title.png"
            alt="Iron Engine"
            className={styles.titleImage}
            style={
              {
                width: `${TITLE_DESKTOP_WIDTH}px`,
                ["--mobile-title-width" as any]: `${TITLE_MOBILE_WIDTH}px`,
              } as React.CSSProperties
            }
          />
        </div>

        <div className={styles.topUtilityRow}>
          <button type="button" className={styles.utilityBox} onClick={exportData}>
            <span className={styles.utilityIcon}>⇪</span>
            <span>Export</span>
          </button>
          <button type="button" className={styles.utilityBox} onClick={() => fileInputRef.current?.click()}>
            <span className={styles.utilityIcon}>⇩</span>
            <span>Import</span>
          </button>
        </div>

        <header className={styles.heroCard}>
          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Pinned routine</span>
              <strong className={styles.statValue}>{pinnedProgram?.name || "No routine selected yet"}</strong>
              <div className={styles.statSubtext}>
                {pinnedProgram ? `${pinnedProgramCompletedCount}/${pinnedProgramTotalCount} complete` : ""}
              </div>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Pinned tracker</span>
              <strong className={styles.statValue}>{pinnedTracker ? pinnedTracker.name : "No tracker selected yet"}</strong>
              {trackerCountText ? <div className={styles.statSubtext}>{trackerCountText}</div> : null}
            </div>
          </div>
        </header>

        <div className={styles.tabBar}>
          {(["settings", "routines", "tracker"] as TabKey[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              className={`${styles.tabButton} ${tab === tabKey ? styles.tabButtonActive : ""}`}
              onClick={() => setTab(tabKey)}
            >
              {tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
            </button>
          ))}
        </div>

        {tab === "routines" && (
          <section className={styles.section}>
            <div className={styles.sectionTop}>
              <div className={styles.sectionTitleRow}>
                <h2>Routine Builder</h2>
              </div>
              <button type="button" className={styles.primaryAction} onClick={openProgramCreate}>
                + Add Routine
              </button>
            </div>

            <div className={styles.programRail}>
              {routinePrograms.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  className={`${styles.programChip} ${selectedProgramId === program.id ? styles.programChipActive : ""}`}
                  onClick={() => setSelectedProgramId(program.id)}
                >
                  {program.name}
                </button>
              ))}
            </div>

            {selectedProgram && (
              <article className={styles.programCard}>
                <div className={styles.programCardHeader}>
                  <h3>{selectedProgram.name}</h3>
                </div>
                <div className={styles.iconToolbarUnderTitle}>
                  <button type="button" className={styles.iconOnlyButton} onClick={() => addDayToProgram(selectedProgram.id)} title="Add day">＋</button>
                  <button type="button" className={styles.iconOnlyButton} onClick={() => setPinnedProgramId(selectedProgram.id)} title="Pin routine">⌖</button>
                  <button type="button" className={styles.iconOnlyButton} onClick={() => setSettingsMenu({ type: "program", programId: selectedProgram.id })} title="Routine settings">⚙</button>
                </div>

                <div className={styles.stack}>
                  {selectedProgram.days.map((day) => (
                    <article key={day.id} className={`${styles.panel} ${day.completed ? styles.panelComplete : ""} ${resettingProgramIds.includes(selectedProgram.id) ? styles.panelResetting : ""}`}>
                      <div className={styles.dayHeader}>
                        <button type="button" className={styles.routineCheck} onClick={() => toggleEntireDayComplete(selectedProgram.id, day.id)}>
                          <span className={`${styles.checkCircle} ${day.completed ? styles.checkCircleOn : ""}`}>
                            {day.completed ? "✓" : ""}
                          </span>
                        </button>

                        <button type="button" className={styles.dayTitleButton} onClick={() => toggleDayOpen(selectedProgram.id, day.id)}>
                          {day.name}
                        </button>

                        {day.open ? (
                          <div className={styles.inlineHeaderIconsLeft}>
                            <button type="button" className={styles.iconOnlyButton} onClick={() => openAddWorkoutModal(day.id)} title="Add workout">＋</button>
                            <button type="button" className={styles.iconOnlyButton} onClick={() => setSettingsMenu({ type: "day", programId: selectedProgram.id, dayId: day.id })} title="Day settings">⚙</button>
                          </div>
                        ) : null}
                      </div>

                      {editDayId === day.id && day.open ? (
                        <div className={styles.editDayInline}>
                          <input className={styles.input} value={editDayName} onChange={(event) => setEditDayName(event.target.value)} placeholder="Day name" />
                          <button type="button" className={styles.smallAction} onClick={() => saveDayName(selectedProgram.id)}>Save</button>
                        </div>
                      ) : null}

                      <div className={`${styles.dropdown} ${day.open ? styles.dropdownOpen : ""}`}>
                        <div className={styles.dropdownInner}>
                          {day.workouts.length === 0 ? (
                            <div className={styles.emptyState}></div>
                          ) : (
                            <div className={styles.workoutList}>
                              {day.workouts.map((workout, index) => (
                                <div
                                  key={workout.id}
                                  className={`${styles.exerciseRow} ${workout.done ? styles.workoutCardDone : ""}`}
                                  draggable
                                  onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => {
                                    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                                    if (!Number.isNaN(fromIndex)) moveWorkout(selectedProgram.id, day.id, fromIndex, index);
                                  }}
                                >
                                  <button type="button" className={styles.workoutCheckButton} onClick={() => toggleWorkoutDone(selectedProgram.id, day.id, workout.id)}>
                                    <span className={`${styles.checkCircle} ${workout.done ? styles.checkCircleOn : ""}`}>
                                      {workout.done ? "✓" : ""}
                                    </span>
                                  </button>

                                  <div className={styles.exerciseContent}>
                                    <div className={styles.exerciseTitle}>{workout.name}</div>
                                  </div>

                                  <div className={styles.exerciseStatsColumn}>
                                    <div className={styles.exerciseMeta}>{workout.sets || "--"} sets</div>
                                    <div className={styles.exerciseMeta}>{workout.reps || "--"} reps</div>
                                    <div className={styles.exerciseMeta}>{workout.weight || "--"} {weightUnit}</div>
                                  </div>

                                  <div className={styles.inlineHeaderIcons}>
                                    <button type="button" className={styles.iconOnlyButton} onClick={() => setSettingsMenu({ type: "workout", programId: selectedProgram.id, dayId: day.id, workoutId: workout.id })} title="Workout settings">⚙</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            )}
          </section>
        )}

        {tab === "tracker" && (
          <section className={styles.section}>
            <div className={styles.sectionTop}>
              <h2>Tracker</h2>
              <button type="button" className={styles.primaryAction} onClick={() => setTrackerModalOpen(true)}>
                + Create New Tracker
              </button>
            </div>

            <div className={styles.stack}>
              {trackers.length === 0 && <div className={styles.emptyState}>No trackers yet. Build your first one.</div>}

              {trackers.map((tracker) => (
                <article key={tracker.id} className={styles.panel}>
                  <div className={styles.dayHeader}>
                    <button type="button" className={styles.dayTitleButton} onClick={() => toggleTrackerOpen(tracker.id)}>
                      {tracker.name}
                    </button>

                    {tracker.open ? (
                      <div className={styles.inlineHeaderIconsLeft}>
                        {tracker.trackerKind === "checklist" ? (
                          <>
                            <button type="button" className={styles.iconOnlyButton} onClick={() => openChecklistPrompt(tracker.id)} title="Add task">＋</button>
                            <button type="button" className={styles.iconOnlyButton} onClick={() => setPinnedTrackerId(tracker.id)} title="Pin checklist">⌖</button>
                          </>
                        ) : (
                          <button type="button" className={styles.iconOnlyButton} onClick={() => openGraphDataModal(tracker.id)} title="Add data">＋</button>
                        )}
                        <button type="button" className={styles.iconOnlyButton} onClick={() => setSettingsMenu({ type: "tracker", trackerId: tracker.id })} title="Tracker settings">⚙</button>
                      </div>
                    ) : null}
                  </div>

                  <div className={`${styles.dropdown} ${tracker.open ? styles.dropdownOpen : ""}`}>
                    <div className={styles.dropdownInner}>
                      {tracker.trackerKind === "checklist" ? (
                        <>
                          <div className={styles.workoutList}>
                            {tracker.checklistTasks.length === 0 ? (
                              <div className={styles.emptyState}>No checklist items yet.</div>
                            ) : (
                              tracker.checklistTasks.map((task) => (
                                <div key={task.id} className={`${styles.exerciseRow} ${task.done ? styles.workoutCardDone : ""}`}>
                                  <button type="button" className={styles.workoutCheckButton} onClick={() => toggleChecklistTask(tracker.id, task.id)}>
                                    <span className={`${styles.checkCircle} ${task.done ? styles.checkCircleOn : ""}`}>
                                      {task.done ? "✓" : ""}
                                    </span>
                                  </button>

                                  <div className={styles.exerciseContent}>
                                    <div className={styles.exerciseTitle}>{task.text}</div>
                                  </div>

                                  <div className={styles.inlineHeaderIcons}>
                                    <button type="button" className={styles.iconOnlyButton} onClick={() => setSettingsMenu({ type: "task", trackerId: tracker.id, taskId: task.id, currentText: task.text })} title="Task settings">⚙</button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.graphToolbarCentered}>
                            <button type="button" className={styles.primaryAction} onClick={() => openGraphDataModal(tracker.id)}>
                              Add Data
                            </button>
                            <button type="button" className={styles.primaryAction} onClick={() => setGraphTimeframeModalTrackerId(tracker.id)}>
                              Timeframe
                            </button>
                          </div>

                          <GraphPreview
                            style={tracker.graphStyle || "line"}
                            points={tracker.graphPoints}
                            period={tracker.graphPeriod || "month"}
                            xAxisLabel={tracker.xAxisLabel}
                            yAxisLabel={tracker.yAxisLabel}
                            xIsDate={tracker.xIsDate}
                            onTickSelect={(selectionKey) => handleGraphTickSelect(tracker.id, selectionKey)}
                          />

                          <button type="button" className={styles.expandDataButton} onClick={() => toggleDataExpanded(tracker.id)}>
                            {tracker.dataExpanded ? "Hide Data" : "Show Data"}
                          </button>

                          {tracker.dataExpanded ? (
                            <div className={styles.pointList}>
                              {tracker.graphPoints.map((point) => {
                                const selected = rowMatchesSelection(point, graphSelectedKey, tracker.graphPeriod || "day", tracker.xIsDate);
                                return (
                                  <div
                                    key={point.id}
                                    className={`${styles.pointRow} ${selected ? styles.pointRowSelected : ""}`}
                                    onClick={() => setGraphSelectedKey(graphSelectionKey(point, tracker.graphPeriod || "day", tracker.xIsDate))}
                                  >
                                    <span>{point.label}</span>
                                    <span>{point.value}</span>
                                    {selected ? (
                                      <button type="button" className={styles.iconAction} onClick={() => deleteGraphPoint(tracker.id, point.id)}>
                                        Delete
                                      </button>
                                    ) : (
                                      <span />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className={styles.section}>
            <div className={styles.sectionTop}>
              <h2>Settings</h2>
            </div>

            <div className={styles.settingsGrid}>
              <article className={styles.settingCard}>
                <h3>Weight Unit</h3>
                <p>Switch between pounds and kilograms for workout weight labels.</p>
                <div className={styles.segmentRowLeft}>
                  <button type="button" className={`${styles.segmentButton} ${weightUnit === "lbs" ? styles.segmentButtonActive : ""}`} onClick={() => setWeightUnit("lbs")}>
                    lbs
                  </button>
                  <button type="button" className={`${styles.segmentButton} ${weightUnit === "kg" ? styles.segmentButtonActive : ""}`} onClick={() => setWeightUnit("kg")}>
                    kg
                  </button>
                </div>
              </article>

              <article className={styles.settingCard}>
                <h3>Saved Data</h3>
                <p>Your routines, trackers, graphs, and updates persist in local storage when you reopen the app in this browser.</p>
                <div className={styles.settingMeta}>
                  <span>{routinePrograms.length} routines</span>
                  <span>{trackers.length} trackers</span>
                </div>
              </article>
            </div>
          </section>
        )}
      </div>

      {workoutModalDayId && (
        <div className={styles.modalOverlay} onClick={closeWorkoutModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>{editingWorkout ? "Edit Workout" : "Add Workout"}</h3>
            <div className={styles.modalFields}>
              <input className={styles.input} placeholder="Workout name" value={workoutName} onChange={(event) => setWorkoutName(event.target.value)} />
              <input className={styles.input} type="number" inputMode="numeric" placeholder="Sets" value={workoutSets} onChange={(event) => setWorkoutSets(event.target.value)} />
              <input className={styles.input} type="number" inputMode="numeric" placeholder="Reps" value={workoutReps} onChange={(event) => setWorkoutReps(event.target.value)} />
              <input className={styles.input} type="number" inputMode="decimal" placeholder={`Weight (${weightUnit})`} value={workoutWeight} onChange={(event) => setWorkoutWeight(event.target.value)} />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={closeWorkoutModal}>Cancel</button>
              <button type="button" className={styles.primaryAction} onClick={saveWorkout}>{editingWorkout ? "Save Changes" : "Add Workout"}</button>
            </div>
          </div>
        </div>
      )}

      {programModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setProgramModalOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>{editingProgramId ? "Edit Routine" : "Create Routine"}</h3>
            <div className={styles.modalFields}>
              <input className={styles.input} placeholder="Routine name" value={programNameDraft} onChange={(event) => setProgramNameDraft(event.target.value)} />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={() => setProgramModalOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryAction} onClick={saveProgram}>{editingProgramId ? "Save Routine" : "Create Routine"}</button>
            </div>
          </div>
        </div>
      )}

      {trackerModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setTrackerModalOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>Create New Tracker</h3>
            <div className={styles.modalFields}>
              <input className={styles.input} placeholder="Tracker title" value={trackerName} onChange={(event) => setTrackerName(event.target.value)} />
              <div className={styles.segmentRowLeft}>
                <button type="button" className={`${styles.segmentButton} ${trackerKind === "checklist" ? styles.segmentButtonActive : ""}`} onClick={() => setTrackerKind("checklist")}>Checklist</button>
                <button type="button" className={`${styles.segmentButton} ${trackerKind === "graph" ? styles.segmentButtonActive : ""}`} onClick={() => setTrackerKind("graph")}>Graph</button>
              </div>

              {trackerKind === "graph" && (
                <>
                  <div className={styles.segmentRowLeft}>
                    <button type="button" className={`${styles.segmentButton} ${graphStyle === "line" ? styles.segmentButtonActive : ""}`} onClick={() => setGraphStyle("line")}>Line</button>
                    <button type="button" className={`${styles.segmentButton} ${graphStyle === "bar" ? styles.segmentButtonActive : ""}`} onClick={() => setGraphStyle("bar")}>Bar</button>
                  </div>

                  <input
                    className={styles.input}
                    placeholder="Axis Label (x axis)"
                    value={graphXIsDate ? "Date" : graphXAxisLabel}
                    onChange={(event) => setGraphXAxisLabel(event.target.value)}
                    disabled={graphXIsDate}
                  />

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={graphXIsDate}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setGraphXIsDate(checked);
                        setGraphXAxisLabel(checked ? "Date" : "");
                      }}
                    />
                    <span>Select if X are dates</span>
                  </label>

                  <input className={styles.input} placeholder="Axis Label (y axis)" value={graphYAxisLabel} onChange={(event) => setGraphYAxisLabel(event.target.value)} />
                  <input className={styles.input} placeholder="Value Label (x axis)" type={graphXIsDate ? "date" : "text"} value={graphPointLabel} onChange={(event) => setGraphPointLabel(event.target.value)} />
                  <input className={styles.input} type="number" inputMode="decimal" placeholder="First value" value={graphValue} onChange={(event) => setGraphValue(event.target.value)} />
                </>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={() => setTrackerModalOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryAction} onClick={createTracker}>Create</button>
            </div>
          </div>
        </div>
      )}


      {checklistModalTrackerId && (
        <div className={styles.modalOverlay} onClick={() => setChecklistModalTrackerId(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>Add Checklist Item</h3>
            <div className={styles.modalFields}>
              <input
                className={styles.input}
                placeholder="Task name"
                value={checklistTaskInput}
                onChange={(event) => setChecklistTaskInput(event.target.value)}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={() => setChecklistModalTrackerId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => {
                  addChecklistTask(checklistModalTrackerId, checklistTaskInput);
                  setChecklistModalTrackerId(null);
                  setChecklistTaskInput("");
                }}
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {graphDataModalTrackerId && (
        <div className={styles.modalOverlay} onClick={closeGraphDataModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>Add Graph Data</h3>
            <div className={styles.modalFields}>
              <input
                className={styles.input}
                placeholder={trackers.find((item) => item.id === graphDataModalTrackerId)?.xIsDate ? "Date point" : "Value label (x axis)"}
                type={trackers.find((item) => item.id === graphDataModalTrackerId)?.xIsDate ? "date" : "text"}
                value={graphDrafts[graphDataModalTrackerId]?.label || ""}
                onChange={(event) =>
                  setGraphDrafts((prev) => ({
                    ...prev,
                    [graphDataModalTrackerId]: {
                      label: event.target.value,
                      value: prev[graphDataModalTrackerId]?.value || "",
                    },
                  }))
                }
              />
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                placeholder="Value"
                value={graphDrafts[graphDataModalTrackerId]?.value || ""}
                onChange={(event) =>
                  setGraphDrafts((prev) => ({
                    ...prev,
                    [graphDataModalTrackerId]: {
                      label: prev[graphDataModalTrackerId]?.label || "",
                      value: event.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryAction} onClick={closeGraphDataModal}>Cancel</button>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => {
                  addGraphPoint(graphDataModalTrackerId);
                  closeGraphDataModal();
                }}
              >
                Add Data
              </button>
            </div>
          </div>
        </div>
      )}

      {graphTimeframeModalTrackerId && (
        <div className={styles.modalOverlay} onClick={() => setGraphTimeframeModalTrackerId(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>Timeframe</h3>
            <div className={styles.segmentRowLeft}>
              {(["day", "month", "year"] as GraphPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  className={`${styles.segmentButton} ${trackers.find((t) => t.id === graphTimeframeModalTrackerId)?.graphPeriod === period ? styles.segmentButtonActive : ""}`}
                  onClick={() => {
                    setTrackerPeriod(graphTimeframeModalTrackerId, period);
                    setGraphTimeframeModalTrackerId(null);
                  }}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
{settingsMenu && (
  <div className={styles.modalOverlay} onClick={() => setSettingsMenu(null)}>
    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
      <h3>Options</h3>
      <div className={styles.modalActionsLeft}>
        {(settingsMenu.type === "program" || settingsMenu.type === "day" || settingsMenu.type === "workout" || settingsMenu.type === "task") ? (
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => {
              if (settingsMenu.type === "program" && settingsMenu.programId) {
                const program = routinePrograms.find((p) => p.id === settingsMenu.programId);
                if (program) openProgramEdit(program);
              }
              if (settingsMenu.type === "day" && settingsMenu.programId && settingsMenu.dayId) {
                const program = routinePrograms.find((p) => p.id === settingsMenu.programId);
                const day = program?.days.find((d) => d.id === settingsMenu.dayId);
                if (day) startEditDay(day);
              }
              if (settingsMenu.type === "workout" && settingsMenu.programId && settingsMenu.dayId && settingsMenu.workoutId) {
                openEditWorkoutModal(settingsMenu.programId, settingsMenu.dayId, settingsMenu.workoutId);
              }
              if (settingsMenu.type === "task" && settingsMenu.trackerId && settingsMenu.taskId && settingsMenu.currentText) {
                editChecklistTask(settingsMenu.trackerId, settingsMenu.taskId, settingsMenu.currentText);
              }
              setSettingsMenu(null);
            }}
          >
            Edit
          </button>
        ) : null}
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => {
            if (settingsMenu.type === "program" && settingsMenu.programId) deleteProgram(settingsMenu.programId);
            if (settingsMenu.type === "day" && settingsMenu.programId && settingsMenu.dayId) deleteDay(settingsMenu.programId, settingsMenu.dayId);
            if (settingsMenu.type === "workout" && settingsMenu.programId && settingsMenu.dayId && settingsMenu.workoutId) deleteWorkout(settingsMenu.programId, settingsMenu.dayId, settingsMenu.workoutId);
            if (settingsMenu.type === "tracker" && settingsMenu.trackerId) deleteTracker(settingsMenu.trackerId);
            if (settingsMenu.type === "task" && settingsMenu.trackerId && settingsMenu.taskId) deleteChecklistTask(settingsMenu.trackerId, settingsMenu.taskId);
            setSettingsMenu(null);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
