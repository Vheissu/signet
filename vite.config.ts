import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

/**
 * Vite/Rollup plugin to strip eval() and new Function() calls from
 * node_modules. Chrome MV3 extensions forbid both in all extension contexts.
 *
 * Targeted patterns found in dhive's dependency tree:
 *   - eval(...)            → bn.js optimizations (has fallbacks)
 *   - Function("return this")()  → global object detection (use globalThis)
 *   - Function("r", "...")       → regenerator runtime init
 *   - Function(k)               → dynamic function creation
 */
function stripUnsafeEval(): Plugin {
  return {
    name: 'strip-unsafe-eval',
    transform(code, id) {
      if (!id.includes('node_modules')) return null;
      if (!code.includes('eval(') && !code.includes('Function(')) return null;

      let transformed = code;

      // 1. Replace eval(...) with a no-op returning null
      transformed = transformed.replace(
        /\beval\s*\(/g,
        '(0,function(){return null})('
      );

      // 2. Replace Function("return this")() with globalThis
      transformed = transformed.replace(
        /\bFunction\s*\(\s*"return this"\s*\)\s*\(\s*\)/g,
        'globalThis'
      );
      transformed = transformed.replace(
        /\bFunction\s*\(\s*'return this'\s*\)\s*\(\s*\)/g,
        'globalThis'
      );

      // 3. Replace new Function("return this")() with globalThis
      transformed = transformed.replace(
        /\bnew\s+Function\s*\(\s*"return this"\s*\)\s*\(\s*\)/g,
        'globalThis'
      );

      // 4. Replace Function(string, string) constructor calls with no-op
      //    e.g. Function("r","regeneratorRuntime = r")(d) → (function(r){})(d)
      transformed = transformed.replace(
        /\bFunction\s*\(\s*"([^"]{1,20})"\s*,\s*"[^"]*"\s*\)/g,
        '(function($1){})'
      );

      // 5. Replace remaining Function(expr) dynamic function creation with no-op
      //    Only when Function is called with a single expression that isn't
      //    part of typeof/instanceof checks
      transformed = transformed.replace(
        /([^.\w$])Function\(([^)]+)\)/g,
        (match, prefix, args) => {
          // Don't replace if it's typeof Function or similar
          if (prefix === '.') return match;
          return `${prefix}(function(){return function(){return globalThis}})(${args})`;
        }
      );

      if (transformed !== code) {
        return { code: transformed, map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    stripUnsafeEval(),
    react(),
    tailwindcss(),
  ],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
