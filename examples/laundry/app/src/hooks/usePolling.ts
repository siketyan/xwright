import { useEffect } from "react";

/** Calls `fn` now and every second, while the component is shown. */
export function usePolling(fn: () => Promise<void>, deps: unknown[]) {
	useEffect(() => {
		let active = true;
		const poll = () => {
			if (active) {
				fn().catch(() => {});
			}
		};
		poll();
		const timer = setInterval(poll, 1000);
		return () => {
			active = false;
			clearInterval(timer);
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: the caller lists the dependencies of `fn`.
	}, deps);
}
