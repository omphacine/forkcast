// Fixed list (not free text like Main Ingredient/Cooking Method) so recipes
// group cleanly instead of accumulating near-duplicates like "Side" vs "Side Dish".
export const MEAL_TYPES = [
  "Breakfast",
  "Appetizer",
  "Salad",
  "Soup",
  "Main Dish",
  "Side Dish",
  "Dessert",
  "Snack",
  "Beverage",
  "Sauce/Condiment",
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export function isMealType(value: string): value is MealType {
  return (MEAL_TYPES as readonly string[]).includes(value);
}
