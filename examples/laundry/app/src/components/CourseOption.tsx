import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Course } from "../api";
import { colors, typography } from "../theme";
import { styles as cardStyles } from "./Card";

/** A course to choose, shown as a radio button. */
export function CourseOption({
	course,
	selected,
	onPress,
}: {
	course: Course;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={course.name}
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[cardStyles.card, styles.option, selected && styles.selected]}
		>
			<View style={[styles.radio, selected && styles.radioOn]}>
				{selected && <View style={styles.dot} />}
			</View>
			<View style={styles.body}>
				<Text style={styles.name}>{course.name}</Text>
				<Text style={typography.muted}>{course.minutes} min</Text>
			</View>
			<Text style={styles.price}>¥{course.price}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	option: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	selected: {
		borderColor: colors.primary,
		borderWidth: 2,
	},
	radio: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 2,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	radioOn: {
		borderColor: colors.primary,
	},
	dot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: colors.primary,
	},
	body: {
		flex: 1,
	},
	name: {
		fontSize: 17,
		fontWeight: "600",
		color: colors.text,
	},
	price: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.text,
	},
});
