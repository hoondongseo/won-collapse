"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ExchangeResponse = {
	usdKrw: number;
};

const BASE_RATE = 1180;

async function fetchExchange(): Promise<ExchangeResponse> {
	const response = await fetch("/api/exchange", { cache: "no-store" });
	if (!response.ok) {
		throw new Error("Failed to fetch exchange rate");
	}
	return response.json();
}

export function MeltdownCalculator() {
	const [assetsKrw, setAssetsKrw] = useState(100_000_000);
	const { data } = useQuery({
		queryKey: ["usd-krw"],
		queryFn: fetchExchange,
		refetchInterval: 15_000,
	});

	const stats = useMemo(() => {
		const currentRate = data?.usdKrw ?? 1400;
		const usdAtBase = assetsKrw / BASE_RATE;
		const usdNow = assetsKrw / currentRate;
		const usdLoss = usdAtBase - usdNow;
		const purchasingPowerLeft = (usdNow / usdAtBase) * 100;

		return {
			currentRate,
			usdAtBase,
			usdNow,
			usdLoss,
			purchasingPowerLeft,
		};
	}, [assetsKrw, data?.usdKrw]);

	return (
		<Card>
			<CardHeader>
				<CardDescription>내 자산 계산기</CardDescription>
				<CardTitle className="text-2xl">
					환율 변화에 따른 자산 체감 변화
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 lg:grid-cols-2">
				<div className="space-y-3 rounded-xl border border-line bg-card-soft/50 p-4">
					<label
						className="text-sm text-muted"
						htmlFor="assets-input"
					>
						내 원화 자산 (KRW)
					</label>
					<Input
						id="assets-input"
						type="number"
						min={0}
						step={100000}
						value={assetsKrw}
						onChange={(e) =>
							setAssetsKrw(Number(e.target.value || 0))
						}
					/>
					<p className="text-xs text-muted">
						비교 기준 환율: 1 USD ={" "}
						{BASE_RATE.toLocaleString("ko-KR")}원
					</p>
				</div>

				<div className="space-y-3 rounded-xl border border-line bg-card/55 p-4">
					<p className="ticker text-sm text-muted">
						VALUE IMPACT REPORT
					</p>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<StatBox
							label="현재 환율"
							value={`${stats.currentRate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`}
						/>
						<StatBox
							label="현재 달러 환산"
							value={`$${Math.floor(stats.usdNow).toLocaleString("en-US")}`}
						/>
						<StatBox
							label="기준 환율 달러 환산"
							value={`$${Math.floor(stats.usdAtBase).toLocaleString("en-US")}`}
						/>
						<StatBox
							label="잃은 달러 가치"
							value={`-$${Math.floor(stats.usdLoss).toLocaleString("en-US")}`}
							danger
						/>
					</div>

					<div className="mt-2 rounded-lg border border-line bg-card-soft/55 p-3 text-sm">
						구매력 보존율:
						<span className="ml-2 text-lg font-bold text-accent-strong">
							{stats.purchasingPowerLeft.toFixed(1)}%
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

type StatBoxProps = {
	label: string;
	value: string;
	danger?: boolean;
};

function StatBox({ label, value, danger }: StatBoxProps) {
	return (
		<div className="rounded-lg border border-line bg-card-soft/45 p-3">
			<div className="text-xs text-muted">{label}</div>
			<div
				className={`mt-1 text-base font-semibold ${danger ? "text-danger" : "text-foreground"}`}
			>
				{value}
			</div>
		</div>
	);
}
