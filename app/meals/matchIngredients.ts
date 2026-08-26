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

function containsAll(inner: Set<string>, outer: Set<string>): boolean {
  for (const w of inner) {
    if (!outer.has(w)) return false;
  }
  return true;
}

// A short name matching into a much longer, unrelated one is exactly how
// false positives happen — e.g. a plain "Onion" ingredient line matching a
// six-word "Condensed French Onion Soup with Beef" inventory item purely
// because it contains the word "onion". So when the INVENTORY ITEM is the
// longer side, cap how many extra words it's allowed beyond the ingredient.
// Recipe ingredient lines are naturally wordy on their own (prep
// instructions, "for serving", quantities), so when the INGREDIENT is the
// longer side, that's not penalized the same way — what matters there is
// just that every word of the (already pared-down) item name shows up
// somewhere in the ingredient line.
const MAX_ITEM_EXTRA_WORDS = 1;

export function findBestInventoryMatch(
  ingredientName: string,
  inventoryItems: { id: number; name: string }[],
): number | null {
  const ingredientWords = wordSet(ingredientName);
  if (ingredientWords.size === 0) return null;

  let bestId: number | null = null;
  let bestOverlap = 0;

  for (const item of inventoryItems) {
    const itemWords = wordSet(item.name);
    if (itemWords.size === 0) continue;

    let matches: boolean;
    if (itemWords.size <= ingredientWords.size) {
      matches = containsAll(itemWords, ingredientWords);
    } else {
      matches =
        containsAll(ingredientWords, itemWords) &&
        itemWords.size - ingredientWords.size <= MAX_ITEM_EXTRA_WORDS;
    }
    if (!matches) continue;

    // Among qualifying items, prefer the one with the larger overlap — the
    // more specific/word-rich match (e.g. an exact "Carrots" over some
    // unrelated item that merely happens to also contain the word).
    const overlap = Math.min(itemWords.size, ingredientWords.size);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestId = item.id;
    }
  }

  return bestId;
}
