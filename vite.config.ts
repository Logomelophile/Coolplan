import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

const siteBase = process.env.COOLPLAN_BASE_PATH || './';
if (siteBase !== './' && !/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(siteBase)) {
  throw new Error('COOLPLAN_BASE_PATH must be an absolute path ending in /');
}

function projectLinksPlugin(): Plugin {
  const prefixed = (path: string) => path.startsWith(siteBase) ? path : `${siteBase}${path.replace(/^\//, '')}`;
  return {
    name: 'coolplan-project-links',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (siteBase === './' || siteBase === '/') return html;
        return html
          .replace(/\b(href|src|srcset)=(["'])(\/(?!\/)[^"']*)\2/g,
            (_match, attribute, quote, path) => `${attribute}=${quote}${prefixed(path)}${quote}`)
          .replace(/(content=["']\s*\d+;\s*url=)(\/(?!\/)[^"']*)/gi,
            (_match, prefix, path) => `${prefix}${prefixed(path)}`);
      },
    },
  };
}

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
  base: siteBase,
  plugins: [textureManifestPlugin(), projectLinksPlugin()],
  cacheDir: resolve(tmpdir(), 'coolplan-spc-vite-cache'),
  // Build outputs are written while the dev server runs; watching them crashes the watcher on Windows (EBUSY).
  server: {watch: {ignored: ['**/dist/**', '**/*-dist/**', '**/test-results/**']}},
  resolve: {alias: {'spc-plank-viewer': resolve(import.meta.dirname, 'src/index.ts')}},
  build: mode === 'v2' ? {
    outDir: 'v2-dist', emptyOutDir: true,
    rollupOptions: {input: resolve(import.meta.dirname, 'v2/index.html')},
  } : mode === 'website' ? {
    outDir: 'website-dist', emptyOutDir: true,
    rollupOptions: {input: {website: resolve(import.meta.dirname, 'website/index.html'), calculator: resolve(import.meta.dirname, 'calculator/index.html'), ceo: resolve(import.meta.dirname, 'ceo/index.html'), nextGen: resolve(import.meta.dirname, 'next-gen/index.html')}},
  } : mode === 'room' ? {
    outDir: 'room-dist', emptyOutDir: true,
    rollupOptions: {input: resolve(import.meta.dirname, 'room/index.html')},
  } : mode === 'demo' ? { outDir: 'demo-dist', emptyOutDir: true } : {
    outDir: 'dist', emptyOutDir: true, copyPublicDir: false,
    lib: { entry: resolve(import.meta.dirname, 'src/index.ts'), formats: ['es'], fileName: () => 'spc-plank-viewer.es.js' },
    sourcemap: true,
  },
}));
