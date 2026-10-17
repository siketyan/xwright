import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

/** A bar filled up to `progress`, from 0 to 1. */
export function ProgressBar({ progress }: { progress: number }) {
	return (
		<View style={styles.track}>
			<View style={[styles.bar, { width: `${clamp(progress) * 100}%` }]} />
		</View>
	);
}

export function clamp(value: number): number {
	return Math.min(Math.max(value, 0), 1);
}

const styles = StyleSheet.create({
	track: {
		alignSelf: "stretch",
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.neutralSoft,
		overflow: "hidden",
	},
	bar: {
		height: "100%",
		borderRadius: 4,
		backgroundColor: colors.primary,
	},
});
