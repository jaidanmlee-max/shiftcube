import { defineConfig } from "vite";

// Base is "./" so the build works on GitHub Pages / Netlify / Vercel sub-paths.
export default defineConfig({
  base: "./",
  server: { open: false },
});
