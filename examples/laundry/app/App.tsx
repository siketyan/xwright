import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useState } from "react";
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

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

const colors = {
	primary: "#1d6fd8",
	primaryDark: "#0f4fa8",
	water: "#5fb3f6",
	background: "#eef4fb",
	card: "#ffffff",
	text: "#0f1d33",
	muted: "#62708a",
	border: "#d9e3ef",
	success: "#14915a",
	successSoft: "#e3f6ec",
	danger: "#d33a3a",
	dangerSoft: "#fdeaea",
	neutralSoft: "#edf0f5",
};

export function App() {
	const [screen, setScreen] = useState<Screen>({ name: "machines" });
	return (
		<View style={styles.container}>
			<StatusBar style="light" />
			<View style={styles.header}>
				<Text style={styles.brand}>Laundry</Text>
				<Text style={styles.brandSub}>Coin laundry · Open 24 hours</Text>
			</View>
			<ScrollView contentContainerStyle={styles.content}>
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
			</ScrollView>
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

	const available = data?.machines.filter((machine) => machine.available);
	return (
		<View>
			<Text style={styles.title}>Washers</Text>
			<Text style={styles.subtitle}>
				{data
					? `${available?.length} of ${data.machines.length} available`
					: "Loading…"}
			</Text>
			{data?.machines.length === 0 && (
				<View style={styles.card}>
					<Text style={styles.muted}>No washers are connected.</Text>
				</View>
			)}
			<View style={styles.grid}>
				{data?.machines.map((machine) => (
					<Pressable
						key={machine.id}
						accessibilityRole="button"
						accessibilityLabel={`Washer ${machine.number}`}
						accessibilityState={{ disabled: !machine.available }}
						disabled={!machine.available}
						onPress={() => onSelect(machine, data.courses)}
						style={({ pressed }) => [
							styles.card,
							styles.machineCard,
							pressed && styles.pressed,
						]}
					>
						<WasherIcon
							size={72}
							water={machine.available ? 0 : 0.5}
							dimmed={!machine.available}
						/>
						<Text style={styles.machineName}>Washer {machine.number}</Text>
						<Badge tone={machine.available ? "success" : "neutral"}>
							{machine.available ? "Available" : "In use"}
						</Badge>
					</Pressable>
				))}
			</View>
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
			<BackLink label="Back" text="Washers" onPress={onBack} />
			<View style={[styles.card, styles.hero]}>
				<WasherIcon size={120} water={0} />
				<Text style={styles.heroTitle}>Washer {machine.number}</Text>
				<Text style={styles.muted}>Choose a course</Text>
			</View>
			{courses.map((item) => {
				const selected = item.id === course?.id;
				return (
					<Pressable
						key={item.id}
						accessibilityRole="button"
						accessibilityLabel={item.name}
						accessibilityState={{ selected }}
						onPress={() => setCourse(item)}
						style={[styles.card, styles.course, selected && styles.selected]}
					>
						<View style={[styles.radio, selected && styles.radioOn]}>
							{selected && <View style={styles.radioDot} />}
						</View>
						<View style={styles.courseBody}>
							<Text style={styles.courseName}>{item.name}</Text>
							<Text style={styles.muted}>{item.minutes} min</Text>
						</View>
						<Text style={styles.price}>¥{item.price}</Text>
					</Pressable>
				);
			})}
			{error && (
				<View style={[styles.banner, styles.bannerDanger]}>
					<Text style={styles.bannerText}>{error}</Text>
				</View>
			)}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Pay and start"
				onPress={start}
				style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
			>
				<Text style={styles.primaryText}>Pay ¥{course?.price} and start</Text>
			</Pressable>
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

	const active = session.state === "starting" || session.state === "running";
	const progress =
		session.state === "running"
			? 1 - (session.remainingMinutes ?? 0) / session.course.minutes
			: session.state === "finished"
				? 1
				: 0;
	return (
		<View>
			<View style={[styles.card, styles.hero]}>
				<Text style={styles.muted}>
					Washer {machine.number} · {session.course.name}
				</Text>
				<WasherIcon
					size={168}
					water={active ? Math.max(progress, 0.15) : progress}
					tone={session.state === "failed" ? "danger" : "primary"}
				/>
				<SessionState session={session} />
				{session.state === "running" && (
					<View style={styles.progressTrack}>
						<View
							style={[styles.progressBar, { width: `${progress * 100}%` }]}
						/>
					</View>
				)}
			</View>
			{!active && (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Back to washers"
					onPress={onBack}
					style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
				>
					<Text style={styles.secondaryText}>Back to washers</Text>
				</Pressable>
			)}
		</View>
	);
}

function SessionState({ session }: { session: Session }) {
	switch (session.state) {
		case "starting":
			return <Text style={styles.stateTitle}>Starting…</Text>;
		case "running":
			return (
				<>
					<Text style={styles.stateTitle}>Washing</Text>
					<Text style={styles.remaining}>
						{session.remainingMinutes} min left
					</Text>
				</>
			);
		case "finished":
			return (
				<>
					<Badge tone="success">Done</Badge>
					<Text style={styles.stateTitle}>Your laundry is ready</Text>
					<Text style={styles.muted}>Take it out of the washer.</Text>
				</>
			);
		case "failed":
			return (
				<>
					<Badge tone="danger">Error {session.errorCode}</Badge>
					<Text style={[styles.stateTitle, styles.danger]}>
						The washer stopped with error {session.errorCode}
					</Text>
					<Text style={styles.muted}>The staff will refund the payment.</Text>
				</>
			);
		case "refunded":
			return (
				<>
					<Badge tone="neutral">Refund</Badge>
					<Text style={styles.stateTitle}>
						Refunded ¥{session.course.price}
					</Text>
				</>
			);
		case "stopped":
			return <Text style={styles.stateTitle}>Washing was stopped</Text>;
	}
}

/**
 * A front-loading washer, with the water in its drum filled up to `water` (0 to 1), and its light red for `danger`.
 */
function WasherIcon({
	size,
	water,
	dimmed,
	tone = "primary",
}: {
	size: number;
	water: number;
	dimmed?: boolean;
	tone?: "primary" | "danger";
}) {
	const door = size * 0.62;
	return (
		<View
			style={[
				styles.washer,
				{ width: size, height: size * 1.12, borderRadius: size * 0.14 },
				dimmed && styles.dimmed,
			]}
		>
			<View style={styles.washerPanel}>
				<View style={styles.washerKnob} />
				<View
					style={[
						styles.washerLight,
						tone === "danger" && { backgroundColor: colors.danger },
					]}
				/>
			</View>
			<View
				style={[
					styles.washerDoor,
					{ width: door, height: door, borderRadius: door / 2 },
				]}
			>
				<View
					style={[
						styles.washerWater,
						{
							height: `${Math.min(Math.max(water, 0), 1) * 100}%`,
							backgroundColor: colors.water,
						},
					]}
				/>
			</View>
		</View>
	);
}

function Badge({
	tone,
	children,
}: {
	tone: "success" | "danger" | "neutral";
	children: ReactNode;
}) {
	return (
		<View style={[styles.badge, badgeStyles[tone]]}>
			<Text style={[styles.badgeText, { color: badgeColors[tone] }]}>
				{children}
			</Text>
		</View>
	);
}

function BackLink({
	label,
	text,
	onPress,
}: {
	label: string;
	text: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={styles.back}
		>
			<Text style={styles.backText}>‹ {text}</Text>
		</Pressable>
	);
}

const badgeColors = {
	success: colors.success,
	danger: colors.danger,
	neutral: colors.muted,
};

const badgeStyles = StyleSheet.create({
	success: { backgroundColor: colors.successSoft },
	danger: { backgroundColor: colors.dangerSoft },
	neutral: { backgroundColor: colors.neutralSoft },
});

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		backgroundColor: colors.primary,
		paddingTop: 56,
		paddingBottom: 20,
		paddingHorizontal: 20,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
	},
	brand: {
		color: "#fff",
		fontSize: 26,
		fontWeight: "800",
		letterSpacing: 0.5,
	},
	brandSub: {
		color: "#d6e6fb",
		marginTop: 2,
	},
	content: {
		padding: 16,
		paddingBottom: 40,
	},
	title: {
		fontSize: 22,
		fontWeight: "700",
		color: colors.text,
	},
	subtitle: {
		color: colors.muted,
		marginTop: 2,
		marginBottom: 16,
	},
	muted: {
		color: colors.muted,
	},
	card: {
		backgroundColor: colors.card,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 16,
		marginBottom: 12,
		shadowColor: "#1d3b66",
		shadowOpacity: 0.08,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
	},
	machineCard: {
		width: "48%",
		alignItems: "center",
		gap: 8,
	},
	machineName: {
		fontSize: 17,
		fontWeight: "700",
		color: colors.text,
	},
	pressed: {
		opacity: 0.7,
	},
	hero: {
		alignItems: "center",
		gap: 10,
		paddingVertical: 24,
	},
	heroTitle: {
		fontSize: 24,
		fontWeight: "700",
		color: colors.text,
	},
	course: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	selected: {
		borderColor: colors.primary,
		borderWidth: 2,
	},
	radio: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 2,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	radioOn: {
		borderColor: colors.primary,
	},
	radioDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: colors.primary,
	},
	courseBody: {
		flex: 1,
	},
	courseName: {
		fontSize: 17,
		fontWeight: "600",
		color: colors.text,
	},
	price: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.text,
	},
	banner: {
		borderRadius: 12,
		padding: 12,
		marginBottom: 12,
	},
	bannerDanger: {
		backgroundColor: colors.dangerSoft,
	},
	bannerText: {
		color: colors.danger,
		fontWeight: "600",
	},
	primary: {
		backgroundColor: colors.primary,
		borderRadius: 14,
		paddingVertical: 16,
		alignItems: "center",
		marginTop: 4,
	},
	primaryText: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "700",
	},
	secondary: {
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.primary,
		paddingVertical: 14,
		alignItems: "center",
	},
	secondaryText: {
		color: colors.primary,
		fontSize: 17,
		fontWeight: "600",
	},
	back: {
		alignSelf: "flex-start",
		paddingVertical: 4,
		marginBottom: 8,
	},
	backText: {
		color: colors.primary,
		fontSize: 16,
		fontWeight: "600",
	},
	stateTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: colors.text,
		textAlign: "center",
	},
	remaining: {
		fontSize: 34,
		fontWeight: "800",
		color: colors.primaryDark,
	},
	danger: {
		color: colors.danger,
	},
	progressTrack: {
		alignSelf: "stretch",
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.neutralSoft,
		overflow: "hidden",
	},
	progressBar: {
		height: "100%",
		borderRadius: 4,
		backgroundColor: colors.primary,
	},
	badge: {
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	badgeText: {
		fontSize: 13,
		fontWeight: "700",
	},
	washer: {
		backgroundColor: "#f7f9fc",
		borderWidth: 2,
		borderColor: colors.border,
		alignItems: "center",
		overflow: "hidden",
	},
	dimmed: {
		opacity: 0.5,
	},
	washerPanel: {
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: "12%",
		height: "18%",
		borderBottomWidth: 2,
		borderBottomColor: colors.border,
		marginBottom: "8%",
	},
	washerKnob: {
		width: "12%",
		aspectRatio: 1,
		borderRadius: 999,
		backgroundColor: colors.border,
	},
	washerLight: {
		width: "8%",
		aspectRatio: 1,
		borderRadius: 999,
		backgroundColor: colors.success,
	},
	washerDoor: {
		borderWidth: 5,
		borderColor: "#c4d2e3",
		backgroundColor: "#dfeaf6",
		overflow: "hidden",
		justifyContent: "flex-end",
	},
	washerWater: {
		width: "100%",
	},
});
