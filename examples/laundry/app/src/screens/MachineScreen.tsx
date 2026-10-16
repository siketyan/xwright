import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { type Course, type Machine, type Session, startSession } from "../api";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CourseOption } from "../components/CourseOption";
import { WasherIcon } from "../components/WasherIcon";
import { colors, typography } from "../theme";

/** A washer, to choose a course, pay for it and start. */
export function MachineScreen({
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
		if (!course) {
			return;
		}
		setError(undefined);
		const result = await startSession(machine, course);
		if ("session" in result) {
			onStart(result.session);
		} else {
			setError(result.error);
		}
	};

	return (
		<View>
			<BackLink text="Washers" onPress={onBack} />
			<Card style={styles.hero}>
				<WasherIcon size={120} water={0} />
				<Text style={styles.name}>Washer {machine.number}</Text>
				<Text style={typography.muted}>Choose a course</Text>
			</Card>
			{courses.map((item) => (
				<CourseOption
					key={item.id}
					course={item}
					selected={item.id === course?.id}
					onPress={() => setCourse(item)}
				/>
			))}
			{error && (
				<View style={styles.error}>
					<Text style={styles.errorText}>{error}</Text>
				</View>
			)}
			<Button
				label="Pay and start"
				text={`Pay ¥${course?.price} and start`}
				onPress={start}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	hero: {
		alignItems: "center",
		gap: 10,
		paddingVertical: 24,
	},
	name: {
		fontSize: 24,
		fontWeight: "700",
		color: colors.text,
	},
	error: {
		borderRadius: 12,
		padding: 12,
		marginBottom: 12,
		backgroundColor: colors.dangerSoft,
	},
	errorText: {
		color: colors.danger,
		fontWeight: "600",
	},
});
