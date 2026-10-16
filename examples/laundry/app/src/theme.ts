export const colors = {
	primary: "#1d6fd8",
	primaryDark: "#0f4fa8",
	water: "#5fb3f6",
	background: "#eef4fb",
	card: "#ffffff",
	text: "#0f1d33",
	muted: "#62708a",
	border: "#d9e3ef",
	success: "#14915a",
	successSoft: "#e3f6ec",
	danger: "#d33a3a",
	dangerSoft: "#fdeaea",
	neutralSoft: "#edf0f5",
};

export const typography = {
	title: { fontSize: 22, fontWeight: "700", color: colors.text },
	muted: { color: colors.muted },
} as const;
