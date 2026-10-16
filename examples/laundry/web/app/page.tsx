"use client";

import { useCallback, useEffect, useState } from "react";
import type { Machine, Session } from "@/lib/store";

interface Dashboard {
	machines: Machine[];
	sessions: Session[];
	sales: number;
}

const stateLabels: Record<Machine["status"]["state"], string> = {
	idle: "Idle",
	running: "Running",
	finished: "Finished",
	error: "Error",
};

const sessionLabels: Record<Session["state"], string> = {
	starting: "Starting",
	running: "Running",
	finished: "Finished",
	failed: "Failed",
	stopped: "Stopped",
	refunded: "Refunded",
};

/** The dashboard of the owner, refreshed every second. */
export default function DashboardPage() {
	const [dashboard, setDashboard] = useState<Dashboard>();

	const refresh = useCallback(async () => {
		const response = await fetch("/api/dashboard", { cache: "no-store" });
		setDashboard(await response.json());
	}, []);

	useEffect(() => {
		refresh();
		const timer = setInterval(refresh, 1000);
		return () => clearInterval(timer);
	}, [refresh]);

	const post = async (url: string) => {
		await fetch(url, { method: "POST" });
		await refresh();
	};

	if (!dashboard) {
		return <p>Loading…</p>;
	}
	const numbers = new Map(
		dashboard.machines.map((machine) => [machine.id, machine.number]),
	);

	return (
		<main>
			<h1>Laundry dashboard</h1>
			<p>Sales: ¥{dashboard.sales.toLocaleString("en")}</p>

			<h2>Washers</h2>
			<table>
				<thead>
					<tr>
						<th>Washer</th>
						<th>Connection</th>
						<th>Door</th>
						<th>State</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{dashboard.machines.map((machine) => (
						<tr key={machine.id} aria-label={`Washer ${machine.number}`}>
							<td>Washer {machine.number}</td>
							<td>{machine.online ? "Online" : "Offline"}</td>
							<td>{machine.status.door === "open" ? "Open" : "Closed"}</td>
							<td>
								{stateLabels[machine.status.state]}
								{machine.status.state === "running" &&
									` (${machine.status.remainingMinutes} min left)`}
								{machine.status.errorCode && (
									<span className="error"> {machine.status.errorCode}</span>
								)}
							</td>
							<td>
								{machine.status.state === "error" && (
									<button
										type="button"
										onClick={() => post(`/api/machines/${machine.id}/reset`)}
									>
										Reset
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			<h2>Sessions</h2>
			<table>
				<thead>
					<tr>
						<th>Session</th>
						<th>Washer</th>
						<th>Course</th>
						<th>State</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{dashboard.sessions.map((session) => (
						<tr key={session.id} aria-label={`Session ${session.id}`}>
							<td>#{session.id}</td>
							<td>Washer {numbers.get(session.machineId)}</td>
							<td>
								{session.course.name} (¥{session.course.price})
							</td>
							<td>
								{sessionLabels[session.state]}
								{session.errorCode && (
									<span className="error"> {session.errorCode}</span>
								)}
							</td>
							<td>
								{session.state === "failed" && (
									<button
										type="button"
										onClick={() => post(`/api/sessions/${session.id}/refund`)}
									>
										Refund
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</main>
	);
}
