import { defineAdapter, type Tracer } from "xwright";

/** The options of {@link fakeWasher}. */
export interface FakeWasherOptions {
	/** The URL of the server the washer connects to, e.g. `http://localhost:3000`. */
	baseURL: string;
}

/** What the server tells the washer to do. */
export type WasherCommand =
	| { type: "start"; course: string; minutes: number }
	| { type: "reset" };

/** What the washer reports to the server whenever its state changes. */
export interface WasherStatus {
	door: "open" | "closed";
	state: "idle" | "running" | "finished" | "error";
	remainingMinutes?: number;
	errorCode?: string;
}

const defaultTimeout = 10_000;

/** The time on the monotonic clock of the host, in milliseconds, as in the trace. */
function hostTime(): number {
	return Number(process.hrtime.bigint()) / 1e6;
}

/**
 * A washer that runs in the test instead of a real one. It connects to the server like a real washer does, takes its
 * commands, and lets the test do what a person or the machine would: open the door, let time pass, or break.
 *
 * Time does not pass on its own: a cycle runs only as far as {@link advance} moves it, so the tests never wait.
 */
export class FakeWasher {
	/** The ID the server knows the washer by. */
	readonly id: string;
	/** The number on the washer, as people see it, e.g. `Washer 1`. */
	readonly number: number;
	/** The commands received since the last test started, oldest first. */
	readonly commands: WasherCommand[] = [];

	private status: WasherStatus = { door: "closed", state: "idle" };
	private readonly waiters = new Set<() => void>();
	private taken = 0;
	private readonly abort = new AbortController();

	constructor(
		private readonly baseURL: string,
		number: number,
		private readonly trace: Tracer,
	) {
		this.number = number;
		this.id = `washer-${number}`;
	}

	/** The state the washer is in now. */
	get state(): Readonly<WasherStatus> {
		return this.status;
	}

	/** Connects to the server and starts taking commands. */
	async connect(): Promise<void> {
		const response = await fetch(
			new URL(
				`/api/devices/${this.id}/commands?number=${this.number}`,
				this.baseURL,
			),
			{ signal: this.abort.signal },
		);
		if (!response.ok || !response.body) {
			throw new Error(
				`${this.id} could not connect to ${this.baseURL}: ${response.status}`,
			);
		}
		const lines = response.body
			.pipeThrough(new TextDecoderStream())
			.getReader();
		// Reads the events in the background, until the washer disconnects.
		void (async () => {
			let buffer = "";
			try {
				for (;;) {
					const { value, done } = await lines.read();
					if (done) {
						return;
					}
					buffer += value;
					let end = buffer.indexOf("\n\n");
					while (end >= 0) {
						const event = buffer.slice(0, end);
						buffer = buffer.slice(end + 2);
						if (event.startsWith("data: ")) {
							this.receive(JSON.parse(event.slice("data: ".length)));
						}
						end = buffer.indexOf("\n\n");
					}
				}
			} catch (error) {
				if (!this.abort.signal.aborted) {
					this.trace.log({
						level: "error",
						text: `${this.id} lost the connection: ${error}`,
					});
				}
			}
		})();
		await this.report();
	}

	/** Disconnects from the server. */
	disconnect(): void {
		this.abort.abort();
	}

	/** Puts the washer back to idle with the door closed, as before each test. */
	async reset(): Promise<void> {
		this.commands.length = 0;
		this.taken = 0;
		this.status = { door: "closed", state: "idle" };
		await this.report();
	}

	/**
	 * Waits for a command of the type that no earlier call has returned, and returns it.
	 */
	waitForCommand<T extends WasherCommand["type"]>(
		type: T,
		{ timeout = defaultTimeout }: { timeout?: number } = {},
	): Promise<Extract<WasherCommand, { type: T }>> {
		return this.trace.action(
			{ title: `waitForCommand ${type}`, params: { type } },
			() =>
				new Promise((resolve, reject) => {
					const check = () => {
						const index = this.commands.findIndex(
							(command, index) => index >= this.taken && command.type === type,
						);
						if (index < 0) {
							return;
						}
						this.taken = index + 1;
						this.waiters.delete(check);
						clearTimeout(timer);
						resolve(
							this.commands[index] as Extract<WasherCommand, { type: T }>,
						);
					};
					const timer = setTimeout(() => {
						this.waiters.delete(check);
						reject(
							new Error(
								`${this.id} received no "${type}" command in ${timeout}ms`,
							),
						);
					}, timeout);
					this.waiters.add(check);
					check();
				}),
		);
	}

	/** Opens the door, as a person does. The laundry is taken out when the cycle has finished. */
	openDoor(): Promise<void> {
		return this.act("openDoor", {}, () => {
			if (this.status.state === "running") {
				throw new Error(`The door of ${this.id} is locked while washing`);
			}
			this.status = {
				...this.status,
				door: "open",
				state: this.status.state === "finished" ? "idle" : this.status.state,
			};
		});
	}

	/** Closes the door, as a person does. */
	closeDoor(): Promise<void> {
		return this.act("closeDoor", {}, () => {
			this.status = { ...this.status, door: "closed" };
		});
	}

	/** Lets the cycle run for the minutes, finishing it when no time is left. */
	advance(minutes: number): Promise<void> {
		return this.act("advance", { minutes }, () => {
			const remaining = this.running().remainingMinutes ?? 0;
			this.status =
				remaining > minutes
					? { ...this.status, remainingMinutes: remaining - minutes }
					: { door: this.status.door, state: "finished" };
		});
	}

	/** Lets the cycle run to the end. */
	finishCycle(): Promise<void> {
		return this.act("finishCycle", {}, () => {
			this.running();
			this.status = { door: this.status.door, state: "finished" };
		});
	}

	/** Breaks down with the error code, such as `E11` for a water supply error. */
	fail(code: string): Promise<void> {
		return this.act("fail", { code }, () => {
			this.status = { door: this.status.door, state: "error", errorCode: code };
		});
	}

	private running(): WasherStatus {
		if (this.status.state !== "running") {
			throw new Error(`${this.id} is not running, but ${this.status.state}`);
		}
		return this.status;
	}

	/** Runs an operation of the test as an action on the timeline, and reports the state it leads to. */
	private act(
		title: string,
		params: Record<string, unknown>,
		change: () => void,
	): Promise<void> {
		return this.trace.action({ title, params }, async () => {
			change();
			await this.report();
		});
	}

	/** Does what the server told, as an action on the timeline. */
	private receive(command: WasherCommand): void {
		const span = this.trace.begin({
			title: `receive ${command.type}`,
			params: command,
		});
		this.commands.push(command);
		switch (command.type) {
			case "start":
				// The server checks the door and the state first, but a real washer would not trust that either.
				if (this.status.state === "idle" && this.status.door === "closed") {
					this.status = {
						door: "closed",
						state: "running",
						remainingMinutes: command.minutes,
					};
				}
				break;
			case "reset":
				this.status = { door: this.status.door, state: "idle" };
				break;
		}
		this.report().then(
			() => this.trace.end(span),
			(error: unknown) => this.trace.end(span, { error }),
		);
		for (const waiter of [...this.waiters]) {
			waiter();
		}
	}

	/** Reports the state to the server. */
	private async report(): Promise<void> {
		const url = new URL(`/api/devices/${this.id}/status`, this.baseURL).href;
		const body = JSON.stringify(this.status);
		const startTime = hostTime();
		const response = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		});
		this.trace.resource({
			type: "xwright.http@1",
			target: url,
			status: response.status,
			request: {
				method: "POST",
				url,
				postData: { mimeType: "application/json", text: body },
			},
			response: { status: response.status },
			startTime,
			endTime: hostTime(),
		});
		if (!response.ok) {
			throw new Error(
				`${this.id} could not report its state: ${response.status}`,
			);
		}
	}
}

/**
 * The adapter of a fake washer. Each worker connects its own washer, numbered from 1, so that tests running in
 * parallel never share one.
 *
 * ```ts
 * devices: { washer: { adapter: fakeWasher({ baseURL: "http://localhost:3000" }) } }
 * ```
 */
export const fakeWasher = defineAdapter<FakeWasherOptions, FakeWasher>({
	name: "example-laundry-fake-washer",
	async create({ options, trace, workerInfo }) {
		const washer = new FakeWasher(
			options.baseURL,
			workerInfo.parallelIndex + 1,
			trace,
		);
		await washer.connect();
		return washer;
	},
	beforeEach: (washer) => washer.reset(),
	onFailure(washer, { trace }) {
		trace.snapshot({
			type: "example.washer-state@1",
			payload: { state: washer.state, commands: washer.commands },
		});
	},
	dispose: (washer) => washer.disconnect(),
});
