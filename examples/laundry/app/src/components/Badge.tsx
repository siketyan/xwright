import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

const tones = {
	success: { color: colors.success, backgroundColor: colors.successSoft },
	danger: { color: colors.danger, backgroundColor: colors.dangerSoft },
	neutral: { color: colors.muted, backgroundColor: colors.neutralSoft },
};

export function Badge({
	tone,
	children,
}: {
	tone: keyof typeof tones;
	children: ReactNode;
}) {
	const { color, backgroundColor } = tones[tone];
	return (
		<View style={[styles.badge, { backgroundColor }]}>
			<Text style={[styles.text, { color }]}>{children}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	badge: {
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	text: {
		fontSize: 13,
		fontWeight: "700",
	},
});
