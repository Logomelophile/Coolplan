# Release verification — SPC Plank Viewer 1.0.0

Validation date: 12 October 2026. This report covers the supplied seven-product catalog, standalone library, Web Component, optional React adapter, and responsive demonstration site. All four requested phases were completed in one run under the subsequent user instruction.

## Definition of Done

| Requirement | Result | Evidence and scope |
| --- | --- | --- |
| Install and run without binary assets | Pass | Procedural maps, generated thumbnails, and built-in studio environment. Browser loads with no required image/model/HDR downloads and no console errors. |
| 1220 × 180 × 5.3 mm and correct layer sum | Pass | Geometry tests cover all seven products. Measured X/Y/Z bounds are 122/0.53/18 cm within floating-point tolerance; layer sum is 5.3 mm. |
| Seven recognizable finishes | Pass, visual approximation | All seven renders reviewed for palette, grain character, knots, relief, and sheen. Procedural patterns do not reproduce the reference photographs pixel for pixel. |
| Grey core, black backing, appropriate foam patterns | Pass | Physical profile and underside captures inspected. The six cross-hatch finishes use a physically repeated diamond texture; Walnut uses pebble. |
| All seven cameras, stack, and click profile | Pass | Browser integration visits all seven presets. Three shared-resource stack copies, perspective transitions, orthographic top/profile framing, and mobile profile bounds checked. |
| Click/hover, TH/EN leaders, lift/stair | Pass | Real pointer click, blank-space reset, hover selection, layer visibility, locale, keyboard, and both separation modes checked. Leader overlay occupies the whole canvas despite host icon styles. |
| Data-only product/layer extension | Pass | A custom catalog product with a fifth coating is instantiated without viewer changes. Five labels and a 5.5 mm test stack are verified. Demo selector and counts derive from the catalog. The supplied seven products remain 5.3 mm. |
| Plain HTML Web Component and React wrapper | Pass | Built ES module loads without import maps. Attributes, removal/reconnection, and React mount checked. Next.js integration is documented; a separate Next.js application was not executed. |
| Resize, cleanup, and frame rate | Pass for behavior; performance qualified | Responsive canvas and PNG export checked. Repeated product changes settle at stable resource counts; disposal removes the canvas. Measured frame rates and environment are recorded below; 60 fps is not guaranteed on every device. |

## Executed checks

- `npm run build`: strict TypeScript validation, standalone ES module, declarations, and static production demo.
- `npm test`: five passing tests covering animation time clamping, seven-product dimensions/finite geometry, fifth-layer bounds, deterministic surface families, and neutral normals for flat heights.
- `npm run test:browser`: seven-product switching; seven camera presets; stack/explode/selection/visibility; TH/EN; texture/geometry count stability; resize; screenshot; disposal; React; mobile overflow; browser errors.
- `node tests/advanced-browser.mjs`: actual canvas pointer/keyboard/zoom input; idle rotation; mobile profile; fifth layer; explicit albedo override; built Web Component attribute updates, disposal and reconnection; unavailable-WebGL fallback.
- `node tests/final-visual.mjs`: built production demo, mobile labels and SVG overlay bounds, underside/marble images, and single-viewer frame sampling at device pixel ratios 1 and 2.

Machine-readable reports are retained in `docs/validation/`. The handoff ZIP also includes `verification/` with full-resolution browser captures. The source repository does not require those PNG files to run.

## Rendering and resource observations

Environment: Windows, Node.js 24.15.0, npm 11.12.1, installed Google Chrome 155 via Playwright, ANGLE Direct3D 11 on AMD Radeon 890M. These are local browser measurements, not results from a physical mobile-device test. Mobile layout was checked at a 390 px browser viewport.

The performance harness warms one viewer, enables idle rotation, and samples 299 frame intervals at 1440 × 900 CSS pixels. Device pixel ratio 2 produces a 2880 × 1800 drawing buffer. Exact measurements are in `docs/validation/release-report.json`. A prior measurement with another viewer page still open returned about 50.4 fps at DPR 2; it is not used as an isolated-viewer benchmark. Texture generation, initial shader compilation, and product switching can stall individual frames and are outside the steady-state figure.

| Device pixel ratio | Drawing buffer | Mean frame rate | 95th-percentile frame interval |
| --- | --- | --- | --- |
| 1 | 1440 × 900 | 60.0 fps | 16.8 ms |
| 2 | 2880 × 1800 | 60.0 fps | 16.8 ms |

After repeated settled product switches, the renderer reports **4 geometries and 11 textures** consistently. A separately visible wear geometry can increase the geometry count to 5 during/after layer inspection until the next product replacement. Stack clones share existing material/geometry resources. These counts demonstrate no monotonically growing allocation trend in the tested switch sequence; they are not a substitute for a long-duration browser heap profiler.

The build has an expected Vite chunk-size advisory because the self-contained bundle includes Three.js. The library is approximately 990 kB uncompressed / 216 kB gzip; the demo JavaScript is approximately 643 kB / 166 kB gzip. No type-check or build error is present.

## Visual review and corrections

The canonical 6.78:1 length-to-width ratio and 5.3 mm total thickness are maintained. Camera fitting changes framing without widening or thickening the physical model. The front and profile cameras use orthographic projection. Separation spacing is illustrative; layer thicknesses remain physical.

| Finish | Reviewed material character |
| --- | --- |
| Light Natural Oak | Pale blonde, fine flowing grain, subtle small knot, restrained relief. |
| Whitewashed Ash Oak | Pale cream/grey wash, softer open grain, visible knots, matte appearance. |
| Golden Honey Oak | Warm golden palette, broad cathedral grain, satin sheen. |
| Warm Taupe Oak | Warm medium brown, mixed grain, several dark knots. |
| Greige Oak | Grey-beige palette, open brushed grain, strongest relief, matte appearance. |
| Dark Walnut Brown | Dark chocolate palette, dense lengthwise grain, pebbled backing. |
| White Marble | Soft grey veins and sparse speckles on white, smooth flat normals, higher clearcoat. |

Review corrections included irregular wood fibres and asymmetric knot distortion, stronger but restrained marble veins, absolute roughness maps to avoid excessive gloss, correctly illuminated backing with a resolved physical cross-hatch tile, mobile camera fitting, cold-start animation time clamping, and viewer CSS isolation so host icon styles do not shrink SVG leader lines or remove label styling.

## Reproducing the browser checks

Use separate terminals for the two retained servers, then execute the checks in a third terminal. Installed Google Chrome is used by the harness.

```sh
npm ci
npm run build
npm test
npm run dev -- --port 5173
```

```sh
npm run preview -- --port 4173
```

```sh
npm run test:browser
node tests/advanced-browser.mjs
node tests/final-visual.mjs
```

`SPC_TEST_URL` and `SPC_PROD_URL` can override development and production-preview addresses. Stop both servers when finished. Generated results go to `test-results/`.

## Known limits and roadmap

1. **Photographic calibration:** procedural textures preserve product character, not the exact surface photograph. Use rectified albedo plus matched normal/roughness photographs for product-specific grain and measured colour matching. Display/lighting differences still affect perceived colour.
2. **Joinery:** the configurable tongue/groove is an illustrative profile. Manufacturer tooling/CAD dimensions were not supplied; short-edge joinery is simplified.
3. **Exports:** `screenshot()` captures WebGL pixels. DOM labels, SVG leaders, and surrounding controls are excluded. Use a browser/page capture when annotations are required.
4. **Optional scope:** quarter cutaway, GLB export, and AR are roadmap items. Both required layer modes, lift and stair, are implemented.
5. **Hosting and platform validation:** local development, built static demo, standalone Web Component, and React were executed. GitHub Pages workflow and Next.js example are supplied but have not been deployed/executed on external accounts. Touch interaction uses OrbitControls; physical iOS/Android Safari/Chrome devices were not tested.
6. **Performance:** avoid describing the 60 fps target as universal. Cold material generation and shader compilation are synchronous browser work; a future worker/texture cache can reduce switch-time stalls for larger catalogs.

## Delivery contents

The project source, exact dependency lock, MIT license, bundled Three.js notice, build scripts, GitHub Pages workflow, tests, full catalog, schema, and integration documentation are included. Generated library and demo builds are included in the ZIP and npm package as appropriate. Original product sheets, room photos, palette image, and motion clip are reference inputs and are not redistributed.
