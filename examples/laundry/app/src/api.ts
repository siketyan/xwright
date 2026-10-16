import { Platform } from "react-native";

// The emulator of Android reaches the host at 10.0.2.2.
const apiURL =
	process.env.EXPO_PUBLIC_API_URL ??
	(Platform.OS === "android"
		? "http://10.0.2.2:3000"
		: "http://localhost:3000");

export interface Machine {
	id: string;
	number: number;
	available: boolean;
}

export interface Course {
	id: string;
	name: string;
	minutes: number;
	price: number;
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
}

const startErrors: Record<string, string> = {
	"door-open": "Close the door and try again.",
	busy: "This washer is in use.",
	offline: "This washer is offline.",
};

/** The machines of the laundry, and the courses they run. */
export async function getMachines(): Promise<{
	machines: Machine[];
	courses: Course[];
}> {
	const response = await fetch(`${apiURL}/api/machines`);
	return response.json();
}

/** Pays for the course and starts the machine, or tells why it could not. */
export async function startSession(
	machine: Machine,
	course: Course,
): Promise<{ session: Session } | { error: string }> {
	const response = await fetch(`${apiURL}/api/sessions`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ machineId: machine.id, courseId: course.id }),
	});
	const body = await response.json();
	return response.ok
		? { session: body }
		: { error: startErrors[body.error] ?? "Could not start the washer." };
}

export async function getSession(id: string): Promise<Session> {
	const response = await fetch(`${apiURL}/api/sessions/${id}`);
	return response.json();
}
