/** Joins the class names that are set, such as the ones of CSS modules picked by conditions. */
export function cx(...names: (string | false | null | undefined)[]): string {
	return names.filter(Boolean).join(" ");
}
