import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const endpoint = `https://api.thegraph.com`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: endpoint,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
