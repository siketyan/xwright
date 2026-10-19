import { type Adapter, RUNNER_SLOT, resolveOptions } from "./adapter.js";
import { PROJECT_OPTIONS_KEY, type ProjectOptions } from "./config.js";

/** A project of the configuration, with the options of Xwright in its `use`. */
interface Project {
	name: string;
	use: Record<string, unknown>;
}

/**
 * Installs what the devices of the projects need, through `install` of their adapters: once for each adapter, with
 * the options of all its devices. Only the projects and the devices of the names are taken, when there are any.
 * Returns the names of the adapters it installed for.
 */
export async function installDevices(
	projects: Project[],
	filter: { projects: string[]; devices: string[] },
	args: string[],
	log: (message: string) => void = console.log,
): Promise<string[]> {
	const known = new Set(projects.map((project) => project.name));
	for (const name of filter.projects) {
		if (!known.has(name)) {
			throw new Error(`The project "${name}" is not in the configuration`);
		}
	}
	// The options of the devices, by their adapters; the same adapter object on several devices is installed once.
	const adapters = new Map<Adapter["definition"], unknown[]>();
	const seen = new Set<string>();
	const deviceNames = new Set<string>();
	for (const project of projects) {
		if (filter.projects.length > 0 && !filter.projects.includes(project.name)) {
			continue;
		}
		const options = project.use[PROJECT_OPTIONS_KEY] as
			| ProjectOptions
			| undefined;
		for (const [name, device] of Object.entries(options?.devices ?? {})) {
			deviceNames.add(name);
			if (filter.devices.length > 0 && !filter.devices.includes(name)) {
				continue;
			}
			if (seen.has(device.id)) {
				continue;
			}
			seen.add(device.id);
			const { definition } = device.adapter;
			adapters.set(definition, [
				...(adapters.get(definition) ?? []),
				resolveOptions(device.adapter.options, RUNNER_SLOT),
			]);
		}
	}
	for (const name of filter.devices) {
		if (!deviceNames.has(name)) {
			throw new Error(`The device "${name}" is not in the projects`);
		}
	}
	const installed: string[] = [];
	for (const [definition, options] of adapters) {
		if (definition.install === undefined) {
			continue;
		}
		log(`Installing for ${definition.name}`);
		await definition.install({ options, args });
		installed.push(definition.name);
	}
	if (installed.length === 0) {
		log("No adapter of the devices has anything to install");
	}
	return installed;
}
