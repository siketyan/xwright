import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { type Course, getMachines, type Machine } from "../api";
import { Card } from "../components/Card";
import { MachineCard } from "../components/MachineCard";
import { usePolling } from "../hooks/usePolling";
import { typography } from "../theme";

/** The washers of the laundry, to choose one that is available. */
export function MachinesScreen({
	onSelect,
}: {
	onSelect: (machine: Machine, courses: Course[]) => void;
}) {
	const [data, setData] = useState<{
		machines: Machine[];
		courses: Course[];
	}>();
	usePolling(async () => setData(await getMachines()), []);

	const available = data?.machines.filter((machine) => machine.available);
	return (
		<View>
			<Text style={typography.title}>Washers</Text>
			<Text style={[typography.muted, styles.subtitle]}>
				{data
					? `${available?.length} of ${data.machines.length} available`
					: "Loading…"}
			</Text>
			{data?.machines.length === 0 && (
				<Card>
					<Text style={typography.muted}>No washers are connected.</Text>
				</Card>
			)}
			<View style={styles.grid}>
				{data?.machines.map((machine) => (
					<MachineCard
						key={machine.id}
						machine={machine}
						onPress={() => onSelect(machine, data.courses)}
					/>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	subtitle: {
		marginTop: 2,
		marginBottom: 16,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
	},
});
