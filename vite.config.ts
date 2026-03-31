import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// ── Copy client/public → dist after build ─────────────────────
// client/public holds fonts, animated GIFs, sfx.
// vite.config publicDir is the root public/ (game assets), so we
// manually copy client/public into the dist root as well.
function copyClientPublic(): Plugin {
  const srcDir = path.resolve(import.meta.dirname, "client", "public");
  const destDir = path.resolve(import.meta.dirname, "dist");

  function copyDirSync(src: string, dst: string) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        copyDirSync(srcPath, dstPath);
      } else if (!fs.existsSync(dstPath)) {
        // Don't overwrite existing files (root public takes precedence)
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  return {
    name: "copy-client-public",
    // Dev server: serve client/public as a fallback static middleware
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "/").split("?")[0];
        const filePath = path.join(srcDir, url);
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mime: Record<string, string> = {
              ".otf": "font/otf", ".ttf": "font/ttf", ".woff": "font/woff",
              ".woff2": "font/woff2", ".gif": "image/gif", ".png": "image/png",
              ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
            };
            res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
            fs.createReadStream(filePath).pipe(res as NodeJS.WritableStream);
            return;
          }
        } catch { /* ignore */ }
        next();
      });
    },
    // Build: copy after bundle is written
    closeBundle() {
      copyDirSync(srcDir, destDir);
    },
  };
}

export default defineConfig({
  plugins: [react(), copyClientPublic()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // BabylonJS → dedicated chunk (largest dep, only loaded on 3D pages)
          if (id.includes("node_modules/@babylonjs")) return "chunk-babylon";
          // Socket.io → small dedicated chunk
          if (id.includes("node_modules/socket.io-client") ||
              id.includes("node_modules/engine.io-client")) return "chunk-socket";
          // All other node_modules (react, react-dom, wouter, etc.) → vendor
          // Keep react in vendor to avoid circular chunk dependency
          if (id.includes("node_modules")) return "chunk-vendor";
        },
      },
    },
  },
  // Havok WASM + BabylonJS shader assets
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  assetsInclude: ["**/*.wasm"],
});
