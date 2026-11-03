---
name: add-photo
description: Add a photo to an existing recipe from a local image file (HEIC, PNG, JPG, etc.), converting it to a web-ready JPG. Use when the user asks to add, attach, or replace a recipe photo, or to convert existing photos to JPG.
---

# Add a photo to a recipe

All photos on the site are JPGs. Browsers other than Safari can't display HEIC, and PNG/WebP phone exports are much larger, so always convert before committing.

1. Identify the recipe slug (`recipes/<slug>/` must exist) and the source image path. Expand `~`; if the user gives `/Downloads/...`, it is `~/Downloads/...`. Only use photos the user provides — don't download images from the source site.
2. Pick the output name: `finished.jpg` for the main photo, `step-2.jpg`, `step-3.jpg`, etc. for others. Don't overwrite an existing file unless the user asked to replace it.
3. Convert to JPG (see Converting) into `recipes/<slug>/images/`, creating the folder if needed.
4. Add the filename to `images:` in `recipes/<slug>/description.yml`, main photo first, e.g. `images: [finished.jpg, step-2.jpg]`. Flat YAML only; keep the line after `url:`.
5. Run `make format` and `make index`.
6. Verify: `make start`, open `http://localhost:8000/#/<slug>`, confirm the photo renders in the frame above the measurements and opens full size when clicked, then `make stop`. The browser caches `style.css`/`app.js`, so hard refresh if the page looks stale.

## Converting

Target: JPG, longest side at most 1600px (never upscale), quality 85, rotation applied, metadata removed (the repo is public; phone photos carry camera model and sometimes GPS).

Preferred (ImageMagick, handles HEIC/HEIF/PNG/WebP/TIFF/GIF/BMP and strips metadata):

```sh
mkdir -p recipes/<slug>/images
magick "<source>" -auto-orient -resize '1600x1600>' -strip -quality 85 recipes/<slug>/images/finished.jpg
```

Fallback if `magick` isn't installed (macOS built-in; keeps EXIF, so mention that to the user):

```sh
sips -s format jpeg -s formatOptions 85 -Z 1600 "<source>" --out recipes/<slug>/images/finished.jpg
```

Notes:

- A source that is already a JPG still goes through the same command, to resize, orient, and strip it.
- For a multi-frame source (animated GIF, Live Photo), only the first frame is used; add `[0]` after the source path with `magick` if it outputs several files.
- Check the result with `ls -la recipes/<slug>/images/`; a typical photo is a few hundred KB. If it's over about 1 MB, lower the quality or size.
- Don't zip photos or commit the original HEIC.

## Convert every existing photo to JPG

Use this when asked to normalise all photos, or when `images:` lists non-JPG files.

1. Find non-JPG photos:

   ```sh
   find recipes -path '*/images/*' -type f ! -iname '*.jpg'
   ```

2. For each file, convert it next to the original with a `.jpg` extension using the command above (output `<same-name>.jpg`; if `<same-name>.jpg` already exists, ask before overwriting).
3. Update each affected `description.yml` so `images:` lists the `.jpg` names instead.
4. Delete the old non-JPG files only after the new JPGs exist and are listed in `description.yml`. Deleting files is destructive, so confirm with the user first.
5. Also rename any `.jpeg`/`.JPG` files to lowercase `.jpg` and update `images:` to match, since URLs on GitHub Pages are case-sensitive.
6. Run `make format` and `make index`, then verify a few recipes in the browser as above.
