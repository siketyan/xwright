/** A course of washing, chosen on the app. */
export interface Course {
	id: string;
	name: string;
	minutes: number;
	/** The price in yen. */
	price: number;
}

export const courses: Course[] = [
	{ id: "standard", name: "Standard", minutes: 40, price: 500 },
	{ id: "quick", name: "Quick", minutes: 20, price: 300 },
];

/** What a washer reports whenever its state changes. */
export interface WasherStatus {
	door: "open" | "closed";
	state: "idle" | "running" | "finished" | "error";
	remainingMinutes?: number;
	errorCode?: string;
}

/** What the server tells a washer to do. */
export type WasherCommand =
	| { type: "start"; course: string; minutes: number }
	| { type: "reset" };

export interface Machine {
	id: string;
	number: number;
	online: boolean;
	status: WasherStatus;
	/** The session using the machine, until the laundry is taken out. */
	sessionId?: string;
}

export interface Session {
	id: string;
	machineId: string;
	course: Course;
	state:
		| "starting"
		| "running"
		| "finished"
		| "failed"
		| "stopped"
		| "refunded";
	remainingMinutes?: number;
	errorCode?: string;
	createdAt: string;
}

/** Why a session could not start. */
export type StartError = "not-found" | "offline" | "busy" | "door-open";

type Send = (command: WasherCommand) => void;

/** The state of the store, kept in memory for the whole process. */
class Store {
	readonly machines = new Map<string, Machine>();
	readonly sessions = new Map<string, Session>();
	private readonly connections = new Map<string, Send>();
	private nextSession = 1;

	/** Called when a washer connects, with the function that sends it commands. */
	connect(id: string, number: number, send: Send): () => void {
		const machine = this.machines.get(id);
		this.machines.set(id, {
			id,
			number,
			online: true,
			status: machine?.status ?? { door: "closed", state: "idle" },
			sessionId: machine?.sessionId,
		});
		this.connections.set(id, send);
		return () => {
			// A new connection of the same washer may have replaced this one.
			if (this.connections.get(id) !== send) {
				return;
			}
			this.connections.delete(id);
			const current = this.machines.get(id);
			if (current) {
				current.online = false;
			}
		};
	}

	/** Applies the status a washer reported, and moves its session along. */
	report(id: string, status: WasherStatus): boolean {
		const machine = this.machines.get(id);
		if (!machine) {
			return false;
		}
		machine.status = status;
		const session = machine.sessionId
			? this.sessions.get(machine.sessionId)
			: undefined;
		if (!session) {
			return true;
		}
		session.remainingMinutes = status.remainingMinutes;
		switch (status.state) {
			case "running":
				session.state = "running";
				break;
			case "finished":
				session.state = "finished";
				break;
			case "error":
				if (session.state === "starting" || session.state === "running") {
					session.state = "failed";
					session.errorCode = status.errorCode;
				}
				break;
			case "idle":
				// Reset while washing, or the laundry was taken out after it finished.
				if (session.state === "starting" || session.state === "running") {
					session.state = "stopped";
				}
				machine.sessionId = undefined;
				break;
		}
		return true;
	}

	/** Takes the payment and starts the machine. */
	start(machineId: string, course: Course): Session | StartError {
		const machine = this.machines.get(machineId);
		const send = this.connections.get(machineId);
		if (!machine) {
			return "not-found";
		}
		if (!machine.online || !send) {
			return "offline";
		}
		if (machine.sessionId || machine.status.state !== "idle") {
			return "busy";
		}
		if (machine.status.door === "open") {
			return "door-open";
		}
		const session: Session = {
			id: String(this.nextSession++),
			machineId,
			course,
			state: "starting",
			createdAt: new Date().toISOString(),
		};
		this.sessions.set(session.id, session);
		machine.sessionId = session.id;
		send({ type: "start", course: course.id, minutes: course.minutes });
		return session;
	}

	/** Refunds a session that failed. */
	refund(sessionId: string): Session | undefined {
		const session = this.sessions.get(sessionId);
		if (session?.state !== "failed") {
			return undefined;
		}
		session.state = "refunded";
		return session;
	}

	/** Tells a machine to reset, such as after an error. */
	reset(machineId: string): boolean {
		const send = this.connections.get(machineId);
		send?.({ type: "reset" });
		return send !== undefined;
	}

	/** The sales in yen, without the refunded sessions. */
	sales(): number {
		let total = 0;
		for (const session of this.sessions.values()) {
			if (session.state !== "refunded") {
				total += session.course.price;
			}
		}
		return total;
	}
}

// Route handlers and pages may be bundled separately, so the store lives on the global object.
const global = globalThis as typeof globalThis & { laundryStore?: Store };
global.laundryStore ??= new Store();

export const store = global.laundryStore;
