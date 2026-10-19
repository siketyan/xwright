import { spawn } from "node:child_process";

/**
 * Runs a CLI of Node.js, such as the one of a library an adapter depends on, with the output to the terminal, for
 * `install` of an adapter. Rejects when it exits with an error.
 */
export async function runNodeCli(
	script: string,
	args: string[],
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(process.execPath, [script, ...args], {
			stdio: "inherit",
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) {
				resolve();
			} else {
				reject(
					new Error(
						`${script} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`,
					),
				);
			}
		});
	});
}
