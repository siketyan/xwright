import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { getSession, type Machine, type Session } from "../api";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { WasherIcon } from "../components/WasherIcon";
import { usePolling } from "../hooks/usePolling";
import { colors, typography } from "../theme";

/** A wash after it started, until the laundry is ready, or the washer broke down. */
export function SessionScreen({
	machine,
	initial,
	onBack,
}: {
	machine: Machine;
	initial: Session;
	onBack: () => void;
}) {
	const [session, setSession] = useState(initial);
	usePolling(
		async () => setSession(await getSession(initial.id)),
		[initial.id],
	);

	const active = session.state === "starting" || session.state === "running";
	const progress =
		session.state === "running"
			? 1 - (session.remainingMinutes ?? 0) / session.course.minutes
			: session.state === "finished"
				? 1
				: 0;
	return (
		<>
			<Card style={styles.hero}>
				<Text style={typography.muted}>
					Washer {machine.number} · {session.course.name}
				</Text>
				<WasherIcon
					size={168}
					water={active ? Math.max(progress, 0.15) : progress}
					tone={session.state === "failed" ? "danger" : "primary"}
				/>
				<SessionState session={session} />
				{session.state === "running" && <ProgressBar progress={progress} />}
			</Card>
			{!active && (
				<Button label="Back to washers" variant="secondary" onPress={onBack} />
			)}
		</>
	);
}

function SessionState({ session }: { session: Session }) {
	switch (session.state) {
		case "starting":
			return <Text style={styles.title}>Starting…</Text>;
		case "running":
			return (
				<>
					<Text style={styles.title}>Washing</Text>
					<Text style={styles.remaining}>
						{session.remainingMinutes} min left
					</Text>
				</>
			);
		case "finished":
			return (
				<>
					<Badge tone="success">Done</Badge>
					<Text style={styles.title}>Your laundry is ready</Text>
					<Text style={typography.muted}>Take it out of the washer.</Text>
				</>
			);
		case "failed":
			return (
				<>
					<Badge tone="danger">Error {session.errorCode}</Badge>
					<Text style={[styles.title, styles.danger]}>
						The washer stopped with error {session.errorCode}
					</Text>
					<Text style={typography.muted}>
						The staff will refund the payment.
					</Text>
				</>
			);
		case "refunded":
			return (
				<>
					<Badge tone="neutral">Refund</Badge>
					<Text style={styles.title}>Refunded ¥{session.course.price}</Text>
				</>
			);
		case "stopped":
			return <Text style={styles.title}>Washing was stopped</Text>;
	}
}

const styles = StyleSheet.create({
	hero: {
		alignItems: "center",
		gap: 10,
		paddingVertical: 24,
	},
	title: {
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
});
