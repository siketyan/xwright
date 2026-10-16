import { test, use } from "xwright";
import { log } from "./log.ts";

const a = use("a");

test("uses a", () => log(`test uses ${a.name}`));
