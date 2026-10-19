import { type KeyboardEvent, type PointerEvent, useState } from "react";
import styles from "./Splitter.module.css";

/** The smallest size of a pane, in pixels. */
const MIN_SIZE = 80;

/** How far an arrow key moves a splitter, in pixels. */
const STEP = 16;

/**
 * The size of a pane that a {@link Splitter} resizes, as a CSS length: the size it was dragged to, kept in the browser,
 * or the initial one.
 */
export function usePaneSize(
	name: string,
	initial: string,
): [string, (size: number) => void] {
	const key = `xwright.pane.${name}`;
	const [size, setSize] = useState<number | undefined>(() => {
		try {
			const stored = Number(localStorage.getItem(key));
			return stored > 0 ? stored : undefined;
		} catch {
			return undefined;
		}
	});
	const resize = (next: number) => {
		setSize(next);
		try {
			localStorage.setItem(key, String(Math.round(next)));
		} catch {}
	};
	return [size === undefined ? initial : `${size}px`, resize];
}

/**
 * A bar between two panes, dragged or moved with the arrow keys to resize the pane before it, or the one after it with
 * `after`. A `vertical` bar sits between columns, a `horizontal` one between rows.
 */
export function Splitter({
	orientation,
	label,
	after = false,
	onResize,
}: {
	orientation: "vertical" | "horizontal";
	label: string;
	after?: boolean;
	onResize(size: number): void;
}) {
	const vertical = orientation === "vertical";
	/** Resizes the pane by the change of the position, clamped so that both panes keep a size. */
	const resizeBy = (bar: HTMLElement, start: number, delta: number) => {
		const parent = bar.parentElement;
		const total = parent
			? vertical
				? parent.clientWidth
				: parent.clientHeight
			: Number.POSITIVE_INFINITY;
		const size = start + (after ? -delta : delta);
		onResize(Math.min(Math.max(size, MIN_SIZE), total - MIN_SIZE));
	};
	const paneSize = (bar: HTMLElement): number => {
		const pane = after ? bar.nextElementSibling : bar.previousElementSibling;
		const rect = pane?.getBoundingClientRect();
		return rect === undefined ? 0 : vertical ? rect.width : rect.height;
	};

	const onPointerDown = (event: PointerEvent<HTMLHRElement>) => {
		const bar = event.currentTarget;
		const start = paneSize(bar);
		const origin = vertical ? event.clientX : event.clientY;
		bar.setPointerCapture(event.pointerId);
		const move = (moved: globalThis.PointerEvent) =>
			resizeBy(bar, start, (vertical ? moved.clientX : moved.clientY) - origin);
		const up = () => {
			bar.removeEventListener("pointermove", move);
			bar.removeEventListener("pointerup", up);
			bar.removeEventListener("pointercancel", up);
		};
		bar.addEventListener("pointermove", move);
		bar.addEventListener("pointerup", up);
		bar.addEventListener("pointercancel", up);
		event.preventDefault();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
		const keys = vertical
			? { ArrowLeft: -STEP, ArrowRight: STEP }
			: { ArrowUp: -STEP, ArrowDown: STEP };
		const delta = keys[event.key as keyof typeof keys];
		if (delta !== undefined) {
			const bar = event.currentTarget;
			resizeBy(bar, paneSize(bar), delta);
			event.preventDefault();
		}
	};

	return (
		<hr
			className={`${styles.splitter} ${vertical ? styles.vertical : styles.horizontal}`}
			aria-orientation={orientation}
			aria-label={label}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onKeyDown={onKeyDown}
		/>
	);
}
