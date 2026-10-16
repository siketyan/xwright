import { store } from "@/lib/store";

/** Everything the dashboard shows. */
export function GET() {
	const machines = [...store.machines.values()].sort(
		(a, b) => a.number - b.number,
	);
	const sessions = [...store.sessions.values()].reverse().slice(0, 20);
	return Response.json({ machines, sessions, sales: store.sales() });
}
