"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
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
import { krwRank, sortedGlobalCurrencies } from "@/lib/currency-rankings";

const KOREA_CODES = ["KR", "KOR", "KRW"];

type GlobalRankingResponse = {
	rows: {
		country: string;
		code: string;
		currencyCode: string;
		currencyUnit: string;
		neerScore: number;
		reerScore: number | null;
	}[];
	krwRankNeer: number;
	krwRankReer: number;
	poolSize: number;
	updatedAt: string;
	dataPeriod: string | null;
	frequency: "monthly";
	source: string;
};

async function fetchGlobalRanking(): Promise<GlobalRankingResponse> {
	const response = await fetch("/api/global-ranking", { cache: "no-store" });
	if (!response.ok) {
		throw new Error("Failed to fetch global ranking");
	}
	return response.json();
}

export function GlobalCurrencyRanking() {
	const [sortMode, setSortMode] = useState<"neer" | "reer">("neer");
	const [showMetricGuide, setShowMetricGuide] = useState(false);
	const { data, isFetching, isFetched } = useQuery({
		queryKey: ["global-currency-ranking"],
		queryFn: fetchGlobalRanking,
		staleTime: 86_400_000,
		refetchInterval: 86_400_000,
		refetchOnWindowFocus: false,
	});
	const showInitialSkeleton = !isFetched && isFetching;

	const fallbackRows = sortedGlobalCurrencies.slice(0, 100).map((row) => ({
		country: row.country,
		code: row.code,
		currencyCode: row.code,
		currencyUnit: row.code,
		neerScore: row.score,
		reerScore: null as number | null,
	}));

	const baseRows = data?.rows?.length ? data.rows : fallbackRows;
	const rankingRows = [...baseRows].sort((a, b) => {
		if (sortMode === "reer") {
			return (b.reerScore ?? -999) - (a.reerScore ?? -999);
		}
		return b.neerScore - a.neerScore;
	});

	const krwCurrentRank =
		sortMode === "neer"
			? (data?.krwRankNeer ?? krwRank)
			: (data?.krwRankReer ??
				rankingRows.findIndex((item) =>
					KOREA_CODES.includes(item.code),
				) + 1);
	const poolSize = data?.poolSize ?? sortedGlobalCurrencies.length;
	const metricLabel = sortMode === "neer" ? "NEER" : "REER";
	const metricDataKey = sortMode === "reer" ? "reerScore" : "neerScore";
	const chartHeight = rankingRows.length * 34;
	const [mounted, setMounted] = useState(false);
	const chartScrollRef = useRef<HTMLDivElement>(null);
	const guidePopoverRef = useRef<HTMLDivElement>(null);
	const lastAnimatedKeyRef = useRef<string | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!showMetricGuide) {
			return;
		}

		const closeOnOutside = (event: MouseEvent | TouchEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}

			if (guidePopoverRef.current?.contains(target)) {
				return;
			}

			setShowMetricGuide(false);
		};

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setShowMetricGuide(false);
			}
		};

		document.addEventListener("mousedown", closeOnOutside);
		document.addEventListener("touchstart", closeOnOutside);
		document.addEventListener("keydown", closeOnEscape);

		return () => {
			document.removeEventListener("mousedown", closeOnOutside);
			document.removeEventListener("touchstart", closeOnOutside);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [showMetricGuide]);

	useEffect(() => {
		if (!mounted || !chartScrollRef.current || showInitialSkeleton) {
			return;
		}

		const animationKey = `${sortMode}-${data?.updatedAt ?? "fallback"}-${rankingRows.length}`;
		if (lastAnimatedKeyRef.current === animationKey) {
			return;
		}

		const rowHeight = 34;
		const rankIndexInChart = rankingRows.findIndex((item) =>
			KOREA_CODES.includes(item.code),
		);
		if (rankIndexInChart < 0) {
			return;
		}

		const currentRankIndex = rankIndexInChart;
		const container = chartScrollRef.current;
		const targetTop =
			currentRankIndex * rowHeight -
			container.clientHeight / 2 +
			rowHeight / 2;
		const finalTop = Math.max(0, targetTop);
		const durationMs = 1600;
		const topPreviewMs = 700;
		if (finalTop <= 1) {
			lastAnimatedKeyRef.current = animationKey;
			return;
		}

		lastAnimatedKeyRef.current = animationKey;

		container.scrollTop = 0;

		let animationFrame = 0;

		const timeoutId = window.setTimeout(() => {
			const startTop = container.scrollTop;
			const startAt = performance.now();

			const tick = (now: number) => {
				const elapsed = now - startAt;
				const t = Math.min(elapsed / durationMs, 1);
				const eased = 1 - Math.pow(1 - t, 3);

				container.scrollTop = startTop + (finalTop - startTop) * eased;

				if (t < 1) {
					animationFrame = window.requestAnimationFrame(tick);
				}
			};

			animationFrame = window.requestAnimationFrame(tick);
		}, topPreviewMs);

		return () => {
			window.clearTimeout(timeoutId);
			window.cancelAnimationFrame(animationFrame);
		};
	}, [mounted, rankingRows, krwCurrentRank, showInitialSkeleton]);

	return (
		<Card className="h-full">
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						{showInitialSkeleton ? (
							<div className="space-y-2 animate-pulse">
								<div className="h-4 w-[320px] rounded bg-white/10" />
								<div className="h-8 w-[300px] rounded bg-white/10" />
							</div>
						) : (
							<>
								<CardDescription>
									글로벌 화폐순위 (BIS {metricLabel} 기준,
									응답 {poolSize}
									개국)
								</CardDescription>
								<CardTitle className="text-2xl">
									KRW 현재 순위 ({metricLabel}):{" "}
									<span className="text-accent">
										{krwCurrentRank}위 / {poolSize}개국
									</span>
								</CardTitle>
							</>
						)}
					</div>
					{showInitialSkeleton ? (
						<div className="mt-1 h-9 w-28 shrink-0 animate-pulse rounded-md bg-white/10" />
					) : (
						<div
							ref={guidePopoverRef}
							className="relative mt-1 shrink-0"
						>
							<button
								type="button"
								onClick={() =>
									setShowMetricGuide((prev) => !prev)
								}
								className="rounded-md border border-line bg-card/70 px-3 py-2 text-xs text-muted transition hover:bg-white/5"
							>
								NEER/REER 이란?
							</button>
							<div
								className={`absolute right-0 top-full z-20 mt-2 w-[min(92vw,360px)] rounded-lg border border-line bg-card/95 p-3 text-xs text-muted shadow-xl backdrop-blur transition-all duration-200 ease-out ${
									showMetricGuide
										? "pointer-events-auto translate-y-0 scale-100 opacity-100"
										: "pointer-events-none -translate-y-1 scale-95 opacity-0"
								}`}
							>
								<p>
									NEER(명목실효환율): 물가를 반영하지 않고,
									교역상대국 통화 대비 명목 환율을 가중평균한
									지표입니다.
								</p>
								<p className="mt-1">
									REER(실질실효환율): NEER에 각국 물가 수준
									차이를 반영한 지표로, 실제 구매력/가격경쟁력
									변화를 더 잘 보여줍니다.
								</p>
							</div>
						</div>
					)}
				</div>
				<div className="mt-3 inline-flex w-fit rounded-lg border border-line bg-card p-1 text-xs">
					<button
						type="button"
						onClick={() => setSortMode("neer")}
						className={`rounded-md px-2 py-1 ${
							sortMode === "neer"
								? "bg-accent/20 text-accent"
								: "text-muted"
						}`}
					>
						NEER 순
					</button>
					<button
						type="button"
						onClick={() => setSortMode("reer")}
						className={`rounded-md px-2 py-1 ${
							sortMode === "reer"
								? "bg-accent/20 text-accent"
								: "text-muted"
						}`}
					>
						REER 순
					</button>
				</div>
				{showInitialSkeleton ? (
					<div className="mt-2 h-6 w-[210px] animate-pulse rounded-full border border-line bg-white/10" />
				) : (
					<div className="mt-2 inline-flex w-fit items-center rounded-full border border-line bg-card/70 px-2 py-1 text-[11px] text-muted">
						월간 지표 · 최근 발표월 {data?.dataPeriod ?? "-"}
					</div>
				)}
			</CardHeader>
			<CardContent className="space-y-6">
				<div
					ref={chartScrollRef}
					className="max-h-[340px] overflow-y-auto rounded-xl border border-line bg-card-soft/55 p-3"
				>
					{mounted && !showInitialSkeleton ? (
						<ResponsiveContainer width="100%" height={chartHeight}>
							<BarChart
								data={rankingRows}
								layout="vertical"
								margin={{
									left: 12,
									right: 12,
									top: 8,
									bottom: 8,
								}}
							>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#2d2d2d"
								/>
								<XAxis
									type="number"
									tick={{ fill: "#a1a1aa", fontSize: 11 }}
								/>
								<YAxis
									dataKey="currencyCode"
									type="category"
									width={62}
									tick={{ fill: "#fafafa", fontSize: 11 }}
								/>
								<Tooltip
									cursor={{
										fill: "rgba(105, 167, 255, 0.08)",
									}}
									content={({ active, payload }) => {
										if (!active || !payload?.length) {
											return null;
										}

										const row = payload[0]?.payload as
											| {
													country?: string;
													currencyCode?: string;
													neerScore?: number;
													reerScore?: number | null;
											  }
											| undefined;

										const rawValue = row?.[metricDataKey];
										const valueText =
											typeof rawValue === "number"
												? sortMode === "reer"
													? rawValue.toFixed(1)
													: `${rawValue.toFixed(1)} pts`
												: "-";

										return (
											<div className="rounded-lg border border-line bg-[#0f141b] px-3 py-2 text-sm shadow-lg">
												<p className="font-semibold text-foreground">
													{row?.country ?? "-"} (
													{row?.currencyCode ?? "-"})
												</p>
												<p className="mt-1 text-muted">
													{metricLabel} 지수:{" "}
													{valueText}
												</p>
											</div>
										);
									}}
								/>
								<Bar
									dataKey={metricDataKey}
									radius={[0, 6, 6, 0]}
								>
									{rankingRows.map((row) => (
										<Cell
											key={`bar-${row.code}`}
											fillOpacity={
												KOREA_CODES.includes(row.code)
													? 1
													: 0.65
											}
											stroke={
												KOREA_CODES.includes(row.code)
													? "#d6e9ff"
													: "transparent"
											}
											strokeWidth={
												KOREA_CODES.includes(row.code)
													? 1.2
													: 0
											}
											fill={
												KOREA_CODES.includes(row.code)
													? "#7fb6ff"
													: "#69a7ff"
											}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="h-[300px] w-full animate-pulse rounded-lg bg-white/5" />
					)}
				</div>

				{showInitialSkeleton ? (
					<div className="max-h-[300px] overflow-auto rounded-xl border border-line bg-card/35 p-3">
						<div className="space-y-2 animate-pulse">
							<div className="grid grid-cols-[56px_1.4fr_1.7fr_90px_90px] gap-3 rounded-md bg-white/5 px-2 py-3">
								<div className="h-4 rounded bg-white/10" />
								<div className="h-4 rounded bg-white/10" />
								<div className="h-4 rounded bg-white/10" />
								<div className="h-4 rounded bg-white/10" />
								<div className="h-4 rounded bg-white/10" />
							</div>
							{Array.from({ length: 8 }).map((_, idx) => (
								<div
									key={`table-skeleton-${idx}`}
									className="grid grid-cols-[56px_1.4fr_1.7fr_90px_90px] gap-3 px-2 py-2"
								>
									<div className="h-4 rounded bg-white/5" />
									<div className="h-4 rounded bg-white/5" />
									<div className="h-4 rounded bg-white/5" />
									<div className="h-4 rounded bg-white/5" />
									<div className="h-4 rounded bg-white/5" />
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="max-h-[300px] overflow-auto rounded-xl border border-line bg-card/35">
						<table className="w-full border-collapse text-sm">
							<thead className="sticky top-0 bg-card-soft/85 backdrop-blur">
								<tr className="text-left text-muted">
									<th className="px-4 py-3">Rank</th>
									<th className="px-4 py-3">국가</th>
									<th className="px-4 py-3">통화 단위</th>
									<th className="px-4 py-3 text-right">
										NEER
									</th>
									<th className="px-4 py-3 text-right">
										REER
									</th>
								</tr>
							</thead>
							<tbody>
								{rankingRows.map((row, index) => {
									const isKrw = KOREA_CODES.includes(
										row.code,
									);
									return (
										<tr
											key={row.code}
											className={
												isKrw
													? "bg-accent/12"
													: "border-t border-line/70"
											}
										>
											<td className="px-4 py-2 font-semibold">
												{index + 1}
											</td>
											<td className="px-4 py-2">
												{row.country}
											</td>
											<td className="px-4 py-2">
												{row.currencyUnit}
											</td>
											<td className="px-4 py-2 text-right text-accent-strong">
												{row.neerScore.toFixed(1)}
											</td>
											<td className="px-4 py-2 text-right text-foreground">
												{typeof row.reerScore ===
												"number"
													? row.reerScore.toFixed(1)
													: "-"}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				<p className="text-xs text-muted">
					랭킹 소스: {data?.source ?? "fallback"} / 기준일:{" "}
					{data?.updatedAt ?? "-"} / 기본 정렬: NEER
				</p>
			</CardContent>
		</Card>
	);
}
