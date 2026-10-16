import { store } from "@/lib/store";

/**
 * Connects a washer, and streams the commands to it as server-sent events for as long as it stays connected. The
 * washer tells its number in `?number=`.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const number = Number(new URL(request.url).searchParams.get("number"));
	if (!Number.isInteger(number) || number < 1) {
		return Response.json({ error: "invalid-number" }, { status: 400 });
	}
	const encoder = new TextEncoder();
	let disconnect = () => {};
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			disconnect = store.connect(id, number, (command) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(command)}\n\n`),
				);
			});
			// Tells the washer that it is connected.
			controller.enqueue(encoder.encode(": connected\n\n"));
			request.signal.addEventListener("abort", () => {
				disconnect();
				// The stream may have been canceled already.
				try {
					controller.close();
				} catch {}
			});
		},
		cancel() {
			disconnect();
		},
	});
	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
		},
	});
}

export const dynamic = "force-dynamic";
