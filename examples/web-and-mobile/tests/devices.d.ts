import type { MobilewrightHandle } from "@xwright/mobilewright";
import type { PlaywrightHandle } from "@xwright/playwright";

declare module "xwright" {
	interface Devices {
		web: PlaywrightHandle;
		phone: MobilewrightHandle;
	}
}
