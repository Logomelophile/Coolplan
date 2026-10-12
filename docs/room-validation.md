# Room Motion validation — 12 October 2026

## Automated checks

- `npm run build`: TypeScript, reusable library, declarations, and original Material Studio production build pass.
- `npm run build:room`: TypeScript and Room Motion production build pass.
- `npm test`: 11 unit tests pass, including six room-specific checks for floor coverage, installed/exited endpoints, row separation in both directions, deterministic reverse sampling, finish handoff, and furniture clearance.
- `npm run test:room`: nine browser check groups pass in local Chrome with no page or console errors in the WebGL scene.

Browser coverage includes all six finishes, native wheel scrolling, swatch navigation, pause/resume, reverse sampling, stable GPU allocation after all finishes have loaded, lazy reference images, Escape/focus restoration, reduced motion, 390 × 844 portrait and 844 × 390 landscape layouts, disposal during initialization and after readiness, and a deliberately unavailable WebGL context. The unavailable-context case displays the supplied photographs and explicitly labels the fallback.

The scene contains 266 physical plank instances per finish; at most two finishes are visible during a handoff. The complete floor is 7.32 × 7.20 m in the illustrative room. All dimensions are staging estimates except the existing nominal plank dimensions.

## Performance sample

Independent measurement used 90 actual requestAnimationFrame intervals while continuously moving from the first to second finish, following readiness and 15 warmup frames. Host: Windows, Headless Chrome 155, ANGLE / AMD Radeon 890M / Direct3D 11.

| Viewport | Pixel ratio | Median frame | p95 frame | Mean frame |
| --- | --- | --- | --- | --- |
| 1440 × 900 | 1 | 16.7 ms | 16.8 ms | 16.67 ms |
| 390 × 844 | 1.5 | 16.7 ms | 16.8 ms | 16.67 ms |

This is approximately 60 fps on this host during the measured motion. The mobile viewport is emulation on the same computer, not a measurement on a physical phone. Static scenes render on demand.

## Visual review and scope

Reviewed captures cover the installed room, outgoing planks, exposed subfloor, incoming planks, all six finishes, mobile portrait, landscape, and the original-reference overlay. Review led to fixes for overlapping rows, premature lift beneath furniture, viewport clipping, low-contrast mobile text, and overly regular vegetation. Room vegetation was simplified substantially while retaining individual branches and leaves.

This is a reconstructed interactive room, not a photographic scan. Furniture proportions, procedural grain, illumination, and palette matching are approximate. The reference panel makes comparison with the supplied photographs available. Source images remain unmodified.

Reproducible browser captures and raw reports are generated under the ignored `test-results/room/` directory, including `report.json` and `performance.json`.
