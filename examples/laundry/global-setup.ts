import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const PORT = Number(process.env.PORT ?? 3000);
export const baseURL = `http://localhost:${PORT}`;

/** Starts the server of `web`, built by `pnpm build` beforehand, for the whole run. */
export default async function globalSetup(): Promise<() => Promise<void>> {
	const web = fileURLToPath(new URL("web", import.meta.url));
	const next = createRequire(`${web}/`).resolve("next/dist/bin/next");
	const server = spawn(
		process.execPath,
		[next, "start", "--port", String(PORT)],
		{ cwd: web, stdio: ["ignore", "ignore", "inherit"] },
	);
	const exited = new Promise<void>((resolve) =>
		server.once("exit", () => resolve()),
	);
	const deadline = Date.now() + 30_000;
	for (;;) {
		if (server.exitCode !== null) {
			throw new Error(
				`The server exited with ${server.exitCode}. Has it been built with \`pnpm build\`?`,
			);
		}
		try {
			await fetch(`${baseURL}/api/machines`);
			break;
		} catch {
			if (Date.now() > deadline) {
				server.kill();
				throw new Error(`The server did not start on ${baseURL}`);
			}
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}
	return async () => {
		server.kill();
		await exited;
	};
}
