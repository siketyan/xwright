import { store } from "@/lib/store";

/** Tells the machine to reset, from the dashboard. */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	return store.reset(id)
		? new Response(null, { status: 204 })
		: Response.json({ error: "offline" }, { status: 409 });
}
