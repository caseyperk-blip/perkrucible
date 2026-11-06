"use client";

import { useCallback, useEffect, useState } from "react";
import type { Drink, Recipe } from "@/lib/cocktails";
import styles from "./cocktail.module.css";

type Editor = { drink: Drink | null };
const blankRecipe: Recipe = { ingredients: [], instructions: [] };

export default function Page() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [pourMode, setPourMode] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [hasPoorMode, setHasPoorMode] = useState(false);
  const [poorIngredients, setPoorIngredients] = useState("");
  const [poorInstructions, setPoorInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/cocktails", { cache: "no-store" });
    if (!response.ok) throw new Error("The Cocktail Cabinet could not be loaded.");
    const data = await response.json() as { drinks: Drink[]; canEdit: boolean };
    setDrinks(data.drinks); setCanEdit(data.canEdit);
  }, []);
  useEffect(() => { void load().catch(() => setError("The Cocktail Cabinet could not be reached.")); }, [load]);

  function openEditor(drink: Drink | null = null) {
    setEditor({ drink }); setError(""); setName(drink?.name ?? ""); setImage(drink?.image ?? "");
    setIngredients(drink?.standard.ingredients.join("\n") ?? "");
    setInstructions(drink?.standard.instructions.join("\n") ?? "");
    setHasPoorMode(Boolean(drink?.poorMans)); setPoorIngredients(drink?.poorMans?.ingredients.join("\n") ?? "");
    setPoorInstructions(drink?.poorMans?.instructions.join("\n") ?? "");
  }

  async function saveDrink() {
    const split = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);
    const standard = { ingredients: split(ingredients), instructions: split(instructions) };
    const poorMans = hasPoorMode ? { ingredients: split(poorIngredients), instructions: split(poorInstructions) } : null;
    if (!name.trim() || !standard.ingredients.length || !standard.instructions.length || (poorMans && (!poorMans.ingredients.length || !poorMans.instructions.length))) {
      setError("Fill in the cocktail name, ingredients, and instructions before saving."); return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/cocktails", { method: editor?.drink ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editor?.drink?.id, name, image, standard, poorMans }) });
      if (!response.ok) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new Error(data?.error ?? "The cocktail could not be saved."); }
      setEditor(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The cocktail could not be saved."); }
    finally { setBusy(false); }
  }

  async function deleteDrink(drink: Drink) {
    if (!drink.id || !confirm(`Delete “${drink.name}”?`)) return;
    const response = await fetch("/api/cocktails", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: drink.id }) });
    if (!response.ok) { setError("The cocktail could not be deleted."); return; }
    await load();
  }

  return (
    <main className={styles.page}>
      <h1 className="visually-hidden">Cocktail Cabinet</h1>
      {error && <p className={styles.editorError} role="alert">{error}</p>}
      {canEdit && <button className={styles.addDrink} type="button" onClick={() => openEditor()}>ADD A COCKTAIL +</button>}
      <section className={styles.collection} aria-label="Cocktail recipes">
        {drinks.map((drink) => {
          const isPourMode = Boolean(pourMode[drink.id ?? drink.name]);
          const recipe = isPourMode && drink.poorMans ? drink.poorMans : drink.standard;
          const key = drink.id ?? drink.name;
          return <div className={styles.drinkFrame} key={key}>
            {canEdit && <div className={styles.editControls}><button type="button" onClick={() => openEditor(drink)}>EDIT</button><button type="button" onClick={() => void deleteDrink(drink)}>DELETE</button></div>}
            {drink.poorMans && <div className={styles.pourControl}><button className={styles.pourButton} type="button" onClick={() => setPourMode((current) => ({ ...current, [key]: !current[key] }))} aria-pressed={isPourMode}>{isPourMode ? "DISABLE POOR MODE" : "ENABLE POOR MODE"}<span className={styles.info} tabIndex={0} aria-label="Poor Mode information">i<span className={styles.tooltip} role="tooltip">{isPourMode ? "Returns to the standard recipe." : "Switches this recipe to its poor man's version."}</span></span></button></div>}
            <details className={styles.drink}>
              <summary className={styles.summary}>
                <div className={styles.imagePlaceholder} aria-hidden="true">{drink.image && <img className={styles.imagePhoto} src={drink.image} alt="" />}</div>
                <div className={styles.drinkTitle}><span className={styles.name}>{drink.name}</span>{isPourMode && <span className={styles.poorModeBanner}>Poor mode enabled</span>}<span className={styles.expand}>OPEN RECIPE</span></div>
              </summary>
              <div className={styles.recipe}><section><h2>INGREDIENTS</h2><ul>{recipe.ingredients.map((ingredient, index) => <li key={`${index}-${ingredient}`}>{ingredient}</li>)}</ul></section><section><h2>INSTRUCTIONS</h2><ol>{recipe.instructions.map((instruction, index) => <li key={`${index}-${instruction}`}>{instruction}</li>)}</ol></section></div>
            </details>
          </div>;
        })}
      </section>
      <p className={styles.endNote}>END OF CURRENT INVENTORY / MORE MATERIAL MAY APPEAR</p>
      {editor && <div className={styles.editorBackdrop} onMouseDown={() => setEditor(null)}><section className={styles.editor} role="dialog" aria-modal="true" aria-label={editor.drink ? "Edit cocktail" : "Add cocktail"} onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>{editor.drink ? "EDIT COCKTAIL" : "ADD COCKTAIL"}</h2><button type="button" onClick={() => setEditor(null)} aria-label="Close">×</button></header>
        <label>Cocktail name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Image path (optional)<input placeholder="/images/your-cocktail.png" value={image} onChange={(event) => setImage(event.target.value)} /></label>
        <div className={styles.editorColumns}><label>Ingredients, one per line<textarea rows={6} value={ingredients} onChange={(event) => setIngredients(event.target.value)} /></label><label>Instructions, one step per line<textarea rows={6} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label></div>
        <label className={styles.poorToggle}><input type="checkbox" checked={hasPoorMode} onChange={(event) => setHasPoorMode(event.target.checked)} /> Include Poor Mode recipe</label>
        {hasPoorMode && <div className={styles.editorColumns}><label>Poor Mode ingredients<textarea rows={4} value={poorIngredients} onChange={(event) => setPoorIngredients(event.target.value)} /></label><label>Poor Mode instructions<textarea rows={4} value={poorInstructions} onChange={(event) => setPoorInstructions(event.target.value)} /></label></div>}
        {error && <p className={styles.editorError} role="alert">{error}</p>}
        <footer><button type="button" onClick={() => setEditor(null)}>CANCEL</button><button type="button" disabled={busy} onClick={() => void saveDrink()}>{busy ? "SAVING…" : "SAVE COCKTAIL"}</button></footer>
      </section></div>}
    </main>
  );
}
