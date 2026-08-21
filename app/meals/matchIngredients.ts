// Best-effort matching between a recipe ingredient's free-text name (e.g.
// "6 ounces cheddar cheese, (shredded)") and a food inventory item's
// free-text name (e.g. "Schnucks - Shredded Parmesan Cheese Cup"). Neither
// side has structured quantities/units, so this is a starting point for the
// user to review and correct, never applied without confirmation.
const UNIT_WORDS = new Set([
  "cup", "cups", "oz", "ounce", "ounces", "tsp", "teaspoon", "teaspoons",
  "tbsp", "tablespoon", "tablespoons", "lb", "lbs", "pound", "pounds",
  "can", "cans", "package", "packages", "bag", "bags", "clove", "cloves",
  "slice", "slices", "piece", "pieces", "jar", "jars", "box", "boxes",
  "of", "and", "a", "an", "the", "to", "taste", "large", "small",
  "medium", "fresh", "chopped", "diced", "minced", "sliced", "cut",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[0-9/¼½¾⅓⅔.,-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !UNIT_WORDS.has(w));
}

export function findBestInventoryMatch(
  ingredientName: string,
  inventoryItems: { id: number; name: string }[],
): number | null {
  const ingredientWords = new Set(significantWords(ingredientName));
  if (ingredientWords.size === 0) return null;

  let bestId: number | null = null;
  let bestScore = 0;
  for (const item of inventoryItems) {
    const itemWords = significantWords(item.name);
    let score = 0;
    for (const w of itemWords) {
      if (ingredientWords.has(w)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = item.id;
    }
  }
  return bestScore > 0 ? bestId : null;
}
