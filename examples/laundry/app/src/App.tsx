import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Course, Machine, Session } from "./api";
import { MachineScreen } from "./screens/MachineScreen";
import { MachinesScreen } from "./screens/MachinesScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { colors } from "./theme";

/** The screen shown now, with what it shows. */
type Route =
	| { name: "machines" }
	| { name: "machine"; machine: Machine; courses: Course[] }
	| { name: "session"; machine: Machine; session: Session };

export function App() {
	const [route, setRoute] = useState<Route>({ name: "machines" });
	const home = () => setRoute({ name: "machines" });
	return (
		<View style={styles.container}>
			<StatusBar style="light" />
			<View style={styles.header}>
				<Text style={styles.brand}>Laundry</Text>
				<Text style={styles.tagline}>Coin laundry · Open 24 hours</Text>
			</View>
			<ScrollView contentContainerStyle={styles.content}>
				{route.name === "machines" && (
					<MachinesScreen
						onSelect={(machine, courses) =>
							setRoute({ name: "machine", machine, courses })
						}
					/>
				)}
				{route.name === "machine" && (
					<MachineScreen
						machine={route.machine}
						courses={route.courses}
						onBack={home}
						onStart={(session) =>
							setRoute({ name: "session", machine: route.machine, session })
						}
					/>
				)}
				{route.name === "session" && (
					<SessionScreen
						machine={route.machine}
						initial={route.session}
						onBack={home}
					/>
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		backgroundColor: colors.primary,
		paddingTop: 56,
		paddingBottom: 20,
		paddingHorizontal: 20,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
	},
	brand: {
		color: "#fff",
		fontSize: 26,
		fontWeight: "800",
		letterSpacing: 0.5,
	},
	tagline: {
		color: "#d6e6fb",
		marginTop: 2,
	},
	content: {
		padding: 16,
		paddingBottom: 40,
	},
});
