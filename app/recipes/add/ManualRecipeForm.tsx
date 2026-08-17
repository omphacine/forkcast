import { createRecipe } from "../actions";

export function ManualRecipeForm() {
  return (
    <form action={createRecipe} className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
      <input
        name="name"
        placeholder="Recipe name"
        required
        className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
      />
      <input
        name="mainIngredient"
        placeholder="Main ingredient (optional)"
        className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
      />
      <input
        name="cookingMethod"
        placeholder="Cooking method (optional)"
        className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
      />
      <div className="flex flex-wrap gap-3">
        <input
          name="sourceName"
          placeholder="Source: cookbook, website, etc. (optional)"
          className="min-w-[220px] flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
        />
        <input
          name="sourcePage"
          placeholder="Page (optional)"
          className="w-28 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
        />
      </div>
      <label className="text-base text-foreground/60">
        Ingredients (one per line)
        <textarea
          name="ingredients"
          rows={5}
          placeholder={"2 cups flour\n1 tsp salt\n..."}
          className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
        />
      </label>
      <label className="text-base text-foreground/60">
        Instructions (optional)
        <textarea
          name="instructions"
          rows={4}
          className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
        />
      </label>
      <button
        type="submit"
        className="self-start rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90"
      >
        Create
      </button>
    </form>
  );
}
