"use client";

import { useState } from "react";
import Image from "next/image";
import { TypingText } from "../components/TypingText";
import styles from "./cocktail.module.css";

type Recipe = {
  ingredients: string[];
  instructions?: string[];
};

type Drink = {
  name: string;
  image: string;
  standard: Recipe;
  poorMans?: Recipe;
};

const drinks: Drink[] = [
  {
    name: "Butterbeer",
    image: "/images/butterbeer-photo-v2.png",
    standard: {
      ingredients: [
        "2 liters cream soda, chilled",
        "¼ teaspoon caramel extract",
        "¼ teaspoon butter extract",
        "1 cup heavy whipping cream",
        "½ cup butterscotch topping",
        "¼ cup powdered sugar",
        "Optional: 1 ounce whiskey or bourbon.",
      ],
      instructions: [
        "Mix the cream soda with the caramel and butter extracts.",
        "Whip the heavy cream. Add the butterscotch topping and powdered sugar, then mix to combine.",
        "Spoon the butterscotch cream over the butterbeer. Serve and enjoy.",
      ],
    },
  },
  {
    name: "Amaretto Sour",
    image: "/images/amaretto-sour-photo.png",
    standard: {
      ingredients: [
        "1½ ounces Amaretto (Disaronno Originale recommended)",
        "¾ ounce lemon juice",
        "½ ounce simple syrup",
        "1 chicken egg white",
        "2–3 dashes bitters",
        "Optional: maraschino cherry and lemon wedge",
      ],
      instructions: [
        "Add the Amaretto, lemon juice, simple syrup, and egg white to a cocktail shaker. Dry shake.",
        "Add ice and shake again.",
        "Strain into a glass with ice and finish with a couple of dashes of bitters.",
      ],
    },
    poorMans: {
      ingredients: [
        "1½ ounces Amaretto (Disaronno Originale recommended)",
        "¾ ounce lime margarita mix (Tres Agaves Citrus Margarita Mix recommended)",
      ],
      instructions: ["Shake it up with some ice."],
    },
  },
  {
    name: "Corona Sunrise",
    image: "/images/corona-sunrise-photo-v2.png",
    standard: {
      ingredients: [
        "1 bottle Corona Familiar (12 oz)",
        "1 oz grenadine",
        "2 oz tequila",
        "2 oz orange juice",
      ],
      instructions: ["Give it a mix."],
    },
    poorMans: {
      ingredients: [
        "1 bottle Corona Familiar (12 oz)",
        "1 oz grenadine",
      ],
      instructions: ["Give it a mix."],
    },
  },
];

export default function Page() {
  const [pourMode, setPourMode] = useState<Record<string, boolean>>({});

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <h1><TypingText text="Cocktail Cabinet" /></h1>
      </header>

      <section className={styles.collection} aria-label="Cocktail recipes">
        {drinks.map((drink) => {
          const isPourMode = Boolean(pourMode[drink.name]);
          const recipe = isPourMode && drink.poorMans ? drink.poorMans : drink.standard;
          return (
          <div className={styles.drinkFrame} key={drink.name}>
          {drink.poorMans && <div className={styles.pourControl}>
            <button
              className={styles.pourButton}
              type="button"
              onClick={() => setPourMode((current) => ({ ...current, [drink.name]: !current[drink.name] }))}
              aria-pressed={isPourMode}
            >
              {isPourMode ? "DISABLE POOR MODE" : "ENABLE POOR MODE"}
              <span className={styles.info} tabIndex={0} aria-label="Poor Mode information">
                i
                <span className={styles.tooltip} role="tooltip">
                  {isPourMode ? "Returns to the standard recipe." : "Switches this recipe to its poor man's version."}
                </span>
              </span>
            </button>
          </div>}
          <details className={styles.drink}>
            <summary className={styles.summary}>
              <div className={styles.imagePlaceholder} aria-hidden="true">
                <Image className={styles.imagePhoto} src={drink.image} alt="" fill sizes="(max-width: 680px) 100vw, 35vw" />
              </div>
              <div className={styles.drinkTitle}>
                <span className={styles.name}>{drink.name}</span>
                {isPourMode && <span className={styles.poorModeBanner}>Poor mode enabled</span>}
                <span className={styles.expand}>OPEN RECIPE</span>
              </div>
            </summary>
            <div className={styles.recipe}>
              <section>
                <h2>INGREDIENTS</h2>
                <ul>{recipe.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul>
              </section>
              <section>
                <h2>INSTRUCTIONS</h2>
                {recipe.instructions ? (
                  <ol>{recipe.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
                ) : (
                  <p className={styles.pendingInstructions}>Instructions not provided yet.</p>
                )}
              </section>
            </div>
          </details>
          </div>
          );
        })}
      </section>
      <p className={styles.endNote}>END OF CURRENT INVENTORY / MORE MATERIAL MAY APPEAR</p>
    </main>
  );
}
