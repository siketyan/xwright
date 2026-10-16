import { courses, store } from "@/lib/store";

/** The machines and the courses, for the app. */
export function GET() {
	const machines = [...store.machines.values()]
		.sort((a, b) => a.number - b.number)
		.map((machine) => ({
			id: machine.id,
			number: machine.number,
			available:
				machine.online &&
				machine.sessionId === undefined &&
				machine.status.state === "idle",
		}));
	return Response.json({ machines, courses });
}
