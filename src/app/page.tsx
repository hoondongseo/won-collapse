import { GlobalCurrencyRanking } from "@/components/collapse-ranking";
import { LiveRateCard } from "@/components/live-rate-card";
import { MeltdownCalculator } from "@/components/meltdown-calculator";

export default function Home() {
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
			<header className="panel overflow-hidden p-6 sm:p-8">
				<div className="inline-flex items-center rounded-full border border-line bg-card-soft/70 px-3 py-1 text-xs font-medium text-muted">
					LIVE MARKET DASHBOARD
				</div>
				<h1 className="ticker mt-4 text-3xl font-bold leading-tight sm:text-5xl">
					원화 가치 모니터
				</h1>
				<p className="mt-3 max-w-3xl text-sm text-muted sm:text-base">
					USD/KRW 실시간 흐름, 글로벌 화폐순위(BIS NEER 기준), 자산
					체감 계산기를 한 화면에서 확인하세요.
				</p>
			</header>

			<section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
				<div className="xl:col-span-4">
					<LiveRateCard />
				</div>
				<div className="xl:col-span-8">
					<GlobalCurrencyRanking />
				</div>
			</section>

			<section>
				<MeltdownCalculator />
			</section>
			<footer className="pb-2 text-xs text-muted/90">
				실시간 환율은 ExchangeRate-API 기반이며, 글로벌 화폐순위는 기준
				BIS NEER(광의)와 직전 대비 변동을 반영해 하루 단위로 자동
				갱신합니다.
			</footer>
		</div>
	);
}
