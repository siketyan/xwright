import { courses, store } from "@/lib/store";

/** Pays for a course and starts the machine, from the app. */
export async function POST(request: Request) {
	const { machineId, courseId } = await request.json();
	const course = courses.find((course) => course.id === courseId);
	if (!course) {
		return Response.json({ error: "unknown-course" }, { status: 400 });
	}
	const result = store.start(String(machineId), course);
	if (typeof result === "string") {
		return Response.json(
			{ error: result },
			{ status: result === "not-found" ? 404 : 409 },
		);
	}
	return Response.json(result, { status: 201 });
}
