import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

function textureManifestPlugin() {
  const virtualId = 'virtual:spc-texture-manifest';
  return {
    name: 'spc-texture-manifest',
    resolveId(id: string) { if (id === virtualId) return `\0${id}`; },
    load(id: string) {
      if (id !== `\0${virtualId}`) return;
      const root = resolve(import.meta.dirname, 'public/textures');
      const manifest: Record<string, Record<string, string>> = {};
      if (existsSync(root)) {
        for (const dir of readdirSync(root, {withFileTypes: true}).filter(entry => entry.isDirectory())) {
          const maps: Record<string, string> = {};
          for (const file of readdirSync(resolve(root,dir.name)).sort()) {
            const match = /^(albedo|normal|roughness)\.(png|jpe?g|webp)$/i.exec(file);
            if (match && !maps[match[1]]) maps[match[1]] = `${dir.name}/${file}`;
          }
          if (Object.keys(maps).length) manifest[dir.name] = maps;
        }
      }
      return `export default ${JSON.stringify(manifest)};`;
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [textureManifestPlugin()],
  cacheDir: resolve(tmpdir(), 'coolplan-spc-vite-cache'),
  resolve: {alias: {'spc-plank-viewer': resolve(import.meta.dirname, 'src/index.ts')}},
  build: mode === 'room' ? {
    outDir: 'room-dist', emptyOutDir: true,
    rollupOptions: {input: resolve(import.meta.dirname, 'room/index.html')},
  } : mode === 'demo' ? { outDir: 'demo-dist', emptyOutDir: true } : {
    outDir: 'dist', emptyOutDir: true, copyPublicDir: false,
    lib: { entry: resolve(import.meta.dirname, 'src/index.ts'), formats: ['es'], fileName: () => 'spc-plank-viewer.es.js' },
    sourcemap: true,
  },
}));
