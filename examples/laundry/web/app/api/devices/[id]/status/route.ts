import { store, type WasherStatus } from "@/lib/store";

/** Takes the status a washer reports whenever its state changes. */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const status: WasherStatus = await request.json();
	return store.report((await params).id, status)
		? new Response(null, { status: 204 })
		: Response.json({ error: "not-connected" }, { status: 404 });
}
