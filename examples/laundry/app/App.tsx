import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

// The emulator of Android reaches the host at 10.0.2.2.
const apiURL =
	process.env.EXPO_PUBLIC_API_URL ??
	(Platform.OS === "android"
		? "http://10.0.2.2:3000"
		: "http://localhost:3000");

interface Machine {
	id: string;
	number: number;
	available: boolean;
}

interface Course {
	id: string;
	name: string;
	minutes: number;
	price: number;
}

interface Session {
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

type Screen =
	| { name: "machines" }
	| { name: "machine"; machine: Machine; courses: Course[] }
	| { name: "session"; machine: Machine; session: Session };

const startErrors: Record<string, string> = {
	"door-open": "Close the door and try again.",
	busy: "This washer is in use.",
	offline: "This washer is offline.",
};

/** Calls `fn` now and every second, while the component is shown. */
function usePolling(fn: () => Promise<void>, deps: unknown[]) {
	useEffect(() => {
		let active = true;
		const poll = () => {
			if (active) {
				fn().catch(() => {});
			}
		};
		poll();
		const timer = setInterval(poll, 1000);
		return () => {
			active = false;
			clearInterval(timer);
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: the caller lists the dependencies of `fn`.
	}, deps);
}

export function App() {
	const [screen, setScreen] = useState<Screen>({ name: "machines" });
	return (
		<View style={styles.container}>
			<StatusBar style="auto" />
			{screen.name === "machines" && (
				<MachinesScreen
					onSelect={(machine, courses) =>
						setScreen({ name: "machine", machine, courses })
					}
				/>
			)}
			{screen.name === "machine" && (
				<MachineScreen
					machine={screen.machine}
					courses={screen.courses}
					onBack={() => setScreen({ name: "machines" })}
					onStart={(session) =>
						setScreen({ name: "session", machine: screen.machine, session })
					}
				/>
			)}
			{screen.name === "session" && (
				<SessionScreen
					machine={screen.machine}
					initial={screen.session}
					onBack={() => setScreen({ name: "machines" })}
				/>
			)}
		</View>
	);
}

function MachinesScreen({
	onSelect,
}: {
	onSelect: (machine: Machine, courses: Course[]) => void;
}) {
	const [data, setData] = useState<{
		machines: Machine[];
		courses: Course[];
	}>();
	usePolling(async () => {
		const response = await fetch(`${apiURL}/api/machines`);
		setData(await response.json());
	}, []);

	return (
		<View>
			<Text style={styles.title}>Washers</Text>
			{!data && <Text>Loading…</Text>}
			{data?.machines.length === 0 && <Text>No washers are connected.</Text>}
			{data?.machines.map((machine) => (
				<Button
					key={machine.id}
					label={`Washer ${machine.number}`}
					disabled={!machine.available}
					onPress={() => onSelect(machine, data.courses)}
				>
					<Text style={styles.buttonText}>Washer {machine.number}</Text>
					<Text>{machine.available ? "Available" : "In use"}</Text>
				</Button>
			))}
		</View>
	);
}

function MachineScreen({
	machine,
	courses,
	onBack,
	onStart,
}: {
	machine: Machine;
	courses: Course[];
	onBack: () => void;
	onStart: (session: Session) => void;
}) {
	const [course, setCourse] = useState(courses[0]);
	const [error, setError] = useState<string>();

	const start = async () => {
		setError(undefined);
		const response = await fetch(`${apiURL}/api/sessions`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ machineId: machine.id, courseId: course?.id }),
		});
		const body = await response.json();
		if (response.ok) {
			onStart(body);
		} else {
			setError(startErrors[body.error] ?? "Could not start the washer.");
		}
	};

	return (
		<View>
			<Text style={styles.title}>Washer {machine.number}</Text>
			{courses.map((item) => (
				<Button
					key={item.id}
					label={item.name}
					selected={item.id === course?.id}
					onPress={() => setCourse(item)}
				>
					<Text style={styles.buttonText}>{item.name}</Text>
					<Text>
						{item.minutes} min · ¥{item.price}
					</Text>
				</Button>
			))}
			{error && <Text style={styles.error}>{error}</Text>}
			<Button label="Pay and start" primary onPress={start}>
				<Text style={[styles.buttonText, styles.primaryText]}>
					Pay ¥{course?.price} and start
				</Text>
			</Button>
			<Button label="Back" onPress={onBack}>
				<Text style={styles.buttonText}>Back</Text>
			</Button>
		</View>
	);
}

function SessionScreen({
	machine,
	initial,
	onBack,
}: {
	machine: Machine;
	initial: Session;
	onBack: () => void;
}) {
	const [session, setSession] = useState(initial);
	usePolling(async () => {
		const response = await fetch(`${apiURL}/api/sessions/${initial.id}`);
		setSession(await response.json());
	}, [initial.id]);

	return (
		<View>
			<Text style={styles.title}>Washer {machine.number}</Text>
			<SessionState session={session} />
			{session.state !== "starting" && session.state !== "running" && (
				<Button label="Back to washers" onPress={onBack}>
					<Text style={styles.buttonText}>Back to washers</Text>
				</Button>
			)}
		</View>
	);
}

function SessionState({ session }: { session: Session }) {
	switch (session.state) {
		case "starting":
			return <Text style={styles.heading}>Starting…</Text>;
		case "running":
			return (
				<>
					<Text style={styles.heading}>Washing</Text>
					<Text>{session.remainingMinutes} min left</Text>
				</>
			);
		case "finished":
			return (
				<>
					<Text style={styles.heading}>Your laundry is ready</Text>
					<Text>Take it out of the washer.</Text>
				</>
			);
		case "failed":
			return (
				<>
					<Text style={[styles.heading, styles.error]}>
						The washer stopped with error {session.errorCode}
					</Text>
					<Text>The staff will refund the payment.</Text>
				</>
			);
		case "refunded":
			return (
				<Text style={styles.heading}>Refunded ¥{session.course.price}</Text>
			);
		case "stopped":
			return <Text style={styles.heading}>Washing was stopped</Text>;
	}
}

function Button({
	label,
	onPress,
	disabled,
	selected,
	primary,
	children,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	selected?: boolean;
	primary?: boolean;
	children: ReactNode;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled, selected }}
			disabled={disabled}
			onPress={onPress}
			style={[
				styles.button,
				selected && styles.selected,
				primary && styles.primary,
				disabled && styles.disabled,
			]}
		>
			{children}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		paddingHorizontal: 16,
		paddingTop: 48,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		marginBottom: 16,
	},
	heading: {
		fontSize: 20,
		fontWeight: "bold",
		marginBottom: 8,
	},
	button: {
		borderWidth: 1,
		borderColor: "#c5ccd6",
		borderRadius: 8,
		padding: 16,
		marginBottom: 12,
	},
	buttonText: {
		fontSize: 18,
		fontWeight: "600",
	},
	selected: {
		borderColor: "#1565c0",
		borderWidth: 2,
	},
	primary: {
		backgroundColor: "#1565c0",
		borderColor: "#1565c0",
	},
	primaryText: {
		color: "#fff",
	},
	disabled: {
		opacity: 0.5,
	},
	error: {
		color: "#c62828",
		marginBottom: 12,
	},
});
