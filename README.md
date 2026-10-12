# SPC Plank Viewer

A reusable Three.js material studio for seven SPC flooring finishes. The framework-independent viewer uses real dimensions, deterministic procedural PBR textures, a configurable layer stack, animated cameras, and an accessible Thai/English interface.

The plank studio opens with Light Natural Oak. No image, model, HDR, or other binary asset is required to render its products. The reference product sheets are visual guidance; their printed 4–5 mm thickness is overridden by the supplied **5.3 mm** specification. A separate [Room Motion demo](docs/room-motion.md) is available at `/room/`.

## Run locally

Use Node.js **22.12 or newer**. In this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The studio is at `/`; the working React integration is at `/examples/react/`. To reproduce the locked dependency versions in CI or a fresh checkout, use `npm ci` instead of `npm install`.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The build emits:

- `dist/spc-plank-viewer.es.js`: a standalone ES module, including Three.js and its required addons.
- `dist/index.d.ts` and supporting declarations: TypeScript API types.
- `demo-dist/`: the static studio site, with relative asset paths for deployment beneath a repository path.

`npm run preview` serves `demo-dist`. A local HTTP server is required; opening `index.html` directly with `file://` does not load an ES-module application correctly. The source package is not automatically published to npm.

## Room Motion

Open `/room/` after `npm run dev` to explore a native Three.js room with six floor finishes, ordered **พื้นปก1 → พื้นปก2 → พื้นปก3 → พื้นปก4 → พื้นปก5 → พื้นปก6**. Normal page scrolling drives the floor choreography; scrolling back reverses the same sequence. The swatch tray jumps to a finish, the motion control pauses the movement, and the optional reference panel shows the supplied image for comparison.

The room and furniture are actual 3D geometry built from estimated dimensions and the supplied composition, rather than a photogrammetric reconstruction. All six floor surfaces are procedural approximations matched to the room references' colour and grain character. Room sizes and visual colour matching are not measured product specifications. The original plank studio and its seven-product catalog remain separate.

```sh
npm run dev
npm run build:room
npm run preview:room
npm run test:room
```

The room build emits `room-dist/`; serve that directory and open `/room/`. Run the browser test with the development server running. See [docs/room-motion.md](docs/room-motion.md) for the reference mapping, scene structure, scrolling behavior, and asset policy. Seven user-supplied room reference images are included for this feature's optional comparison panel; the older product sheets and motion clip are not redistributed.

## Release package

The delivered project is a **local Git repository**. The `spc-plank-viewer-v1.0.0.zip` handoff contains a top-level `spc-plank-viewer/` directory with source, builds, and verification snapshots, plus `spc-plank-viewer-v1.0.0.bundle` alongside that directory. The bundle is an offline copy of the committed source and Git history. To create an independent checkout from the directory containing it:

```sh
git clone spc-plank-viewer-v1.0.0.bundle my-material-studio
cd my-material-studio
npm ci
npm run build
```

Cloning the bundle requires no Git hosting service; installing uncached npm dependencies still requires network access. Generated builds and `node_modules` are not part of the source history.

The `spc-plank-viewer-1.0.0.tgz` npm archive contains the built library and its package files. Install it into an existing application with `npm install /path/to/spc-plank-viewer-1.0.0.tgz`. The `demo-dist/` directory is the ready-to-host static studio. No remote repository, npm publication, or live-site deployment is created by this delivery.

## Interaction

- Drag the plank to orbit. Scroll or pinch to zoom. Orbiting supports the top, sides, and underside.
- Click/tap the assembled plank to separate its layers. Hover or tap an exposed layer to highlight it and its label. Click empty studio space to assemble the plank again.
- Select a finish, camera view, separation amount, separation style, or visible layer in the demo controls.
- Focus the viewer and press **1–7** for Top, Perspective, Stacked, Surface, Back, Layers, and Profile. **Escape** returns to Perspective. **Enter** toggles layer separation.
- Automatic rotation is optional, resumes after three seconds of idle time, and pauses in inspection views. Reduced-motion preferences disable automatic rotation and animated camera transitions.

## Embed in plain HTML

After building, copy `dist/spc-plank-viewer.es.js` to your site. Importing the module registers `<spc-plank-viewer>` automatically. No CDN import map, global `THREE`, external stylesheet, or framework is needed.

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Our flooring collection</title>
  </head>
  <body>
    <spc-plank-viewer
      id="flooring"
      product="greige-oak"
      view="perspective34"
      locale="th"
      auto-rotate
      stack-count="3"
      style="height:560px;width:100%"
    ></spc-plank-viewer>
    <script type="module">
      import './vendor/spc-plank-viewer.es.js';
      const flooring = document.querySelector('#flooring');
      flooring.addEventListener('layerselect', event => {
        console.log('Selected layer:', event.detail.layerId);
      });
      flooring.addEventListener('viewererror', event => {
        console.warn(event.detail.message);
      });
    </script>
  </body>
</html>
```

Attributes `product`, `view`, `locale`, `auto-rotate`, and `stack-count` update the viewer when changed. Omit `auto-rotate`, remove the attribute, or set it to `"false"` to disable it. The wrapper uses Shadow DOM. Removing the element disposes its instance; reconnecting creates a fresh one. For advanced methods, access the element's `viewer` property after it connects. The package also exports `registerSPCPlankViewer()` for explicit registration.

## Embed the class

The mount element needs a nonzero width and height. The viewer scopes its own styles and observes container size changes.

```ts
import { SPCPlankViewer } from './vendor/spc-plank-viewer.es.js';

const container = document.querySelector<HTMLElement>('#flooring-viewer')!;
const viewer = new SPCPlankViewer(container, {
  productId: 'light-natural-oak',
  view: 'perspective34',
  locale: 'th',
  autoRotate: false,
  stackCount: 3,
  dimensions: true,
  pixelRatio: 2,
});

await viewer.ready;
await viewer.setProduct('warm-taupe-oak');
viewer.setView('exploded');
viewer.setExplode(1, 'stair');

// Call this when the host component is removed.
viewer.dispose();
```

## React

`examples/react/SPCViewer.tsx` is a thin client-side adapter with cleanup, a Strict Mode-safe lifecycle, prop updates, and event callbacks. Run `/examples/react/` under the Vite development server to use it. The wrapper imports the public `spc-plank-viewer` API, which this repository resolves to source during development.

For another project, install this built package from your repository or a local path and copy the wrapper. Its imports already use the public `spc-plank-viewer` package name; this repository resolves that name to source during development:

```sh
npm install /path/to/spc-plank-viewer
```

```tsx
import { SPCViewer } from './SPCViewer';

export default function ProductDetail() {
  return (
    <SPCViewer
      productId="whitewashed-ash-oak"
      view="perspective34"
      locale="en"
      autoRotate={false}
      style={{ height: 560 }}
      onReady={viewer => viewer.setStackCount(3)}
      onLayerSelect={layerId => console.log(layerId)}
    />
  );
}
```

The wrapper exposes `productId`, `view`, `locale`, `autoRotate`, `className`, `style`, `onReady`, `onProductChange`, `onLayerSelect`, and `onError`. Use `onReady` to retain the instance for other API methods.

### Next.js App Router

Keep the wrapper's `'use client'` directive. Instantiate the viewer only in an effect. A dynamic client-only boundary is useful if your build pipeline evaluates browser dependencies during rendering:

```tsx
'use client';

import dynamic from 'next/dynamic';

const SPCViewer = dynamic(
  () => import('./SPCViewer').then(module => module.SPCViewer),
  { ssr: false, loading: () => <div style={{ height: 560 }}>Loading material…</div> },
);

export default function FlooringHero() {
  return <SPCViewer productId="golden-honey-oak" locale="th" style={{ height: 560 }} />;
}
```

The package's custom-element registration is guarded for server-side imports. Its viewer constructor and texture generators require browser DOM APIs.

## Public API

### Constructor options

| Option | Default | Meaning |
| --- | --- | --- |
| `productId` | First catalog entry | A product ID in the selected catalog. |
| `products` | Bundled seven products | Replace the catalog with your own `ProductConfig[]`. |
| `view` | `perspective34` | Initial camera preset. |
| `locale` | `th` | `th` or `en` labels. |
| `autoRotate` | `false` | Enable slow idle rotation. |
| `stackCount` | `3` | Number of planks in Stacked view, clamped to 1–6. |
| `pixelRatio` | Device pixel ratio | Rendering density, always capped at 2. |
| `dimensions` | `true` | Dimension annotations in Top and Profile views. |
| `discoverMaps` | `true` | Use optional image-map entries found by the build. |
| `textureBaseUrl` | Vite base + `textures/` | Base URL for discovered image-map paths. |

### Methods and properties

| API | Behavior |
| --- | --- |
| `ready: Promise<void>` | Resolves after initial setup. `diagnostics.webgl` indicates whether 3D rendering is available. |
| `setProduct(id): Promise<void>` | Builds the requested material and starts a 400 ms cross-fade. Newer requests supersede older ones. |
| `setView(preset): void` | Animates a preset camera over approximately 600 ms. Exploded view also separates the layers. |
| `setExplode(boolean \| number, mode?): void` | Sets separation from 0 to 1; mode is `lift` or `stair`. Numeric values are clamped. |
| `setLayerVisible(layerId, visible): void` | Shows or hides an individual configured layer. |
| `setStackCount(n): void` | Changes stack size; takes effect in Stacked view. |
| `setLocale('th' \| 'en'): void` | Changes construction labels and viewer description. |
| `setAutoRotate(enabled): void` | Enables or disables idle rotation. |
| `screenshot(): string` | Returns a PNG data URL of the WebGL canvas. DOM labels, SVG leader lines, and surrounding controls are excluded. |
| `resize(): void` | Updates the render surface; `ResizeObserver` normally calls it automatically. |
| `dispose(): void` | Stops animation/listeners/observers and releases geometry, textures, materials, environment, renderer, and canvas. Safe to call repeatedly. |
| `product`, `view`, `locale`, `explode`, `autoRotate` | Read-only state getters. `explode` reports the target separation. |
| `diagnostics` | Read-only snapshot of WebGL availability, frame rate sample, resource counts, bounds, render calls, and viewer state. |

The seven `ViewPreset` values are `front`, `perspective34`, `stacked`, `closeup`, `back`, `exploded`, and `profile`. Camera coordinates and scene conventions are in [docs/architecture.md](docs/architecture.md).

### Events

Instances extend `EventTarget`. Each event is a `CustomEvent`; data is in `event.detail`. Web Component events also bubble across its shadow boundary.

| Event | Detail |
| --- | --- |
| `ready` | `{ productId }` |
| `productchange` | `{ productId, product }` |
| `viewchange` | `{ view }` |
| `layerselect` | `{ layerId }`; `null` means no layer is selected. |
| `explodechange` | `{ amount, mode }` |
| `autorotatechange` | `{ autoRotate }` |
| `viewererror` | Web Component only: `{ message }`. |

```ts
viewer.addEventListener('productchange', event => {
  const { product } = (event as CustomEvent).detail;
  document.querySelector('#product-name')!.textContent = product.name;
});
```

## Product data

The complete catalog is [src/data/products.json](src/data/products.json). [src/types.ts](src/types.ts) contains its TypeScript model; [src/data/product.schema.json](src/data/product.schema.json) describes the JSON format. The exported `validateProduct()` checks important runtime invariants and warns when layer thicknesses differ from the declared total.

All bundled products measure **1220 × 180 × 5.3 mm**. World-space dimensions are **122 × 18 × 0.53**, because one scene unit equals one centimetre. Layers are ordered from top to bottom:

| Layer | Thickness |
| --- | --- |
| Wear Layer | 0.5 mm |
| Décor Film Layer | 0.1 mm |
| SPC Core | 3.7 mm |
| IXPE Backing / Underlayment | 1.0 mm |
| **Total** | **5.3 mm** |

The assembled wear thickness is represented in the top slab while its optical behavior uses clearcoat. In the separated presentation it becomes an independent translucent sheet. Layer thicknesses remain physically scaled; only presentation gaps are enlarged.

### Add a product

Duplicate an entry in `products.json`, choose a unique `id` and `seed`, and change its name, localized descriptions, palette, grain, knots, roughness, and clearcoat values. Keep the supplied construction unless your actual product has a different specification. Rebuild after editing JSON. The core viewer accepts the new entry without code changes:

```ts
import { SPCPlankViewer, products } from 'spc-plank-viewer';

const custom = structuredClone(products.find(product => product.id === 'light-natural-oak')!);
custom.id = 'custom-oak';
custom.name = 'Custom Oak';
custom.nameTh = 'โอ๊กรุ่นพิเศษ';
custom.seed = 42017;
custom.surface.palette.base = '#ccb28d';

const viewer = new SPCPlankViewer(document.querySelector('#viewer')!, {
  products: [...products, custom],
  productId: custom.id,
});
```

The studio retains its preferred order for the original seven finishes and automatically appends every additional JSON product. Thumbnails, product numbering, finish totals, product details, and layer controls come from the catalog. Adding a valid product to `products.json` therefore adds it to both the viewer and the demo selector without code changes. Rebuild or restart the demo after changing the catalog.

### Add a layer

Add a record to `layers[]` with a unique ID, numeric `order`, thickness, localized labels/descriptions, and a supported material kind (`wear`, `decor`, `core`, `backing`, or generic `coating`). A generic coating participates in geometry, animation, labels, visibility, and cleanup automatically.

This example reserves 0.05 mm of an existing wear layer for a hypothetical coating while retaining 5.3 mm total. It demonstrates extension of the data model; it is not a claim about the supplied products.

```ts
const custom = structuredClone(products[0]);
custom.id = 'custom-coated-oak';
custom.layers.find(layer => layer.material.kind === 'wear')!.thicknessMm -= 0.05;
custom.layers.push({
  id: 'additional-coating',
  order: -1,
  label: { en: 'Additional coating', th: 'ชั้นเคลือบเพิ่มเติม' },
  description: { en: 'Example of an optional configured coating', th: 'ตัวอย่างชั้นเคลือบที่เพิ่มผ่านข้อมูลสินค้า' },
  thicknessMm: 0.05,
  material: { kind: 'coating', color: '#f4f6f7', roughness: 0.3, opacity: 0.3 },
});
```

### Replace procedural textures with photographs

Place optional surface maps under a product directory, for example:

```text
public/textures/light-natural-oak/albedo.jpg
public/textures/light-natural-oak/normal.png
public/textures/light-natural-oak/roughness.jpg
```

The Vite plugin discovers filenames `albedo`, `normal`, and `roughness` with `.png`, `.jpg`, `.jpeg`, or `.webp` extensions. **Restart the development server or rebuild after adding/removing files.** The compiled manifest contains only existing maps; the viewer does not make requests for absent files. Explicit `product.maps` values override discovered entries:

```ts
custom.maps = {
  albedo: '/materials/custom-oak-colour.jpg',
  normal: '/materials/custom-oak-normal.png',
  roughness: '/materials/custom-oak-roughness.jpg',
};
```

Use full URLs or root-relative paths for explicit maps when embedding on a different route. Serve cross-origin maps with an appropriate CORS header. Discovered maps use `textureBaseUrl`; when distributing the library with discovered images, also deploy those images to that URL. A failed configured map warns and falls back to its procedural counterpart.

Prepare a **flat, rectified, evenly lit plank surface**, with its long grain axis running horizontally in the image (U). The plank uses one complete map across its surface; 2048 × 512 is the default working resolution. Do not apply a full product sheet containing labels, perspective renders, and white margins as an albedo map. Use sRGB for albedo; normal and roughness maps are linear data. Normal maps use the OpenGL convention (positive Y). A roughness map is grayscale, with white indicating rougher material. If only albedo is supplied, normal and roughness retain their procedural defaults, so supply matching maps when exact surface correspondence matters.

## Visual decisions and limits

- The sheets' exaggerated proportions are replaced by the supplied physical size. A true 5.3 mm edge is very thin in a complete-plank view; Profile view is provided to inspect it.
- The tongue-and-groove cross-section is a configurable visual approximation. No proprietary click-lock machining dimensions were supplied. Short-edge joinery is simplified. This is a visualization, not a manufacturing CAD model.
- The grain synthesizer distinguishes palette, straight/cathedral grain, brushed relief, knot count, and gloss. It does not reproduce a photographed plank's exact knot positions or grain fingerprint. White marble uses a separate vein generator with a flat normal map.
- Black IXPE uses a periodic texture tile repeated at physical scale to preserve its approximately 2.5 mm diamond grid; Walnut uses a pebbled pattern. A dedicated underside fill light makes the black foam detail readable. Layers and maps are shared by stack clones to avoid duplicate GPU allocations.
- The seven demo thumbnails use the same procedural generator as the default plank materials. If you add photo overrides, adapt your storefront swatches to those photographs as well.
- Rendering pauses when the viewer is offscreen or the document is hidden. Pixel ratio is capped at two. The 60 fps goal depends on the GPU, browser, viewport, and graphics driver; software rendering is not representative of a mid-range laptop GPU.
- WebGL 2 is required for interactive 3D. Unsupported devices display a localized static explanation. The exported screenshot contains the render only, excluding DOM labels, SVG leader lines, and the demo UI.
- `cutaway` is not implemented. `lift` and `stair` are complete. The roadmap is photographic calibration, optional cutaway geometry, and GLB/AR export with a defined material conversion policy.

## Deploy the demo

The included GitHub Actions workflow builds and uploads `demo-dist` when `main` receives a push, or when run manually. In your repository settings, choose **Pages → Source → GitHub Actions**. The workflow does not create a remote repository or publish anything until you push/run it in your own GitHub repository. If your default branch is different, change the workflow's branch filter.

For any static host, upload the contents of `demo-dist`. No backend is required. Keep generated library files in `dist` separate from the deployed demo directory.

## Verification

`npm test` covers deterministic texture math, geometry dimensions, profiles, and configurable layer data. `npm run build` includes strict TypeScript checking and produces both library and demo artifacts. `npm run test:browser` runs the browser integration harness using installed Google Chrome through Playwright's `chrome` channel. Start `npm run dev` first; the harness defaults to `http://127.0.0.1:5173`, or use the `SPC_TEST_URL` environment variable for a different development-server address. After building, `node tests/advanced-browser.mjs` also tests real pointer/keyboard interactions, auto-rotation, a fifth layer, image overrides, the standalone Web Component, and the unavailable-WebGL fallback. Browser screenshots and machine-readable reports are written to `test-results/`. The release findings are recorded in [docs/verification.md](docs/verification.md).

## ภาษาไทย

เริ่มใช้งานด้วย `npm install` แล้ว `npm run dev` เปิดลิงก์ที่ Vite แสดง ลากเพื่อหมุน เลื่อนหรือจีบเพื่อซูม แตะแผ่นเพื่อแยกชั้น และเลือกสีจากแถบตัวอย่าง ทั้งเจ็ดรุ่นใช้ขนาดจริง **1220 × 180 × 5.3 มม.**

เพิ่มสินค้าและชั้นวัสดุได้จากข้อมูล JSON ลายเริ่มต้นสร้างจากโค้ดโดยไม่ต้องมีไฟล์ภาพ หากต้องการให้ตรงกับสินค้าแต่ละแผ่นจริง ให้เปลี่ยนเป็นภาพผิววัสดุที่จัดแสงและปรับมุมตรงแล้วตามวิธีด้านบน โทนสีบนจอและลายจำลองควรใช้ประกอบการเลือก และเทียบกับตัวอย่างจริงก่อนตัดสินใจ

## License

MIT for the project source. Three.js and other dependencies retain their respective licenses. The original seven product sheets and motion clip are not redistributed. The separate seven room reference images explicitly supplied for Room Motion are included under `public/room/references/` for the optional comparison panel; those images remain user-provided reference media, separate from the source-code license.
