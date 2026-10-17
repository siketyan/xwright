import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

/**
 * A button as wide as the screen. `label` is its accessible name, which tests find it by, and `text` what it shows,
 * when they differ.
 */
export function Button({
	label,
	text = label,
	variant = "primary",
	onPress,
}: {
	label: string;
	text?: string;
	variant?: "primary" | "secondary";
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				styles[variant],
				pressed && styles.pressed,
			]}
		>
			<Text
				style={[styles.text, variant === "secondary" && styles.secondaryText]}
			>
				{text}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		borderRadius: 14,
		paddingVertical: 15,
		alignItems: "center",
		marginTop: 4,
	},
	primary: {
		backgroundColor: colors.primary,
	},
	secondary: {
		borderWidth: 1,
		borderColor: colors.primary,
	},
	pressed: {
		opacity: 0.7,
	},
	text: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "700",
	},
	secondaryText: {
		color: colors.primary,
		fontWeight: "600",
	},
});
