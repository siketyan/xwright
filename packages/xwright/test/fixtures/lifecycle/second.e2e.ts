import { test, use } from "xwright";
import { log } from "./log.ts";

const b = use("b");

test("uses b", () => log(`test uses ${b.name}`));
