/**
 * The values the handles of the running worker point to, by device name. The lifecycle of the adapters puts them here,
 * and every handle that `use()` returned looks them up on each access.
 */
const targets = new Map<string, object>();

export function setTarget(name: string, target: object): void {
	targets.set(name, target);
}

export function deleteTarget(name: string): void {
	targets.delete(name);
}

export function getTarget(name: string): object {
	const target = targets.get(name);
	if (target === undefined) {
		throw new Error(
			`Device "${name}" is not available here. Use its handle inside a test or a hook.`,
		);
	}
	return target;
}
