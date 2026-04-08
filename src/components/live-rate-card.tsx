"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type ExchangeResponse = {
	usdKrw: number;
	previousDayKrw: number | null;
	dayChange: number | null;
	dayChangePercent: number | null;
	updatedAt: string;
	nextUpdateAt: string | null;
	source: string;
};

type ExchangeHistoryResponse = {
	series: { date: string; label: string; usdKrw: number }[];
	source: string;
};

type ChartPeriod = 30 | 90 | 365 | 1095 | 1825;
const PERIODS: ChartPeriod[] = [30, 90, 365, 1095, 1825];

function getPeriodLabel(days: ChartPeriod) {
	if (days === 1825) return "5년";
	if (days === 1095) return "3년";
	return days === 365 ? "1년" : `${days}일`;
}

function clampZoom(value: number) {
	return Math.min(4, Math.max(1, Number(value.toFixed(2))));
}

function touchDistance(touches: React.TouchList) {
	if (touches.length < 2) {
		return 0;
	}
	const [a, b] = [touches[0], touches[1]];
	return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

async function fetchExchange(): Promise<ExchangeResponse> {
	const response = await fetch("/api/exchange", { cache: "no-store" });
	if (!response.ok) {
		throw new Error("Failed to fetch exchange rate");
	}
	return response.json();
}

async function fetchExchangeHistory(days: ChartPeriod): Promise<ExchangeHistoryResponse> {
	const response = await fetch(`/api/exchange/history?days=${days}`, { cache: "no-store" });
	if (!response.ok) {
		throw new Error("Failed to fetch exchange history");
	}
	return response.json();
}

function useCountUp(target: number, duration = 900) {
	const [value, setValue] = useState(target);
	const prevTarget = useRef(target);

	useEffect(() => {
		const start = prevTarget.current;
		const end = target;
		const startTime = performance.now();
		let frameId = 0;

		const tick = (now: number) => {
			const progress = Math.min((now - startTime) / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setValue(start + (end - start) * eased);
			if (progress < 1) {
				frameId = requestAnimationFrame(tick);
			} else {
				prevTarget.current = end;
			}
		};

		frameId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frameId);
	}, [target, duration]);

	return value;
}

export function LiveRateCard() {
	const [periodDays, setPeriodDays] = useState<ChartPeriod>(30);
	const [zoomLevel, setZoomLevel] = useState(1);
	const pinchDistanceRef = useRef<number | null>(null);
	const chartInteractRef = useRef<HTMLDivElement>(null);
	const { data, isLoading, isError } = useQuery({
		queryKey: ["usd-krw"],
		queryFn: fetchExchange,
		refetchInterval: 15_000,
	});
	const {
		data: historyData,
		isLoading: isHistoryLoading,
		isError: isHistoryError,
	} = useQuery({
		queryKey: ["usd-krw-history", periodDays],
		queryFn: () => fetchExchangeHistory(periodDays),
		staleTime: 3_600_000,
		refetchInterval: 3_600_000,
		refetchOnWindowFocus: false,
	});

	const yDomain = useMemo(() => {
		const points = historyData?.series ?? [];
		if (points.length === 0) {
			return ["auto", "auto"] as const;
		}

		const values = points.map((point) => point.usdKrw);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const spread = Math.max(max - min, 1);
		const basePadding = spread * 0.2;
		const adjustedPadding = basePadding / zoomLevel;

		return [min - adjustedPadding, max + adjustedPadding] as const;
	}, [historyData?.series, zoomLevel]);

	const shownRate = useCountUp(data?.usdKrw ?? 0);

	const stress = useMemo(() => {
		if (!data) {
			return {
				score: null as number | null,
				label: "계산 중",
				tone: "text-muted",
			};
		}

		const rate = data.usdKrw;
		const dayAbs = Math.abs(data.dayChangePercent ?? 0);

		// 0~70: 환율 레벨 압력, 0~30: 일간 변동 압력
		const levelComponent = Math.min(70, Math.max(0, (rate - 1200) / 4));
		const dailyComponent = Math.min(30, dayAbs * 20);
		const score = Math.round(levelComponent + dailyComponent);

		if (score >= 65) return { score, label: "심각", tone: "text-danger" };
		if (score >= 45) return { score, label: "높음", tone: "text-orange-400" };
		if (score >= 25) return { score, label: "주의", tone: "text-amber-400" };
		return { score, label: "낮음", tone: "text-success" };
	}, [data]);

	const changeInfo = useMemo(() => {
		if (!data || typeof data.dayChange !== "number") {
			return {
				label: "전일 대비 -",
				tone: "text-muted",
				badge: "border-line bg-card",
			};
		}

		if (data.dayChange > 0) {
			return {
				label: `+${data.dayChange.toFixed(2)} (${(data.dayChangePercent ?? 0).toFixed(2)}%)`,
				tone: "text-danger",
				badge: "border-danger/30 bg-danger/10",
			};
		}

		if (data.dayChange < 0) {
			return {
				label: `${data.dayChange.toFixed(2)} (${(data.dayChangePercent ?? 0).toFixed(2)}%)`,
				tone: "text-accent",
				badge: "border-accent/30 bg-accent/10",
			};
		}

		return {
			label: "0.00 (0.00%)",
			tone: "text-muted",
			badge: "border-line bg-card",
		};
	}, [data]);

	useEffect(() => {
		const element = chartInteractRef.current;
		if (!element) {
			return;
		}

		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			event.stopPropagation();
			const delta = event.deltaY < 0 ? 0.18 : -0.18;
			setZoomLevel((prev) => clampZoom(prev + delta));
		};

		element.addEventListener("wheel", onWheel, {
			passive: false,
			capture: true,
		});

		return () => {
			element.removeEventListener("wheel", onWheel, true);
		};
	}, [isHistoryLoading]);

	const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
		if (event.touches.length === 2) {
			pinchDistanceRef.current = touchDistance(event.touches);
		}
	};

	const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
		if (event.touches.length !== 2) {
			pinchDistanceRef.current = null;
			return;
		}

		const currentDistance = touchDistance(event.touches);
		if (!pinchDistanceRef.current) {
			pinchDistanceRef.current = currentDistance;
			return;
		}

		event.preventDefault();
		const delta = (currentDistance - pinchDistanceRef.current) / 140;
		setZoomLevel((prev) => clampZoom(prev + delta));
		pinchDistanceRef.current = currentDistance;
	};

	const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
		if (event.touches.length < 2) {
			pinchDistanceRef.current = null;
		}
	};

	return (
		<Card className="flex h-full min-h-0 flex-col">
			<CardHeader>
				<CardDescription className="text-muted">실시간 환율 모니터</CardDescription>
				<CardTitle className="ticker text-2xl">USD / KRW</CardTitle>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-5">
				<div className="rounded-xl border border-line bg-card-soft/60 p-4 min-h-[176px] sm:min-h-[184px]">
					<div className="text-xs uppercase text-muted">
						현재 환율 (1 USD)
					</div>
					<div className="mt-3 flex min-h-[112px] flex-col items-start justify-center gap-2.5">
						{isLoading ? (
							<div className="h-12 w-[68%] min-w-44 max-w-64 animate-pulse rounded-md bg-white/10 sm:h-14 sm:min-w-52 sm:max-w-72" />
						) : (
							<div className="ticker flex items-end whitespace-nowrap leading-none text-4xl font-semibold text-foreground sm:text-5xl">
								{shownRate.toLocaleString("ko-KR", {
									maximumFractionDigits: 2,
								})}
								<span className="ml-1 text-3xl sm:text-4xl">원</span>
							</div>
						)}
						{!isLoading ? (
							<span
								className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm ${changeInfo.tone} ${changeInfo.badge}`}
							>
								전일 대비 {changeInfo.label}
							</span>
						) : (
							<div className="h-5 w-28 animate-pulse rounded-md bg-white/8 sm:w-36" />
						)}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3 text-sm">
					<div className="rounded-lg border border-line bg-card/60 p-3">
						<div className="text-muted">환율 스트레스 지수</div>
						<div className={`mt-1 text-lg font-semibold ${stress.tone}`}>
							{stress.score !== null ? `${stress.score} / 100 · ${stress.label}` : stress.label}
						</div>
					</div>
					<div className="rounded-lg border border-line bg-card/60 p-3">
						<div className="text-muted">업데이트</div>
						<div className="mt-1 text-lg font-semibold text-foreground">
							{data
								? new Date(data.updatedAt).toLocaleTimeString(
										"ko-KR",
									)
								: "-"}
						</div>
					</div>
				</div>

				<div className="flex min-h-[260px] flex-1 flex-col rounded-xl border border-line bg-card-soft/45 p-3">
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
						<div className="text-xs uppercase text-muted">
							최근 {getPeriodLabel(periodDays)} USD/KRW 추이
						</div>
						<div className="flex items-center gap-2">
							<div className="inline-flex rounded-md border border-line bg-card/60 p-1 text-[11px]">
								{PERIODS.map((days) => (
									<button
										key={days}
										type="button"
										onClick={() => setPeriodDays(days)}
										className={`rounded px-2 py-1 ${
											periodDays === days
												? "bg-accent/20 text-accent"
												: "text-muted"
										}`}
									>
										{getPeriodLabel(days)}
									</button>
								))}
							</div>
							<span className="text-[11px] text-muted">줌 {zoomLevel.toFixed(1)}x · 휠/핀치</span>
						</div>
					</div>
					{isHistoryLoading ? (
						<div className="h-full min-h-[220px] w-full animate-pulse rounded-md bg-white/8" />
					) : (
						<div
							ref={chartInteractRef}
							className="h-full min-h-[220px] w-full overscroll-contain"
							onTouchStart={handleTouchStart}
							onTouchMove={handleTouchMove}
							onTouchEnd={handleTouchEnd}
							onTouchCancel={handleTouchEnd}
							style={{ touchAction: "none" }}
						>
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={historyData?.series ?? []}>
									<CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
									<XAxis
										dataKey="label"
										tick={{ fill: "#a1a1aa", fontSize: 11 }}
										minTickGap={periodDays === 365 ? 26 : 16}
									/>
									<YAxis
										tick={{ fill: "#a1a1aa", fontSize: 11 }}
										domain={yDomain}
										tickFormatter={(value) =>
											typeof value === "number"
												? value.toLocaleString("ko-KR", {
														maximumFractionDigits: 0,
													})
												: String(value)
										}
										width={56}
									/>
									<Tooltip
										cursor={{ stroke: "#69a7ff", strokeOpacity: 0.35 }}
										contentStyle={{
											backgroundColor: "#0f141b",
											border: "1px solid #2f2f2f",
											borderRadius: "10px",
										}}
										labelFormatter={(label) => `기준일 ${label}`}
										formatter={(value) => [
											`${Number(value).toLocaleString("ko-KR", {
												maximumFractionDigits: 2,
											})} 원`,
											"USD/KRW",
										]}
									/>
									<Line
										type="monotone"
										dataKey="usdKrw"
										stroke="#7fb6ff"
										strokeWidth={2.2}
										dot={false}
										activeDot={{ r: 4, stroke: "#d6e9ff", strokeWidth: 1.5 }}
										isAnimationActive
										animationDuration={400}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					)}
					{isHistoryError ? (
						<p className="mt-2 text-xs text-muted">
							히스토리 데이터를 불러오지 못해 기본 추이값을 표시합니다.
						</p>
					) : null}
				</div>

				<p className="text-xs text-muted">
					{isError
						? "환율 API 연결 실패: fallback 수치를 표시 중입니다."
						: `Source: ${data?.source ?? "-"} / 15초마다 자동 동기화`}
				</p>
			</CardContent>
		</Card>
	);
}
