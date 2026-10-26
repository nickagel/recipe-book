---
name: add-recipe
description: Add a new recipe to the recipe book from a URL or pasted text. Use when the user asks to add, import, or create a recipe.
---

# Add a recipe

1. Get the recipe source (fetch the URL, or use text the user provided).
2. Pick a short, blunt, descriptive name (see Naming) and its kebab-case slug, e.g. `Yellow Layer Cake` → `yellow-layer-cake`. Ensure `recipes/<slug>/` doesn't already exist.
3. Create the three files below in `recipes/<slug>/`.
4. Append the slug to the JSON array in `recipes/index.json` (exact case; folder name must match).
5. Verify: `make start`, open `http://localhost:8000/#/<slug>`, confirm it renders and appears in search, then `make stop`.

## Naming

Name the recipe for what it is, not how the source markets it. The slug is the title in kebab-case.

- Drop hype and filler: best, ultimate, perfect, easy, quick, simple, classic, authentic, homemade, gourmet, famous, marvelous, "the", "my favorite", "world's", "melt in your mouth", "just like X", "million dollar".
- Never include the source site or author (no `-sallys-baking`, `-allrecipes`).
- Drop number-of-ingredients prefixes ("3-Ingredient").
- Prefer the plain dish name in English: `Chicken Marinade`, `Pumpkin Pie`, `Jollof Rice`, `Grilled Rice Balls` (not `Yaki Onigiri`).
- Replace vague brand-ish names with what's in it: `Million Dollar Fudge` → `Chocolate Nut Fudge`.
- Keep a descriptor only if it changes what the dish is (`Whole Wheat Mac and Cheese`, `Cacio e Pepe Risotto`), not if it's just praise (`Fluffy`, `Crispy`).
- If the name collides with an existing recipe, add the real difference (main ingredient, method, or variation), e.g. `Cacio e Pepe with Parmesan` — never the site name.

## description.yml

Flat YAML only (the site uses a minimal parser — no nesting or multi-line values).

```yaml
title: Yellow Layer Cake
description: One sentence summary.
tags: [scones, ham, cheese, breakfast]
category: Breakfast
preheat: 400°F (204°C)
cook_time: 22–25 minutes
url: https://example.com/source-recipe/
```

- `preheat` / `cook_time`: use `null` if not applicable (e.g. no oven); null fields are hidden on the site.
- `chill` / `yield`: optional, e.g. `chill: at least 3 hours, preferably overnight`, `yield: 14–15 large cookies`. Omit if not given.
- `url`: the source page. Not shown on the site; used to pull future updates.
- `images`: optional. Files live in `recipes/<slug>/images/`; list filenames in display order, e.g. `images: [finished.jpg, step-2.jpg]`. Omit if there are no photos. Only add photos the user provides — don't download images from the source site.
- `category`: one word/phrase, e.g. Breakfast, Dinner, Dessert, Side, Snack.

## measurements.csv

Header row `amount,ingredient`, one ingredient per row. Quote any field containing a comma.

- Butter and cheese: always include grams in parentheses after the amount, e.g. `2 tbsp (28g)`, `1 cup (113g)` shredded cheddar. Use butter 1 tbsp = 14g / 1 cup = 227g; shredded cheese ~113g per cup; finely grated hard cheese ~100g per cup; 1 oz = 28g. Skip for `to taste` / `as needed` / `optional`.
- Pounds: always add grams in parentheses, e.g. `2 lb (907g)`, `4 lb (1.8kg)` (1 lb = 454g; use kg above 1000g). Applies in instructions too.

```csv
amount,ingredient
2 cups (250g),"all-purpose flour, plus more for work surface"
1/2 tsp,salt
optional,flaky sea salt for topping
```

## instructions.csv

Header row `step`, one step per row, in order. Quote every step.

```csv
step
"Whisk the dry ingredients together."
"Bake 22–25 minutes until golden brown."
```

- Write steps in your own concise words — don't copy the source's prose verbatim.
- Omit storage notes, tips, and affiliate links.
