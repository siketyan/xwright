import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { clamp } from "./ProgressBar";

/**
 * A front-loading washer, with the water in its drum filled up to `water` (0 to 1), and its light red for `danger`.
 */
export function WasherIcon({
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
			<View style={styles.panel}>
				<View style={styles.knob} />
				<View
					style={[
						styles.light,
						tone === "danger" && { backgroundColor: colors.danger },
					]}
				/>
			</View>
			<View
				style={[
					styles.door,
					{ width: door, height: door, borderRadius: door / 2 },
				]}
			>
				<View style={[styles.water, { height: `${clamp(water) * 100}%` }]} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
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
	panel: {
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
	knob: {
		width: "12%",
		aspectRatio: 1,
		borderRadius: 999,
		backgroundColor: colors.border,
	},
	light: {
		width: "8%",
		aspectRatio: 1,
		borderRadius: 999,
		backgroundColor: colors.success,
	},
	door: {
		borderWidth: 5,
		borderColor: "#c4d2e3",
		backgroundColor: "#dfeaf6",
		overflow: "hidden",
		justifyContent: "flex-end",
	},
	water: {
		width: "100%",
		backgroundColor: colors.water,
	},
});
