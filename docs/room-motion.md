# Room Motion

Room Motion is the native Three.js room demo at `/room/`. It presents the same room with six floor finishes in the user's requested order, using normal page scrolling to move between them. The existing single-plank Material Studio remains at `/`.

## Run, build, and check

Use the same Node.js version and dependency installation as the main project:

```sh
npm install
npm run dev
```

Open `/room/` on the development URL printed by Vite. The scene uses WebGL 2 and browser DOM APIs. It does not need a backend, an external 3D service, or a video player.

```sh
npm run build:room
npm run preview:room
```

`build:room` runs TypeScript checking and emits the room site into `room-dist/`. `preview:room` serves that output; open `/room/` under the preview origin. Preserve the directory structure when hosting, including the room reference images. The separate `build` and `preview` commands continue to produce and serve the original library and plank studio.

With the development server running in another terminal:

```sh
npm run test:room
```

This invokes `tests/room-browser.mjs`, the room-specific browser check. Test results and measured performance belong to the generated test report; a successful source build alone does not establish visual fidelity or a particular frame rate.

## Finish order

The public labels preserve the supplied image names. They are reference labels, not new commercial product names or SKUs.

| Order | Visible name | Scene ID | Reference-matched character | Reference image |
| --- | --- | --- | --- | --- |
| 1 | พื้นปก1 | `floor-01` | Natural grey-brown wood | `room/references/floor-01.png` |
| 2 | พื้นปก2 | `floor-02` | Cream-toned natural wood | `room/references/floor-02.png` |
| 3 | พื้นปก3 | `floor-03` | Warm dark brown | `room/references/floor-03.png` |
| 4 | พื้นปก4 | `floor-04` | Soft white wood grain | `room/references/floor-04.png` |
| 5 | พื้นปก5 | `floor-05` | Light honey wood | `room/references/floor-05.png` |
| 6 | พื้นปก6 | `floor-06` | Soft grey-beige wood | `room/references/floor-06.png` |

`src/room/finishes.ts` is the authoritative ordered array. It defines each label, subtitle, reference path, deterministic seed, palette, grain, knots, and surface finish. Each room finish copies a suitable existing product recipe and customizes it without mutating the original seven-product catalog.

The photographs contain warm light, shadows, reflections, and perspective. The procedural palettes estimate their diffuse material tones; the room's own lights provide illumination. The result aims to retain the six references' relative colour and wood character without baking photographed furniture or shadows into a floor texture. Exact photographic grain identity and calibrated colour matching require measured, rectified surface maps.

## Room geometry and scale

Walls, furniture, window details, and decorative objects are Three.js meshes. They have volume and participate in the rendered perspective and lighting. The scene is composed from the supplied room reference, using estimated geometry rather than a photogrammetry scan or a measured architectural survey.

The room scene uses **metres** as its world units. Its floor layout is approximately **7.32 × 7.20 m**, arranged in 40 rows of nominal **1.22 × 0.18 m** boards, with boards clipped at the boundary and a staggered joint pattern. The extended foreground accommodates the portrait camera. Floor thickness uses the existing viewer's **0.0053 m** product value. The room footprint and furniture dimensions are staging estimates; they are not additional specifications for the flooring product. This coordinate convention is separate from the single-plank viewer's centimetre units.

Floor surfaces use generated albedo, normal, and roughness maps. Each board varies its texture offset, direction, and subtle tint to reduce conspicuous repetition. Instanced board meshes share geometry and materials; only the current and next finishes need to be visible during a transition.

## Scroll choreography

The document has a tall story section containing a sticky viewport-sized scene. Browser scrolling remains native: there is no wheel interception, forced page snapping, or custom scroll container.

The current scroll position maps to a deterministic point in the six-finish sequence. Scrolling down advances it; scrolling up samples the same path backward. The floor animation first slides boards toward the open foreground, then raises and carries them out before the next finish enters. The staging avoids sending boards directly upward through the furniture. The swatch picker moves to a finish's story position, and replay returns to the beginning.

The motion button provides a way to stop movement. Reduced-motion preferences use assembled finish changes instead of the flying-board sequence. The responsive interface keeps the room dominant, with finish information and a compact six-swatch tray at the bottom. A skip link reaches the content after the story without requiring the full scroll sequence.

The animation is a material presentation, not a simulation of actual installation or removal. Board positions and phase timings are defined in `src/room/motion.ts` and applied by `src/room/floor.ts`.

## Reference comparison and assets

The optional **ภาพอ้างอิง** panel shows the original reference image for comparison. It is a separate overlay; the photographs are not projected onto the room or used as a substitute for 3D geometry. Closing the panel restores an unobstructed view of the scene.

Seven room reference images supplied by the user for this feature are included in `public/room/references/`: the six named finish references plus the overall room reference. Vite copies these public assets into the room build. They should be treated as user-provided reference media, separate from the MIT license covering project source.

This inclusion applies to the Room Motion references. The earlier seven product sheets, colour-palette image, and motion clip are not redistributed as website assets. The reusable plank viewer still generates its own textures and does not require those original reference files to render.

## File responsibilities

| File | Responsibility |
| --- | --- |
| `room/index.html` | Accessible Thai page shell, canvas host, story, swatches, comparison panel, and footer. |
| `src/room/main.ts` | Renderer, lighting, scene lifecycle, native-scroll state, UI, and loading/fallback behavior. |
| `src/room/room.css` | Responsive sticky layout, brand styling, focus states, and reduced-motion CSS. |
| `src/room/roomGeometry.ts` | Estimated architectural, furniture, and decorative geometry with resource cleanup. |
| `src/room/finishes.ts` | Ordered finish configuration and procedural material ownership. |
| `src/room/motion.ts` | Deterministic floor layout and reversible motion samples. |
| `src/room/floor.ts` | Instanced floor meshes, board variation, and transition updates. |
| `public/room/references/` | User-provided room and finish reference images. |
| `tests/room-browser.mjs` | Room-specific browser verification. |

Keep the optional comparison images, floor material recipes, and scene geometry separate when extending the feature. A new photograph may justify adjusting a recipe or composition; it does not automatically provide measured geometry or a physically calibrated texture.
