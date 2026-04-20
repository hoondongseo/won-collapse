import { NextResponse } from "next/server";

const FALLBACK_BASE = 1418.25;
const DEFAULT_LOOKBACK_DAYS = 30;
const ALLOWED_DAYS = new Set([30, 90, 365, 1095, 1825]);

function toDateString(date: Date) {
	return date.toISOString().split("T")[0];
}

function resolveLookbackDays(raw: string | null) {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_LOOKBACK_DAYS;
	}
	return ALLOWED_DAYS.has(parsed) ? parsed : DEFAULT_LOOKBACK_DAYS;
}

function buildFallbackSeries(days: number) {
	const today = new Date();
	const series: { date: string; label: string; usdKrw: number }[] = [];

	for (let i = days - 1; i >= 0; i -= 1) {
		const d = new Date(today);
		d.setUTCDate(today.getUTCDate() - i);
		const wave = Math.sin((days - i) / 3.8) * 7;
		const drift = (days - i) * 0.35;
		const value = Number((FALLBACK_BASE + wave + drift).toFixed(2));
		series.push({
			date: toDateString(d),
			label: `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
			usdKrw: value,
		});
	}

	return series;
}

function buildDenseSeries(days: number, startDate: Date, ratesByDate: Map<string, number>) {
	const knownDates = [...ratesByDate.keys()].sort();
	const firstKnown = knownDates.length > 0 ? ratesByDate.get(knownDates[0]) ?? null : null;
	const series: { date: string; label: string; usdKrw: number }[] = [];

	let carryValue: number | null = null;

	for (let i = 0; i < days; i += 1) {
		const d = new Date(startDate);
		d.setUTCDate(startDate.getUTCDate() + i);
		const date = toDateString(d);
		const exact = ratesByDate.get(date);

		if (typeof exact === "number") {
			carryValue = exact;
		}

		const selected =
			typeof exact === "number"
				? exact
				: typeof carryValue === "number"
					? carryValue
					: typeof firstKnown === "number"
						? firstKnown
						: FALLBACK_BASE;

		series.push({
			date,
			label: `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
			usdKrw: Number(selected.toFixed(2)),
		});
	}

	return series;
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const lookbackDays = resolveLookbackDays(searchParams.get("days"));

	const end = new Date();
	const start = new Date();
	start.setUTCDate(end.getUTCDate() - (lookbackDays - 1));

	const startDate = toDateString(start);
	const endDate = toDateString(end);

	try {
		const response = await fetch(
			`https://api.frankfurter.app/${startDate}..${endDate}?from=USD&to=KRW`,
			{ cache: "no-store" },
		);

		if (!response.ok) {
			throw new Error(`Frankfurter API failed: ${response.status}`);
		}

		const data = (await response.json()) as {
			rates?: Record<string, { KRW?: number }>;
		};

		const entries = Object.entries(data.rates ?? {})
			.map(([date, row]) => ({ date, usdKrw: row.KRW }))
			.filter(
				(item): item is { date: string; usdKrw: number } =>
					typeof item.usdKrw === "number",
			)
			.sort((a, b) => a.date.localeCompare(b.date));

		if (entries.length === 0) {
			throw new Error("No history data");
		}

		const ratesByDate = new Map(entries.map((item) => [item.date, item.usdKrw]));
		const series = buildDenseSeries(lookbackDays, start, ratesByDate);

		return NextResponse.json({
			series,
			source: "frankfurter.app",
		});
	} catch {
		return NextResponse.json({
			series: buildFallbackSeries(lookbackDays),
			source: "fallback",
		});
	}
}
