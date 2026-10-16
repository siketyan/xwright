import { store } from "@/lib/store";

/** The session, which the app polls while washing. */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = store.sessions.get((await params).id);
	return session
		? Response.json(session)
		: Response.json({ error: "not-found" }, { status: 404 });
}
