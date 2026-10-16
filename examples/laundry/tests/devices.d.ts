import type { MobilewrightHandle } from "@xwright/mobilewright";
import type { PlaywrightHandle } from "@xwright/playwright";
import type { FakeWasher } from "example-laundry-fake-washer";

declare module "xwright" {
	interface Devices {
		web: PlaywrightHandle;
		phone: MobilewrightHandle;
		washer: FakeWasher;
	}
}
