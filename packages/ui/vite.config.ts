import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	// The viewer is served under any path, next to the trace it shows.
	base: "./",
});
