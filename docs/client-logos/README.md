# Regenerated client logo assets

The 21 client identities were identified from the owner's 2026 CPW Catalog, page 24, then checked against official brand sources. The catalog file was verified against Dropbox content hash `d29d9522974dfc9be754c9814ce587d6be2cff51da69c8cc5025ab064085ac59`.

At the owner's request, the website now uses individually regenerated, clean artwork rather than PDF screenshot crops. Each asset was produced with the built-in ImageGen tool, using the catalog-era identity as reference and official web research to verify the brand. These are regenerated reproductions, not official downloaded master artwork.

- `source/*.png`: selected high-resolution generated artwork, including the transparent black ICONSIAM variant.
- `source/sources-auto.json`: automotive and Krungthai sources and exact prompts.
- `source/sources-property.json`: property and bank sources and exact prompts.
- `source/sources-root.json`: remaining brand sources and exact prompts.
- `source/sources-iconsiam.json`: prompt and source for the readable transparent ICONSIAM variant.
- `../../public/website/clients/*.webp`: production files, alpha-trimmed and resized to at most 600 x 260 pixels, encoded losslessly.
- `../../src/website/clientLogos.json`: accessible names, production dimensions and filenames (kept in source so Vite can import it in development and builds).

Unnecessary paper, screenshot borders and catalog textures have been removed. Intentional parts of the identities remain: Cafe Amazon's green badge and white outline, SCB's purple disk, and SAVVI / The Urban Property's brand panels. Other marks have transparent surroundings. The logo strip uses normal color compositing without a blend mode.

High-resolution source PNGs are kept here so they are reviewable without shipping every raw generation in the published website. Brand marks remain the property of their respective owners.
