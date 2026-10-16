import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

/** A link back to the previous screen, named `Back` for accessibility. */
export function BackLink({
	text,
	onPress,
}: {
	text: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Back"
			onPress={onPress}
			style={styles.back}
		>
			<Text style={styles.text}>‹ {text}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	back: {
		alignSelf: "flex-start",
		paddingVertical: 4,
		marginBottom: 8,
	},
	text: {
		color: colors.primary,
		fontSize: 16,
		fontWeight: "600",
	},
});
