import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import path from "node:path";
const here = path.resolve(import.meta.dirname);
export default defineConfig({
  root: here,
  plugins: [react(), svgrPlugin()],
  resolve: {
    alias: [
      { find: /^(\.\.?\/)+contexts\/AuthContext$/, replacement: path.resolve(here, "AuthStub.tsx") },
      { find: /^(\.\.?\/)+contexts\/ConfigContext$/, replacement: path.resolve(here, "ConfigStub.tsx") },
      { find: /^\.\/AuthContext$/, replacement: path.resolve(here, "AuthStub.tsx") },
    ],
  },
  server: { port: 3100, strictPort: true, fs: { allow: [path.resolve(here, "..")] } },
  cacheDir: path.resolve(here, ".cache"),
});
