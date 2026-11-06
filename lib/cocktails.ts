export type Recipe = { ingredients: string[]; instructions: string[] };
export type Drink = { id?: string; name: string; image: string; standard: Recipe; poorMans?: Recipe };

export const starterDrinks: Drink[] = [
  { name: "Butterbeer", image: "/images/butterbeer-photo-v2.png", standard: {
    ingredients: ["2 liters cream soda, chilled", "¼ teaspoon caramel extract", "¼ teaspoon butter extract", "1 cup heavy whipping cream", "½ cup butterscotch topping", "¼ cup powdered sugar", "Optional: 1 ounce whiskey or bourbon."],
    instructions: ["Mix the cream soda with the caramel and butter extracts.", "Whip the heavy cream. Add the butterscotch topping and powdered sugar, then mix to combine.", "Spoon the butterscotch cream over the butterbeer. Serve and enjoy."],
  } },
  { name: "Amaretto Sour", image: "/images/amaretto-sour-photo.png", standard: {
    ingredients: ["1½ ounces Amaretto (Disaronno Originale recommended)", "¾ ounce lemon juice", "½ ounce simple syrup", "1 chicken egg white", "2–3 dashes bitters", "Optional: maraschino cherry and lemon wedge"],
    instructions: ["Add the Amaretto, lemon juice, simple syrup, and egg white to a cocktail shaker. Dry shake.", "Add ice and shake again.", "Strain into a glass with ice and finish with a couple of dashes of bitters."],
  }, poorMans: { ingredients: ["1½ ounces Amaretto (Disaronno Originale recommended)", "¾ ounce lime margarita mix (Tres Agaves Citrus Margarita Mix recommended)"], instructions: ["Shake it up with some ice."] } },
  { name: "Corona Sunrise", image: "/images/corona-sunrise-photo-v2.png", standard: {
    ingredients: ["1 bottle Corona Familiar (12 oz)", "1 oz grenadine", "2 oz tequila", "2 oz orange juice"], instructions: ["Give it a mix."]
  }, poorMans: { ingredients: ["1 bottle Corona Familiar (12 oz)", "1 oz grenadine"], instructions: ["Give it a mix."] } },
];
