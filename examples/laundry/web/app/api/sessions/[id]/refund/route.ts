import { store } from "@/lib/store";

/** Refunds a session that failed, from the dashboard. */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = store.refund((await params).id);
	return session
		? Response.json(session)
		: Response.json({ error: "not-refundable" }, { status: 409 });
}
