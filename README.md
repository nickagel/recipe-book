# recipe-book

Static recipe search site for GitHub Pages (Settings → Pages → deploy from branch, root folder).

## Adding a recipe

1. Create `recipes/<slug>/` with `description.yml`, `measurements.csv`, `instructions.csv` (CSV files have a header row).
2. Run `make index` to rebuild `recipes/index.json`.
3. Optional photos: put them in `recipes/<slug>/images/` and list the filenames in `description.yml`, e.g. `images: [finished.jpg, step-2.jpg]`.

The `url` in `description.yml` is not shown on the site; it records the source to pull recipe updates from.

Preview locally: `make start` then open http://localhost:8000 (`make stop` to stop).