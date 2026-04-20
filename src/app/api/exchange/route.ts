import { NextResponse } from "next/server";

const FALLBACK_RATE = 1418.25;

function formatUtcDate(date: Date) {
	return date.toISOString().split("T")[0];
}

async function fetchPreviousDayUsdKrw(referenceDate: Date) {
	for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
		const target = new Date(referenceDate);
		target.setUTCDate(referenceDate.getUTCDate() - dayOffset);
		const dateString = formatUtcDate(target);

		const response = await fetch(
			`https://api.frankfurter.app/${dateString}?from=USD&to=KRW`,
			{ cache: "no-store" },
		);

		if (!response.ok) {
			continue;
		}

		const data = (await response.json()) as {
			rates?: { KRW?: number };
		};

		if (typeof data.rates?.KRW === "number") {
			return data.rates.KRW;
		}
	}

	return null;
}

export async function GET() {
	try {
		const latestResponse = await fetch(
			"https://open.er-api.com/v6/latest/USD",
			{
				cache: "no-store",
			},
		);

		if (!latestResponse.ok) {
			throw new Error(`Exchange API failed: ${latestResponse.status}`);
		}

		const data = (await latestResponse.json()) as {
			rates?: Record<string, number>;
			time_last_update_utc?: string;
			time_next_update_utc?: string;
		};

		const usdToKrw = data.rates?.KRW;
		if (!usdToKrw) {
			throw new Error("KRW rate is missing");
		}

		const previousDayKrw = await fetchPreviousDayUsdKrw(new Date());
		const dayChange =
			typeof previousDayKrw === "number"
				? usdToKrw - previousDayKrw
				: null;
		const dayChangePercent =
			typeof previousDayKrw === "number" && previousDayKrw !== 0
				? (dayChange! / previousDayKrw) * 100
				: null;

		return NextResponse.json({
			usdKrw: usdToKrw,
			previousDayKrw,
			dayChange,
			dayChangePercent,
			updatedAt: data.time_last_update_utc ?? new Date().toISOString(),
			nextUpdateAt: data.time_next_update_utc ?? null,
			source: "open.er-api.com + frankfurter.app",
		});
	} catch {
		return NextResponse.json({
			usdKrw: FALLBACK_RATE,
			previousDayKrw: null,
			dayChange: null,
			dayChangePercent: null,
			updatedAt: new Date().toISOString(),
			nextUpdateAt: null,
			source: "fallback",
		});
	}
}
