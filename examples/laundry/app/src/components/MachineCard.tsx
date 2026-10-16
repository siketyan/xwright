import { Pressable, StyleSheet, Text } from "react-native";
import type { Machine } from "../api";
import { colors } from "../theme";
import { Badge } from "./Badge";
import { styles as cardStyles } from "./Card";
import { WasherIcon } from "./WasherIcon";

/** A washer in the list, which opens it when available. */
export function MachineCard({
	machine,
	onPress,
}: {
	machine: Machine;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Washer ${machine.number}`}
			accessibilityState={{ disabled: !machine.available }}
			disabled={!machine.available}
			onPress={onPress}
			style={({ pressed }) => [
				cardStyles.card,
				styles.card,
				pressed && styles.pressed,
			]}
		>
			<WasherIcon
				size={72}
				water={machine.available ? 0 : 0.5}
				dimmed={!machine.available}
			/>
			<Text style={styles.name}>Washer {machine.number}</Text>
			<Badge tone={machine.available ? "success" : "neutral"}>
				{machine.available ? "Available" : "In use"}
			</Badge>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		width: "48%",
		alignItems: "center",
		gap: 8,
	},
	pressed: {
		opacity: 0.7,
	},
	name: {
		fontSize: 17,
		fontWeight: "700",
		color: colors.text,
	},
});
