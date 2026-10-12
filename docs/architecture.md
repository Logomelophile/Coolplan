# Architecture and visual specification

The original request separated delivery into review phases. The subsequent instruction authorized completing all phases in one run. This document records the data model, scene conventions, and implementation boundaries for future maintainers.

## File responsibilities

```text
spc-plank-viewer/
  index.html                     Studio entry point
  package.json                   Library exports and build/test commands
  vite.config.ts                 Library/demo builds and optional-map manifest
  tsconfig.json                  Strict source and example type checking
  tsconfig.build.json            Declaration output
  src/
    index.ts                     Public API exports and custom-element registration
    types.ts                     Product, layer, camera, locale, and options types
    SPCPlankViewer.ts            Lifecycle, scene state, input, animation, rendering
    webComponent.ts              Shadow-DOM custom element and attribute bridge
    viewerStyles.ts              Scoped labels and viewer fallback styles
    cameraPresets.ts             Camera data and interpolation helpers
    lighting.ts                  Studio lights, soft shadow, PMREM environment
    labels.ts                    CSS2D labels, SVG leader lines, dimensions
    data/
      products.json              Seven complete product configurations
      products.ts                Catalog access and runtime validation
      product.schema.json        JSON Schema for catalog records
    geometry/plankGeometry.ts    Extruded core profile and data-driven slabs
    materials/materialFactory.ts PBR material assembly and map ownership
    textures/
      noise.ts                   Deterministic noise/math
      wood.ts                    Wood surface fields and grain structure
      marble.ts                  Marble surface fields and veins
      backing.ts                 Diamond and pebbled IXPE
      types.ts                   Texture-set and field contracts
      index.ts                   Canvas maps, Sobel normals, texture exports
    demo/
      main.ts                    Studio controls and viewer event synchronization
      style.css                  Responsive, scoped editorial studio layout
  examples/react/
    SPCViewer.tsx                Optional React client wrapper
    main.tsx                     Working example using controlled props
    index.html                   Example entry point
  tests/                         Geometry/data/math and browser integration checks
  public/textures/                Optional image maps; no required binary assets
  docs/architecture.md           This document
  .github/workflows/pages.yml    Static demo deployment
  README.md                     Integration, configuration, limitations
  LICENSE                       MIT source license
```

## Coordinate and dimension conventions

One scene unit is **one centimetre**. For the supplied products, X is the length (**122**), Z is the width (**18**), and Y is the thickness (**0.53**). The assembled plank is centred along X and Z. Its backing rests at the bottom and its top is 0.53 above that datum. Procedural texture U follows length and V follows width. The front camera's X-aligned up vector makes the long axis vertical in the image.

The declared 1220 × 180 × 5.3 mm bounding dimensions are authoritative. Tongue-and-groove shaping fits within the configured footprint. A grey extruded core carries the long-edge profile; short ends are simplified. The backing footprint is inset. Micro-bevel values are bounded by layer dimensions, so a 0.3 mm preference does not deform a 0.1 mm décor film.

The four supplied layers are top-to-bottom wear (0.5 mm), décor (0.1 mm), core (3.7 mm), and backing (1.0 mm). Layer ordering is data, not a hard-coded four-element loop. Assembled wear contributes to the physical upper slab and its optical appearance is represented by clearcoat. The separate wear mesh appears during layer separation. Separation gaps are presentation distances, while actual layer thicknesses remain unchanged.

## Data contracts

`ProductConfig` owns the unique ID, names, localized description, dimensions in millimetres, seed, surface family, palette, grain controls, knot parameters, roughness/clearcoat settings, backing pattern, profile settings, optional map paths, and `layers[]`.

Each `LayerConfig` owns its stable ID, TH/EN label and description, thickness, material kind/properties, and numeric order. The core logic sorts records by order. Material kinds are `wear`, `decor`, `core`, `backing`, and the extensible generic `coating`. Adding a fifth coating only requires data; no index-based branches or extra UI controls are necessary.

The precise authoritative declarations are in `src/types.ts`, the catalog is `src/data/products.json`, and the JSON Schema is `src/data/product.schema.json`. Runtime validation also checks important structural conditions. Thickness mismatch uses a warning because a caller may intentionally configure a different stack during development; it should be fixed before publishing real product data. The demo displays the original seven products in a preferred order, then appends all other catalog entries. Product thumbnails, numbering, localized finish totals, and layer controls are derived from the data, so valid JSON additions require no UI code changes.

## Camera preset table

Positions and targets below are reference scene units for the 1220 mm product, not fixed final camera coordinates. `fitPerspective()` adapts camera distance and target to the canvas aspect ratio and the model's projected bounds, including the stack or separated layers. The exploded view reserves a column on the right for its labels so framing leaves room for both geometry and explanations. Close-up retains its specified inspection distance. The table's orthographic span is the reference vertical view span before the viewport aspect ratio supplies horizontal extent; Profile additionally expands its span as needed to keep the complete width visible. `fov` is only active for perspective cameras.

| Preset | Projection | Position X, Y, Z | Target X, Y, Z | Up X, Y, Z | FOV | Ortho span |
| --- | --- | --- | --- | --- | --- | --- |
| `front` | Orthographic | 0, 170, 0 | 0, 0, 0 | 1, 0, 0 | — | 145 |
| `perspective34` | Perspective | 78, 83, 105 | 0, 0, 0 | 0, 1, 0 | 34° | — |
| `stacked` | Perspective | 84, 91, 115 | 0, 3, 0 | 0, 1, 0 | 34° | — |
| `closeup` | Perspective | 5, 15.53, 15 | 0, 0.53, 0 | 0, 1, 0 | 42° | — |
| `back` | Perspective | 78, −83, 105 | 0, 0, 0 | 0, 1, 0 | 34° | — |
| `exploded` | Perspective | 75, 94, 122 | 15, 9, 0 | 0, 1, 0 | 37° | — |
| `profile` | Orthographic | 170, 0.265, 0 | 0, 0.265, 0 | 0, 1, 0 | — | 14 |

Preset transitions use cubic ease-in/out over approximately 600 ms. Camera direction interpolation avoids passing through the model when changing to the underside. The close-up target places the camera 15 cm above the top surface with an approximately 45° viewing elevation. Profile looks along X so the long-edge tongue and groove are visible at the end section. Since width is much larger than thickness, the real core remains a slender band even in this view; the 5.3 mm annotation gives dimensional context.

## Surface appearance

Procedural surface maps default to **2048 × 512**. A seeded generator produces albedo, height, and roughness fields. Sobel gradients produce tangent-space normals; marble deliberately has a flat height field and therefore a flat normal map. Albedo is tagged sRGB; normal/roughness are linear. Canvas-derived thumbnails use the same deterministic surface generator.

Wood parameters distinguish the blonde Light Natural, pale Whitewashed Ash, golden cathedral Honey, knotted warm Taupe, brushed Greige, and dense dark Walnut. Grain warping and knot distortion follow the plank length. Marble is a separate domain-warped vein/noise family with no raised grain or vein relief. Its visual detail comes from colour and roughness, preserving a smooth polished surface. This provides recognizable material families, while the exact photographic grain fingerprint requires a calibrated image map.

PBR materials are dielectric `MeshPhysicalMaterial` instances. Clearcoat distinguishes the marble gloss from satin and matte wood. Roughness maps encode the desired range directly, avoiding accidental double multiplication that would make wood overly glossy. Core aggregates are subtle, and black backing maps are not multiplied by another near-black tint. Cross-hatch uses a periodic tile whose physical side length is `2.5 × √2 × 16` mm. Repeating that tile across the backing preserves the approximately 2.5 mm pitch without undersampling grooves across the entire 1220 mm plank; both diagonal line families meet at tile seams. Albedo, normal, and roughness use the same physical repeat. Walnut selects the pebbled pattern instead.

Optional photographs override individual surface roles. A build-time Vite manifest discovers existing files so a zero-asset installation has no missing-image requests. Explicit `product.maps` values take precedence. Asynchronous product requests use a token: only the newest completed request is installed, and any superseded resources are released.

## Studio, rendering, and animation

The renderer uses WebGL 2, sRGB output, ACES Filmic tone mapping, a white studio, PMREM-filtered `RoomEnvironment`, key/fill/rim illumination, and a soft ground shadow. Pixel ratio is capped at two. The underside camera hides the ground so it cannot block the black foam surface and enables a dedicated underside fill light to reveal the foam's embossed detail.

`OrbitControls` provides damping, zoom, touch, and slow idle rotation. Inspection views and reduced-motion users do not auto-rotate. A single requestAnimationFrame loop drives camera transitions, explode interpolation, product cross-fades, selection labels, controls, and rendering. Hidden documents and offscreen instances skip rendering.

The `lift` style separates layers vertically with equal gaps. `stair` adds horizontal offsets. Stack clones share the original geometry and material objects and are released without double-disposing shared resources. CSS2D labels anchor to layer edges; leader lines and their endpoint dots are an SVG screen overlay, updated from projected layer positions. These remain outside the WebGL render. The static fallback explains when WebGL 2 is unavailable.

## Lifecycle and ownership

`SPCPlankViewer` owns a mount subtree, rendering context, controls, scene, environment, active/outgoing model bundles, label system, listeners, observers, and animation handle. Product cross-fading retains at most the active and outgoing models, then disposes the outgoing model's owned geometry/maps/materials. Stale asynchronous map loads dispose their bundles without entering the scene.

`dispose()` is idempotent. It cancels rendering, invalidates pending loads, aborts pointer/keyboard listeners, disconnects observers, disposes controls/labels/models/studio resources, clears renderer lists, releases the context, and removes the mount subtree. The React wrapper calls it from effect cleanup. The Web Component calls it from `disconnectedCallback` and creates a new instance if reconnected.

## Boundaries and next work

The geometry is a faithful dimensional visualization with an approximate configurable click profile; it is not a milling specification. Procedural textures are an immediately usable fallback and cannot duplicate a specific photographed plank exactly. The screenshot API exports WebGL pixels only, excluding DOM labels and SVG leader lines. Cutaway, GLB, and AR are intentionally outside the delivered core; the next fidelity step is calibrated, physically aligned albedo/normal/roughness photographs.

The viewer exposes sampled diagnostics for profiling. Frame-rate acceptance needs a named hardware/browser environment and should not be inferred from a successful build or a software-rendered headless browser. The supplied test commands and recorded validation are the basis for functional acceptance.
