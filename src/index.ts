export { SPCPlankViewer } from './SPCPlankViewer';
export { SPCPlankViewerElement, registerSPCPlankViewer } from './webComponent';
export { products, getProduct, validateProduct } from './data/products';
export { generateSurfaceTextures, generateBackingTextures } from './textures';
export { cameraPresets, viewPresets } from './cameraPresets';
export type * from './types';
import { registerSPCPlankViewer } from './webComponent';
registerSPCPlankViewer();
