// Modo de visualização local: roda o app com dados de exemplo, sem Firebase e sem login.
// Uso: npx vite --config preview/vite.preview.config.ts  (abre em http://localhost:5199)
// Nada daqui entra no build de produção.
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../src");

const swaps: Record<string, string> = {
  [path.join(src, "lib/db.ts")]: path.join(here, "mock-db.ts"),
  [path.join(src, "lib/adminDb.ts")]: path.join(here, "mock-admin-db.ts"),
  [path.join(src, "lib/firebase.ts")]: path.join(here, "mock-firebase.ts"),
  [path.join(src, "context/AuthContext.tsx")]: path.join(here, "mock-auth.tsx"),
};

function mockSwap(): Plugin {
  return {
    name: "dealshot-preview-mocks",
    enforce: "pre",
    async resolveId(source, importer, opts) {
      if (!importer || importer.startsWith(here)) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      if (!r) return null;
      const target = swaps[path.normalize(r.id)];
      return target ?? null;
    },
  };
}

export default defineConfig({
  root: path.resolve(here, ".."),
  plugins: [mockSwap(), react()],
  server: { port: 5199, strictPort: true },
});
