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
  "for", "or", "your", "choice", "optional", "divided", "plus", "more",
  "if", "desired", "needed", "serving", "servings", "into", "with",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[0-9/¼½¾⅓⅔.,-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !UNIT_WORDS.has(w));
}

// Light de-pluralization so "breasts"/"breast", "onions"/"onion",
// "tomatoes"/"tomato" etc. compare equal — the two sides of a match rarely
// use the exact same grammatical number ("2 diced onions" vs. an inventory
// item just called "Onion").
function stem(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
  if (/(?:[sxz]|ch|sh)es$/.test(word) && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

function wordSet(text: string): Set<string> {
  return new Set(significantWords(text).map(stem));
}

// How many of the inventory item's words can go unexplained by the
// ingredient line before the match is too loose to trust — scaled by the
// actual word overlap (not by which side happens to be longer): two real
// shared words ("italian", "sausage") earns more benefit of the doubt than
// one. Capped overall so it never becomes unbounded.
function maxUnexplainedItemWords(sharedWordCount: number): number {
  return Math.min(sharedWordCount, 3);
}

export function findBestInventoryMatch(
  ingredientName: string,
  inventoryItems: { id: number; name: string }[],
): number | null {
  const ingredientWords = wordSet(ingredientName);
  if (ingredientWords.size === 0) return null;

  let bestId: number | null = null;
  let bestShared = 0;
  let bestUnexplained = Infinity;

  for (const item of inventoryItems) {
    const itemWords = wordSet(item.name);
    if (itemWords.size === 0) continue;

    let shared = 0;
    for (const w of ingredientWords) {
      if (itemWords.has(w)) shared++;
    }
    if (shared === 0) continue;

    const onlyIngredient = ingredientWords.size - shared;
    const onlyItem = itemWords.size - shared;

    // A single shared word is only trustworthy on its own when at least one
    // side is ENTIRELY that word — otherwise it's just a coincidence (e.g.
    // "coconut milk" and "Whole Milk" share only "milk", but "coconut" and
    // "whole" are both real, unexplained qualifiers on either side, and the
    // two are different products). "milk" alone matching "Whole Milk" is
    // fine (nothing left unexplained on the ingredient's side); "Carrots"
    // matching a "carrots" ingredient over "Peas & Carrots" is fine for the
    // same reason (nothing left unexplained on the item's side).
    if (shared === 1 && onlyIngredient > 0 && onlyItem > 0) continue;

    if (onlyItem > maxUnexplainedItemWords(shared)) continue;

    // Among qualifying items, prefer the most shared words first, then —
    // when that ties — the item that leaves the least unexplained overall.
    // A bare "Carrots" ingredient ties "Carrots" and "Peas & Carrots" at one
    // shared word each; without this, whichever happened to be checked
    // first won arbitrarily. Preferring the smaller leftover picks the
    // exact match ("Carrots", nothing left over) over the coincidental one
    // ("Peas & Carrots" still has "peas" unaccounted for).
    const unexplained = onlyIngredient + onlyItem;
    if (shared > bestShared || (shared === bestShared && unexplained < bestUnexplained)) {
      bestShared = shared;
      bestUnexplained = unexplained;
      bestId = item.id;
    }
  }

  return bestId;
}
