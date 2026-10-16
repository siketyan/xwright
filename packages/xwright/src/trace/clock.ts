/**
 * The host time in milliseconds of the monotonic clock of the system.
 *
 * `process.hrtime` reads the clock of the system, not one of the process, so the times of all the workers line up.
 */
export function hostTime(): number {
	return Number(process.hrtime.bigint()) / 1e6;
}
