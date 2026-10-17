import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "../theme";

export function Card({
	style,
	children,
}: {
	style?: StyleProp<ViewStyle>;
	children: ReactNode;
}) {
	return <View style={[styles.card, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
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
});
