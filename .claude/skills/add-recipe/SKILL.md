---
name: add-recipe
description: Add a new recipe to the recipe book from a URL or pasted text. Use when the user asks to add, import, or create a recipe.
---

# Add a recipe

1. Get the recipe source (fetch the URL, or use text the user provided).
2. Pick a kebab-case slug from the title, e.g. `ham-cheese-scones`. Ensure `recipes/<slug>/` doesn't already exist.
3. Create the three files below in `recipes/<slug>/`.
4. Append the slug to the JSON array in `recipes/index.json` (exact case; folder name must match).
5. Verify: `make start`, open `http://localhost:8000/#/<slug>`, confirm it renders and appears in search, then `make stop`.

## description.yml

Flat YAML only (the site uses a minimal parser — no nesting or multi-line values).

```yaml
title: Ham & Cheese Scones
description: One sentence summary.
tags: [scones, ham, cheese, breakfast]
category: Breakfast
preheat: 400°F (204°C)
cook_time: 22–25 minutes
url: https://example.com/source-recipe/
```

- `preheat` / `cook_time`: use `null` if not applicable (e.g. no oven); null fields are hidden on the site.
- `url`: the source page. Not shown on the site; used to pull future updates.
- `images`: optional. Files live in `recipes/<slug>/images/`; list filenames in display order, e.g. `images: [finished.jpg, step-2.jpg]`. Omit if there are no photos. Only add photos the user provides — don't download images from the source site.
- `category`: one word/phrase, e.g. Breakfast, Dinner, Dessert, Side, Snack.

## measurements.csv

Header row `amount,ingredient`, one ingredient per row. Quote any field containing a comma.

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
