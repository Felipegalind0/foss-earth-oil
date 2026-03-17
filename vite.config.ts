import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  base: "/foss-earth-oil/",
  plugins: [cesium()],
  optimizeDeps: {
    exclude: ["foss-earth"],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
