/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// getViteConfig loads Astro's Vite plugins so tests can import modules that pull in .astro
// components (e.g. the block registry). Path aliases come from tsconfig.json.
export default getViteConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
