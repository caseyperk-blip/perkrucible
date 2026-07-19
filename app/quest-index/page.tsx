"use client";

import Holidays from "date-holidays";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createDefaultQuestState,
  createId,
  loadQuestState,
  MAIN_CATEGORY_ID,
  normalizeImportedQuestState,
  Quest,
  QuestCategory,
  QuestFilter,
  QuestState,
  saveQuestState,
  SIDE_CATEGORY_ID,
} from "./db";
import styles from "./quest.module.css";

type Tab = "all" | "log" | "calendar";
type SortMode = "manual" | "newest" | "oldest" | "date" | "alphabetical";
type DraftQuest = {
  id: string | null;
  title: string;
  description: string;
  categoryId: string;
  filterIds: string[];
  date: string;
};

const FILTER_COLORS = ["#d7d7d7", "#b04b4b", "#b68a3a", "#657e9b", "#6d8c68", "#876c9b", "#9a7161", "#4f8c8c"];
const EMPTY_DRAFT: DraftQuest = {
  id: null,
  title: "",
  description: "",
  categoryId: MAIN_CATEGORY_ID,
  filterIds: [],
  date: "",
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sortedCategories(categories: QuestCategory[]) {
  return [...categories].sort((a, b) => a.order - b.order);
}

function mergeArchives(current: QuestState, imported: QuestState): QuestState {
  const categories = new Map(current.categories.map((category) => [category.id, category]));
  imported.categories.forEach((category) => categories.set(category.id, { ...categories.get(category.id), ...category }));

  const filters = new Map(current.filters.map((filter) => [filter.id, filter]));
  imported.filters.forEach((filter) => filters.set(filter.id, filter));

  const quests = new Map(current.quests.map((quest) => [quest.id, quest]));
  imported.quests.forEach((quest) => {
    const existing = quests.get(quest.id);
    if (!existing || quest.updatedAt >= existing.updatedAt) quests.set(quest.id, quest);
  });

  return {
    version: 1,
    categories: Array.from(categories.values()),
    filters: Array.from(filters.values()),
    quests: Array.from(quests.values()),
    holidaySettings: current.holidaySettings,
  };
}

function QuestCard({
  quest,
  filters,
  category,
  onComplete,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDrop,
  completing,
}: {
  quest: Quest;
  filters: QuestFilter[];
  category?: QuestCategory;
  onComplete: (id: string) => void;
  onEdit: (quest: Quest) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDragStart: (id: string) => void;
  onDrop: (targetId: string) => void;
  completing: boolean;
}) {
  const questFilters = quest.filterIds.map((id) => filters.find((filter) => filter.id === id)).filter(Boolean) as QuestFilter[];
  return (
    <article
      className={`${styles.questCard} ${quest.completed ? styles.completedQuest : ""} ${completing ? styles.completingQuest : ""}`}
      draggable
      onDragStart={() => onDragStart(quest.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        onDrop(quest.id);
      }}
    >
      <button className={styles.completionMark} type="button" onClick={() => onComplete(quest.id)} aria-label={quest.completed ? "Restore quest" : "Complete quest"}>
        {quest.completed || completing ? "✓" : ""}
      </button>
      <div className={styles.questCopy}>
        <div className={styles.questHeading}>
          <h3>{quest.title}</h3>
          {category && <span>{category.name}</span>}
        </div>
        {quest.description && <p>{quest.description}</p>}
        <div className={styles.questMeta}>
          {quest.date && <time dateTime={quest.date}>{parseDateKey(quest.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>}
          {quest.completedAt && <span>Completed {new Date(quest.completedAt).toLocaleDateString()}</span>}
        </div>
      </div>
      <div className={styles.questActions}>
        <div className={styles.actionButtons}>
          <div className={styles.reorderControls}>
            <button type="button" onClick={() => onMove(quest.id, -1)} aria-label="Move quest up">↑</button>
            <button type="button" onClick={() => onMove(quest.id, 1)} aria-label="Move quest down">↓</button>
          </div>
          <button type="button" onClick={() => onEdit(quest)}>Edit</button>
          <button type="button" onClick={() => onDelete(quest.id)}>Delete</button>
        </div>
        <div className={styles.filterRail} aria-label={questFilters.length ? "Quest filters" : "No filters"}>
          {questFilters.map((filter) => <button type="button" key={filter.id} className={styles.filterDot} style={{ "--dot-color": filter.color } as React.CSSProperties} title={filter.name} aria-label={filter.name} />)}
        </div>
      </div>
    </article>
  );
}

export default function QuestIndexPage() {
  const [state, setState] = useState<QuestState>(() => createDefaultQuestState());
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveStateLabel] = useState<"loading" | "saved" | "saving" | "backup">("loading");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftQuest | null>(null);
  const [newFilterName, setNewFilterName] = useState("");
  const [newFilterColor, setNewFilterColor] = useState(FILTER_COLORS[0]);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [completingQuestIds, setCompletingQuestIds] = useState<string[]>([]);
  const [draggedQuestId, setDraggedQuestId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedDate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedDate]);

  useEffect(() => {
    let active = true;
    loadQuestState().then((loaded) => {
      if (!active) return;
      setState(loaded);
      setHydrated(true);
      setSaveStateLabel("saved");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStateLabel("saving");
    const timer = window.setTimeout(() => {
      saveQuestState(state)
        .then(() => setSaveStateLabel("saved"))
        .catch(() => setSaveStateLabel("backup"));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  const categoryMap = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);

  const visibleQuests = useMemo(() => {
    let quests = state.quests.filter((quest) => (showCompleted ? quest.completed : !quest.completed));
    if (selectedFilterId !== "all") quests = quests.filter((quest) => quest.filterIds.includes(selectedFilterId));
    const query = search.trim().toLowerCase();
    if (query) {
      quests = quests.filter((quest) => {
        const filterNames = quest.filterIds.map((id) => state.filters.find((filter) => filter.id === id)?.name || "").join(" ");
        const categoryName = state.categories.find((category) => category.id === quest.categoryId)?.name || "";
        return `${quest.title} ${quest.description} ${filterNames} ${categoryName} ${quest.date || ""}`.toLowerCase().includes(query);
      });
    }
    const sorted = [...quests];
    if (sortMode === "newest") sorted.sort((a, b) => b.createdAt - a.createdAt);
    if (sortMode === "oldest") sorted.sort((a, b) => a.createdAt - b.createdAt);
    if (sortMode === "alphabetical") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === "date") sorted.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    if (sortMode === "manual") sorted.sort((a, b) => a.order - b.order);
    return sorted;
  }, [state.quests, state.filters, state.categories, showCompleted, selectedFilterId, search, sortMode]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    try {
      const { country, state: region, types } = state.holidaySettings;
      const holidays = region ? new Holidays(country, region) : new Holidays(country);
      holidays.setLanguages("en");
      holidays.getHolidays(currentMonth.getFullYear()).forEach((holiday) => {
        if (!types.includes(holiday.type)) return;
        const key = holiday.date.slice(0, 10);
        map.set(key, [...(map.get(key) || []), holiday.name]);
      });
    } catch (error) {
      console.warn("Could not calculate holiday calendar", error);
    }
    return map;
  }, [currentMonth, state.holidaySettings]);

  const calendarDays = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [currentMonth]);

  function openCreateQuest(date = "", categoryId = MAIN_CATEGORY_ID) {
    setDraft({ ...EMPTY_DRAFT, date, categoryId });
    setNewFilterName("");
  }

  function openEditQuest(quest: Quest) {
    setDraft({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      categoryId: quest.categoryId,
      filterIds: [...quest.filterIds],
      date: quest.date || "",
    });
    setNewFilterName("");
  }

  function saveDraft() {
    if (!draft || !draft.title.trim()) return;
    const now = Date.now();
    setState((current) => {
      if (draft.id) {
        return {
          ...current,
          quests: current.quests.map((quest) =>
            quest.id === draft.id
              ? { ...quest, title: draft.title.trim(), description: draft.description.trim(), categoryId: draft.categoryId, filterIds: draft.filterIds, date: draft.date || null, updatedAt: now }
              : quest,
          ),
        };
      }
      const categoryQuests = current.quests.filter((quest) => quest.categoryId === draft.categoryId);
      const quest: Quest = {
        id: createId("quest"),
        title: draft.title.trim(),
        description: draft.description.trim(),
        categoryId: draft.categoryId,
        filterIds: draft.filterIds,
        date: draft.date || null,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        order: categoryQuests.length ? Math.max(...categoryQuests.map((item) => item.order)) + 1 : 0,
      };
      return { ...current, quests: [...current.quests, quest] };
    });
    setDraft(null);
  }

  function createFilter() {
    const name = newFilterName.trim();
    if (!name) return;
    const existing = state.filters.find((filter) => filter.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setDraft((current) => (current && !current.filterIds.includes(existing.id) ? { ...current, filterIds: [...current.filterIds, existing.id] } : current));
      setNewFilterName("");
      return;
    }
    const filter: QuestFilter = { id: createId("filter"), name, color: newFilterColor };
    setState((current) => ({ ...current, filters: [...current.filters, filter] }));
    setDraft((current) => (current ? { ...current, filterIds: [...current.filterIds, filter.id] } : current));
    setNewFilterName("");
  }

  function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setState((current) => ({
      ...current,
      categories: [...current.categories, { id: createId("category"), name, builtIn: false, collapsed: false, order: current.categories.length }],
    }));
    setNewCategoryName("");
    setSectionModalOpen(false);
  }

  function deleteFilter(filter: QuestFilter) {
    if (!window.confirm(`Delete the “${filter.name}” filter? It will also be removed from every quest.`)) return;
    setState((current) => ({
      ...current,
      filters: current.filters.filter((item) => item.id !== filter.id),
      quests: current.quests.map((quest) => ({ ...quest, filterIds: quest.filterIds.filter((id) => id !== filter.id) })),
    }));
    setDraft((current) => current ? { ...current, filterIds: current.filterIds.filter((id) => id !== filter.id) } : current);
    setSelectedFilterId((current) => current === filter.id ? "all" : current);
  }

  function toggleComplete(id: string) {
    const now = Date.now();
    const quest = state.quests.find((item) => item.id === id);
    if (quest && !quest.completed) {
      setCompletingQuestIds((current) => [...current, id]);
      window.setTimeout(() => {
        setState((current) => ({
          ...current,
          quests: current.quests.map((item) => item.id === id ? { ...item, completed: true, completedAt: now, updatedAt: now } : item),
        }));
        setCompletingQuestIds((current) => current.filter((item) => item !== id));
      }, 620);
      return;
    }
    setState((current) => ({
      ...current,
      quests: current.quests.map((item) => item.id === id ? { ...item, completed: false, completedAt: null, updatedAt: now } : item),
    }));
  }

  function deleteQuest(id: string) {
    if (!window.confirm("Permanently delete this quest?")) return;
    setState((current) => ({ ...current, quests: current.quests.filter((quest) => quest.id !== id) }));
  }

  function moveQuest(id: string, direction: -1 | 1) {
    setState((current) => {
      const quest = current.quests.find((item) => item.id === id);
      if (!quest) return current;
      const siblings = current.quests.filter((item) => item.categoryId === quest.categoryId).sort((a, b) => a.order - b.order);
      const index = siblings.findIndex((item) => item.id === id);
      const target = siblings[index + direction];
      if (!target) return current;
      return {
        ...current,
        quests: current.quests.map((item) => item.id === quest.id ? { ...item, order: target.order, updatedAt: Date.now() } : item.id === target.id ? { ...item, order: quest.order, updatedAt: Date.now() } : item),
      };
    });
  }

  function dropQuest(targetId: string) {
    if (!draggedQuestId || draggedQuestId === targetId) return;
    setState((current) => {
      const dragged = current.quests.find((quest) => quest.id === draggedQuestId);
      const target = current.quests.find((quest) => quest.id === targetId);
      if (!dragged || !target) return current;
      return {
        ...current,
        quests: current.quests.map((quest) => {
          if (quest.id === dragged.id) return { ...quest, categoryId: target.categoryId, order: target.order, updatedAt: Date.now() };
          if (quest.categoryId === target.categoryId && quest.order >= target.order) return { ...quest, order: quest.order + 1 };
          return quest;
        }),
      };
    });
    setDraggedQuestId(null);
  }

  function toggleCategory(id: string) {
    setState((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, collapsed: !category.collapsed } : category) }));
  }

  function deleteCategory(category: QuestCategory) {
    if (category.builtIn || !window.confirm(`Delete ${category.name}? Its quests will move to Side Quests.`)) return;
    setState((current) => ({
      ...current,
      categories: current.categories.filter((item) => item.id !== category.id),
      quests: current.quests.map((quest) => quest.categoryId === category.id ? { ...quest, categoryId: SIDE_CATEGORY_ID, updatedAt: Date.now() } : quest),
    }));
  }

  function exportArchive() {
    const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quest-index-${formatDateKey(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = normalizeImportedQuestState(JSON.parse(await file.text()));
      const merge = window.confirm("Merge this archive with your current quests? Select Cancel to choose replacement instead.");
      if (merge) setState((current) => mergeArchives(current, imported));
      else if (window.confirm("Replace the entire current Quest Index archive? This cannot be undone unless you exported a backup.")) setState(imported);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "This archive could not be imported.");
    }
  }

  function renderQuest(quest: Quest, showCategory = false) {
    return (
      <QuestCard
        key={quest.id}
        quest={quest}
        filters={state.filters}
        category={showCategory ? categoryMap.get(quest.categoryId) : undefined}
        onComplete={toggleComplete}
        onEdit={openEditQuest}
        onDelete={deleteQuest}
        onMove={moveQuest}
        onDragStart={setDraggedQuestId}
        onDrop={dropQuest}
        completing={completingQuestIds.includes(quest.id)}
      />
    );
  }

  const selectedDayQuests = selectedDate ? state.quests.filter((quest) => quest.date === selectedDate && !quest.completed).sort((a, b) => a.order - b.order) : [];

  return (
    <main className={styles.app}>
      <div className={styles.backdrop} aria-hidden="true" />
      <nav className={styles.topbar}>
        <Link href="/">Perkrucible</Link>
        <span className={styles.saveStatus}>{saveState === "loading" ? "Opening archive…" : saveState === "saving" ? "Saving…" : saveState === "backup" ? "Saved to backup" : "Archive saved"}</span>
        <div>
          <button type="button" onClick={exportArchive}>Export</button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>Import</button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={importArchive} />
        </div>
      </nav>

      <header className={styles.titleArea}>
        <Image src="/images/quest-index-title-v1.png" alt="Quest Index" width={1930} height={468} priority />
      </header>

      <section className={styles.ledger}>
        <span className={`${styles.frameCorner} ${styles.topLeft}`} aria-hidden="true" />
        <span className={`${styles.frameCorner} ${styles.topRight}`} aria-hidden="true" />
        <span className={`${styles.frameCorner} ${styles.bottomLeft}`} aria-hidden="true" />
        <span className={`${styles.frameCorner} ${styles.bottomRight}`} aria-hidden="true" />
        <span className={`${styles.frameEdge} ${styles.edgeTop}`} aria-hidden="true" />
        <span className={`${styles.frameEdge} ${styles.edgeBottom}`} aria-hidden="true" />
        <span className={`${styles.frameEdge} ${styles.edgeLeft}`} aria-hidden="true" />
        <span className={`${styles.frameEdge} ${styles.edgeRight}`} aria-hidden="true" />

        <div className={styles.tabBar} role="tablist" aria-label="Quest Index views">
          {(["all", "log", "calendar"] as Tab[]).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? styles.activeTab : ""} onClick={() => setActiveTab(tab)}>
              {tab === "all" ? "All Quests" : tab === "log" ? "Quest Log" : "Calendar"}
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <button className={styles.primaryAction} type="button" onClick={() => openCreateQuest()}>New Quest</button>
          {activeTab === "all" && (
            <>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the archive" aria-label="Search quests" />
              <select value={selectedFilterId} onChange={(event) => setSelectedFilterId(event.target.value)} aria-label="Filter quests">
                <option value="all">{state.filters.length ? "All filters" : "No filters created"}</option>
                {state.filters.map((filter) => <option value={filter.id} key={filter.id}>{filter.name}</option>)}
              </select>
              <button type="button" onClick={() => setFilterModalOpen(true)}>Manage Filters{state.filters.length ? ` (${state.filters.length})` : ""}</button>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sort quests">
                <option value="manual">Manual order</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="date">Calendar date</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
              <button type="button" className={showCompleted ? styles.activeControl : ""} onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "Completed archive" : "Active quests"}</button>
            </>
          )}
        </div>

        {activeTab === "all" && state.filters.length > 0 && (
          <div className={styles.filterLegend} aria-label="Available filters">
            {state.filters.map((filter) => (
              <button key={filter.id} type="button" className={selectedFilterId === filter.id ? styles.selectedFilter : ""} onClick={() => setSelectedFilterId(selectedFilterId === filter.id ? "all" : filter.id)}>
                <i style={{ "--dot-color": filter.color } as React.CSSProperties} />{filter.name}
              </button>
            ))}
          </div>
        )}

        {activeTab === "all" && (
          <section className={styles.viewPanel} aria-label={showCompleted ? "Completed quests" : "All active quests"}>
            <div className={styles.viewHeading}>
              <div><span className={styles.eyebrow}>{showCompleted ? "Archive" : "Current campaign"}</span><h1>{showCompleted ? "Completed Quests" : "All Quests"}</h1></div>
              <span>{visibleQuests.length} {visibleQuests.length === 1 ? "entry" : "entries"}</span>
            </div>
            <Image className={styles.divider} src="/images/quest-divider-v1.png" alt="" width={2048} height={166} />
            <div className={styles.questList}>
              {visibleQuests.map((quest) => renderQuest(quest, true))}
              {!visibleQuests.length && (
                <div className={styles.emptyState}>
                  <Image src="/images/quest-empty-state-v1.png" alt="A knight studying an empty quest scroll" width={823} height={1288} />
                  <div><h2>{showCompleted ? "No completed quests" : "The ledger is empty"}</h2><p>{showCompleted ? "Completed quests will be preserved here." : "Begin the campaign by creating a quest."}</p><button type="button" onClick={() => openCreateQuest()}>Create first quest</button></div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "log" && (
          <section className={styles.viewPanel}>
            <div className={styles.viewHeading}><div><span className={styles.eyebrow}>Categorized record</span><h1>Quest Log</h1></div></div>
            <div className={styles.categoryCreator}><button className={styles.primaryAction} type="button" onClick={() => setSectionModalOpen(true)}>Add Section</button></div>
            {!state.quests.some((quest) => !quest.completed) && <div className={styles.emptyState}><Image src="/images/quest-empty-state-v1.png" alt="A knight studying an empty quest scroll" width={823} height={1288} /><div><h2>The quest log is empty</h2><p>Create a quest and assign it to Main Quests, Side Quests, or a section of your own.</p><button type="button" onClick={() => openCreateQuest()}>Create first quest</button></div></div>}
            {sortedCategories(state.categories).map((category) => {
              const quests = state.quests.filter((quest) => quest.categoryId === category.id && !quest.completed).sort((a, b) => a.order - b.order);
              return (
                <article className={styles.categoryBlock} key={category.id}>
                  <header>
                    <button type="button" className={styles.categoryToggle} onClick={() => toggleCategory(category.id)} aria-expanded={!category.collapsed}>
                      <span>{category.collapsed ? "+" : "−"}</span><strong>{category.name}</strong><small>{quests.length}</small>
                    </button>
                    <div><button type="button" onClick={() => openCreateQuest("", category.id)}>Add quest</button>{!category.builtIn && <button type="button" onClick={() => deleteCategory(category)}>Delete</button>}</div>
                  </header>
                  {!category.collapsed && <div className={styles.questList}>{quests.map((quest) => renderQuest(quest))}{!quests.length && <p className={styles.categoryEmpty}>No active quests recorded in this section.</p>}</div>}
                </article>
              );
            })}
          </section>
        )}

        {activeTab === "calendar" && (
          <section className={styles.viewPanel}>
            <div className={styles.calendarHeader}>
              <button type="button" onClick={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>Previous</button>
              <div><span className={styles.eyebrow}>Campaign calendar</span><h1>{currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h1></div>
              <button type="button" onClick={() => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>Next</button>
            </div>
            <details className={styles.holidaySettings}>
              <summary>Holiday calendars</summary>
              <div>
                <label>Country<select value={state.holidaySettings.country} onChange={(event) => setState((current) => ({ ...current, holidaySettings: { ...current.holidaySettings, country: event.target.value, state: "" } }))}><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option><option value="AU">Australia</option></select></label>
                {state.holidaySettings.country === "US" && <label>State<input value={state.holidaySettings.state.toUpperCase()} maxLength={2} onChange={(event) => setState((current) => ({ ...current, holidaySettings: { ...current.holidaySettings, state: event.target.value.toLowerCase() } }))} /></label>}
                {(["public", "observance", "bank", "optional"] as const).map((type) => {
                  const labels = { public: "Public holidays", observance: "Major observances", bank: "Bank closures", optional: "Optional observances" };
                  const explanations = { public: "Official government holidays", observance: "Major cultural and religious observances", bank: "Dates when banks or offices may close", optional: "Observed by some regions or communities" };
                  return <label className={styles.typeToggle} key={type} title={explanations[type]}><input type="checkbox" checked={state.holidaySettings.types.includes(type)} onChange={() => setState((current) => ({ ...current, holidaySettings: { ...current.holidaySettings, types: current.holidaySettings.types.includes(type) ? current.holidaySettings.types.filter((item) => item !== type) : [...current.holidaySettings.types, type] } }))} />{labels[type]}</label>;
                })}
              </div>
            </details>
            <div className={styles.calendarGrid}>
              {WEEKDAYS.map((day) => <div className={styles.weekday} key={day}>{day}</div>)}
              {calendarDays.map((date) => {
                const key = formatDateKey(date);
                const quests = state.quests.filter((quest) => quest.date === key && !quest.completed);
                const holidays = holidaysByDate.get(key) || [];
                const outside = date.getMonth() !== currentMonth.getMonth();
                return (
                  <button type="button" key={key} onClick={() => setSelectedDate(key)} className={`${styles.dayCell} ${outside ? styles.outsideMonth : ""} ${selectedDate === key ? styles.selectedDay : ""}`}>
                    <span className={styles.dayNumber}>{date.getDate()}</span>
                    {holidays.slice(0, 1).map((holiday) => <small className={styles.holidayName} key={holiday}>{holiday}</small>)}
                    <span className={styles.dayMarkers}>{quests.slice(0, 4).map((quest) => <i key={quest.id} />)}</span>
                    {quests.length > 0 && <b>{quests.length}</b>}
                  </button>
                );
              })}
            </div>
            {selectedDate && (
              <section className={styles.dayExpansion}>
                <header><div><span className={styles.eyebrow}>Selected day</span><h2>{parseDateKey(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h2>{(holidaysByDate.get(selectedDate) || []).map((holiday) => <p key={holiday}>{holiday}</p>)}</div><div><button type="button" onClick={() => openCreateQuest(selectedDate)}>Add Quest</button><button type="button" onClick={() => setSelectedDate(null)}>Close</button></div></header>
                <div className={styles.questList}>{selectedDayQuests.map((quest) => renderQuest(quest, true))}{!selectedDayQuests.length && <p className={styles.categoryEmpty}>No active quests are assigned to this day.</p>}</div>
              </section>
            )}
          </section>
        )}
      </section>

      {draft && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setDraft(null)}>
          <section className={styles.questModal} role="dialog" aria-modal="true" aria-label={draft.id ? "Edit quest" : "Create quest"} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className={styles.eyebrow}>Quest record</span><h2>{draft.id ? "Edit Quest" : "New Quest"}</h2></div><button type="button" onClick={() => setDraft(null)}>Close</button></header>
            <label>Title<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={120} /></label>
            <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={4} /></label>
            <div className={styles.formRow}>
              <label>Quest section<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>{sortedCategories(state.categories).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Calendar date<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            </div>
            <fieldset className={styles.filterFieldset}>
              <legend>Filters</legend>
              <div className={styles.filterChoices}>{state.filters.map((filter) => <label key={filter.id}><input type="checkbox" checked={draft.filterIds.includes(filter.id)} onChange={() => setDraft({ ...draft, filterIds: draft.filterIds.includes(filter.id) ? draft.filterIds.filter((id) => id !== filter.id) : [...draft.filterIds, filter.id] })} /><i style={{ "--dot-color": filter.color } as React.CSSProperties} />{filter.name}</label>)}</div>
              <div className={styles.newFilterRow}>
                <input value={newFilterName} onChange={(event) => setNewFilterName(event.target.value)} placeholder="New filter name" />
                <div className={styles.colorChoices}>{FILTER_COLORS.map((color) => <button key={color} type="button" className={newFilterColor === color ? styles.selectedColor : ""} style={{ "--dot-color": color } as React.CSSProperties} onClick={() => setNewFilterColor(color)} aria-label={`Use ${color}`} />)}</div>
                <button type="button" onClick={createFilter}>Add Filter</button>
              </div>
            </fieldset>
            <footer><button type="button" onClick={() => setDraft(null)}>Cancel</button><button className={styles.primaryAction} type="button" onClick={saveDraft} disabled={!draft.title.trim()}>{draft.id ? "Save Changes" : "Enter Quest"}</button></footer>
          </section>
        </div>
      )}

      {sectionModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setSectionModalOpen(false)}>
          <section className={`${styles.questModal} ${styles.sectionModal}`} role="dialog" aria-modal="true" aria-label="Add quest section" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className={styles.eyebrow}>Quest Log</span><h2>Add Section</h2></div><button type="button" onClick={() => setSectionModalOpen(false)}>Close</button></header>
            <label>Section name<input autoFocus value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createCategory(); }} /></label>
            <footer><button type="button" onClick={() => setSectionModalOpen(false)}>Cancel</button><button className={styles.primaryAction} type="button" onClick={createCategory} disabled={!newCategoryName.trim()}>Add Section</button></footer>
          </section>
        </div>
      )}

      {filterModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setFilterModalOpen(false)}>
          <section className={`${styles.questModal} ${styles.filterModal}`} role="dialog" aria-modal="true" aria-label="Manage quest filters" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className={styles.eyebrow}>All Quests</span><h2>Manage Filters</h2></div><button type="button" onClick={() => setFilterModalOpen(false)}>Close</button></header>
            {state.filters.length > 0 ? <div className={styles.managedFilters}>{state.filters.map((filter) => <span key={filter.id}><i style={{ "--dot-color": filter.color } as React.CSSProperties} />{filter.name}<button type="button" onClick={() => deleteFilter(filter)} aria-label={`Delete ${filter.name} filter`}>Delete</button></span>)}</div> : <p className={styles.noFilters}>No filters have been created yet.</p>}
            <div className={styles.newFilterRow}>
              <input autoFocus value={newFilterName} onChange={(event) => setNewFilterName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createFilter(); }} placeholder="New filter name" />
              <div className={styles.colorChoices}>{FILTER_COLORS.map((color) => <button key={color} type="button" className={newFilterColor === color ? styles.selectedColor : ""} style={{ "--dot-color": color } as React.CSSProperties} onClick={() => setNewFilterColor(color)} aria-label={`Use ${color}`} />)}</div>
              <button className={styles.primaryAction} type="button" onClick={createFilter} disabled={!newFilterName.trim()}>Add Filter</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
