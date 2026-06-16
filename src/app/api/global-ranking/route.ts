import { NextResponse } from "next/server";

const DAILY_SECONDS = 86_400;
const BIS_NEER_URL =
	"https://stats.bis.org/api/v1/data/BIS,WS_EER,1.0/M.N.B..A";
const BIS_REER_URL =
	"https://stats.bis.org/api/v1/data/BIS,WS_EER,1.0/M.R.B..A";
const KOREA_CODES = ["KR", "KOR", "KRW"];

type RankingRow = {
	country: string;
	code: string;
	currencyCode: string;
	currencyUnit: string;
	neerScore: number;
	reerScore: number | null;
};

type RankingPayload = {
	rows: RankingRow[];
	krwRankNeer: number;
	krwRankReer: number;
	poolSize: number;
	updatedAt: string;
	dataPeriod: string | null;
	frequency: "monthly";
	source: string;
};

let cachedDayKey = "";
let cachedPayload: RankingPayload | null = null;

type RestCountry = {
	cca2?: string;
	currencies?: Record<string, { name?: string; symbol?: string }>;
};

const CURRENCY_NAME_KO: Record<string, string> = {
	USD: "미국 달러",
	EUR: "유로",
	JPY: "일본 엔",
	GBP: "영국 파운드",
	CHF: "스위스 프랑",
	CAD: "캐나다 달러",
	AUD: "호주 달러",
	NZD: "뉴질랜드 달러",
	KRW: "대한민국 원",
	CNY: "중국 위안",
	HKD: "홍콩 달러",
	SGD: "싱가포르 달러",
	TWD: "대만 달러",
	THB: "태국 바트",
	MYR: "말레이시아 링깃",
	IDR: "인도네시아 루피아",
	PHP: "필리핀 페소",
	INR: "인도 루피",
	VND: "베트남 동",
	BRL: "브라질 헤알",
	MXN: "멕시코 페소",
	ARS: "아르헨티나 페소",
	CLP: "칠레 페소",
	COP: "콜롬비아 페소",
	PEN: "페루 솔",
	ZAR: "남아프리카 랜드",
	RUB: "러시아 루블",
	TRY: "터키 리라",
	SEK: "스웨덴 크로나",
	NOK: "노르웨이 크로네",
	DKK: "덴마크 크로네",
	PLN: "폴란드 즈워티",
	CZK: "체코 코루나",
	HUF: "헝가리 포린트",
	RON: "루마니아 레우",
	BGN: "불가리아 레프",
	ISK: "아이슬란드 크로나",
	RSD: "세르비아 디나르",
	BAM: "보스니아 헤르체고비나 태환 마르카",
	MKD: "북마케도니아 데나르",
	ILS: "이스라엘 셰켈",
	SAR: "사우디 리얄",
	AED: "UAE 디르함",
	QAR: "카타르 리얄",
	KWD: "쿠웨이트 디나르",
	BHD: "바레인 디나르",
	OMR: "오만 리얄",
	EGP: "이집트 파운드",
	PKR: "파키스탄 루피",
	NGN: "나이지리아 나이라",
	KES: "케냐 실링",
	BDT: "방글라데시 타카",
	UAH: "우크라이나 흐리우냐",
	KZT: "카자흐스탄 텡게",
	MAD: "모로코 디르함",
	XOF: "서아프리카 CFA 프랑",
	XAF: "중앙아프리카 CFA 프랑",
};

const COUNTRY_NAME_KO: Record<string, string> = {
	KR: "대한민국",
	US: "미국",
	JP: "일본",
	GB: "영국",
	CH: "스위스",
	DE: "독일",
	FR: "프랑스",
	IT: "이탈리아",
	AT: "오스트리아",
	IE: "아일랜드",
	PT: "포르투갈",
	LU: "룩셈부르크",
	ES: "스페인",
	GR: "그리스",
	BG: "불가리아",
	MT: "몰타",
	CY: "키프로스",
	IS: "아이슬란드",
	NL: "네덜란드",
	BE: "벨기에",
	SE: "스웨덴",
	NO: "노르웨이",
	DK: "덴마크",
	FI: "핀란드",
	EE: "에스토니아",
	LV: "라트비아",
	LT: "리투아니아",
	SI: "슬로베니아",
	SK: "슬로바키아",
	HR: "크로아티아",
	CA: "캐나다",
	AU: "호주",
	NZ: "뉴질랜드",
	CN: "중국",
	HK: "홍콩",
	SG: "싱가포르",
	TW: "대만",
	TH: "태국",
	MY: "말레이시아",
	ID: "인도네시아",
	PH: "필리핀",
	VN: "베트남",
	IN: "인도",
	BR: "브라질",
	MX: "멕시코",
	AR: "아르헨티나",
	CL: "칠레",
	CO: "콜롬비아",
	PE: "페루",
	ZA: "남아프리카공화국",
	RU: "러시아",
	TR: "터키",
	RS: "세르비아",
	BA: "보스니아 헤르체고비나",
	MK: "북마케도니아",
	XM: "유로 지역",
	PL: "폴란드",
	CZ: "체코",
	HU: "헝가리",
	RO: "루마니아",
	IL: "이스라엘",
	SA: "사우디아라비아",
	AE: "아랍에미리트",
	QA: "카타르",
	KW: "쿠웨이트",
	BH: "바레인",
	OM: "오만",
	EG: "이집트",
	DZ: "알제리",
	PK: "파키스탄",
	NG: "나이지리아",
	KE: "케냐",
	BD: "방글라데시",
	UA: "우크라이나",
	KZ: "카자흐스탄",
	MA: "모로코",
	GH: "가나",
	ET: "에티오피아",
	LK: "스리랑카",
};

const REGION_DISPLAY_KO = new Intl.DisplayNames(["ko"], { type: "region" });

function dayKey(date = new Date()) {
	return date.toISOString().split("T")[0];
}

function parseAttrs(input: string) {
	const attrs: Record<string, string> = {};
	const attrRegex = /([A-Z_]+)="([^"]*)"/g;
	let match: RegExpExecArray | null;

	while ((match = attrRegex.exec(input)) !== null) {
		attrs[match[1]] = match[2];
	}

	return attrs;
}

function toKoreanCountryName(code: string, englishName: string) {
	const mapped = COUNTRY_NAME_KO[code];
	if (mapped) {
		return mapped;
	}

	if (/^[A-Z]{2}$/.test(code)) {
		try {
			const localized = REGION_DISPLAY_KO.of(code);
			if (localized && localized !== code) {
				return localized;
			}
		} catch {
			// 비표준 코드(예: XM)는 수동 매핑 또는 영문명을 사용한다.
		}
	}

	return englishName;
}

function toKoreanCurrencyUnit(code: string, englishName?: string) {
	const koName = CURRENCY_NAME_KO[code];
	if (koName) {
		return `${koName} (${code})`;
	}

	return `${englishName ?? code} (${code})`;
}

async function fetchCurrencyUnits() {
	try {
		const response = await fetch(
			"https://restcountries.com/v3.1/all?fields=cca2,currencies",
			{
				next: { revalidate: DAILY_SECONDS },
			},
		);

		if (!response.ok) {
			return new Map<
				string,
				{ currencyCode: string; currencyUnit: string }
			>();
		}

		const countries = (await response.json()) as
			| RestCountry[]
			| {
					errors?: unknown;
			  };
		if (!Array.isArray(countries)) {
			return new Map<
				string,
				{ currencyCode: string; currencyUnit: string }
			>();
		}

		const map = new Map<
			string,
			{ currencyCode: string; currencyUnit: string }
		>();

		for (const item of countries) {
			const countryCode = item.cca2;
			if (!countryCode || !item.currencies) {
				continue;
			}

			const firstCurrencyCode = Object.keys(item.currencies)[0];
			if (!firstCurrencyCode) {
				continue;
			}

			const info = item.currencies[firstCurrencyCode];
			const unitName = toKoreanCurrencyUnit(
				firstCurrencyCode,
				info?.name,
			);
			map.set(countryCode, {
				currencyCode: firstCurrencyCode,
				currencyUnit: unitName,
			});
		}

		return map;
	} catch {
		return new Map<
			string,
			{ currencyCode: string; currencyUnit: string }
		>();
	}
}

function parseBisEerXml(xml: string) {
	const seriesRegex = /<Series\s+([^>]+)>([\s\S]*?)<\/Series>/g;
	const obsRegex = /<Obs\s+([^>]+)>/g;
	const rows: { country: string; code: string; value: number }[] = [];
	let latestPeriod: string | null = null;

	let seriesMatch: RegExpExecArray | null;
	while ((seriesMatch = seriesRegex.exec(xml)) !== null) {
		const seriesAttrs = parseAttrs(seriesMatch[1]);
		const body = seriesMatch[2];

		const code = seriesAttrs.REF_AREA ?? "";
		const title = seriesAttrs.TITLE_TS ?? code;
		const country = title.split(" - ")[0] || code;

		const observations: { period: string; value: number }[] = [];
		let obsMatch: RegExpExecArray | null;
		while ((obsMatch = obsRegex.exec(body)) !== null) {
			const obsAttrs = parseAttrs(obsMatch[1]);
			const period = obsAttrs.TIME_PERIOD;
			const value = Number(obsAttrs.OBS_VALUE);
			if (!period || !Number.isFinite(value)) {
				continue;
			}
			observations.push({ period, value });
		}

		if (observations.length === 0) {
			continue;
		}

		observations.sort((a, b) => a.period.localeCompare(b.period));
		const latest = observations[observations.length - 1];

		rows.push({
			country: toKoreanCountryName(code, country),
			code,
			value: Number(latest.value.toFixed(2)),
		});

		if (!latestPeriod || latest.period > latestPeriod) {
			latestPeriod = latest.period;
		}
	}
	return { rows, latestPeriod };
}

export async function GET() {
	const today = dayKey();
	if (cachedPayload && cachedDayKey === today) {
		return NextResponse.json(cachedPayload);
	}

	try {
		const [neerResp, reerResp] = await Promise.all([
			fetch(BIS_NEER_URL, { next: { revalidate: DAILY_SECONDS } }),
			fetch(BIS_REER_URL, { next: { revalidate: DAILY_SECONDS } }),
		]);

		if (!neerResp.ok || !reerResp.ok) {
			throw new Error(
				`BIS API failed: NEER ${neerResp.status}, REER ${reerResp.status}`,
			);
		}

		const [neerXml, reerXml, currencyUnits] = await Promise.all([
			neerResp.text(),
			reerResp.text(),
			fetchCurrencyUnits(),
		]);
		const { rows: neerRows, latestPeriod: neerPeriod } =
			parseBisEerXml(neerXml);
		const { rows: reerRows, latestPeriod: reerPeriod } =
			parseBisEerXml(reerXml);

		const reerByCode = new Map(
			reerRows.map((row) => [row.code, row.value]),
		);
		const rows = neerRows
			.map((row) => {
				const unit = currencyUnits.get(row.code);
				return {
					country: row.country,
					code: row.code,
					currencyCode: unit?.currencyCode ?? row.code,
					currencyUnit: unit?.currencyUnit ?? row.code,
					neerScore: row.value,
					reerScore: reerByCode.get(row.code) ?? null,
				};
			})
			.sort((a, b) => b.neerScore - a.neerScore);

		const reerSorted = [...rows]
			.filter((item) => typeof item.reerScore === "number")
			.sort((a, b) => (b.reerScore as number) - (a.reerScore as number));

		const latestPeriod =
			[neerPeriod, reerPeriod].filter(Boolean).sort().at(-1) ?? null;

		if (rows.length === 0) {
			throw new Error("BIS parsing returned no rows");
		}

		const payload: RankingPayload = {
			rows,
			krwRankNeer:
				rows.findIndex(
					(item) =>
						KOREA_CODES.includes(item.code) ||
						item.country.includes("Korea"),
				) + 1,
			krwRankReer:
				reerSorted.findIndex(
					(item) =>
						KOREA_CODES.includes(item.code) ||
						item.country.includes("Korea"),
				) + 1,
			poolSize: rows.length,
			updatedAt: new Date().toISOString(),
			dataPeriod: latestPeriod,
			frequency: "monthly",
			source: "BIS WS_EER (M.N.B..A + M.R.B..A)",
		};

		cachedPayload = payload;
		cachedDayKey = today;

		return NextResponse.json(payload);
	} catch {
		if (cachedPayload) {
			return NextResponse.json({
				...cachedPayload,
				source: `${cachedPayload.source} (cached fallback)`,
			});
		}

		return NextResponse.json({
			rows: [],
			krwRankNeer: 0,
			krwRankReer: 0,
			poolSize: 0,
			updatedAt: new Date().toISOString(),
			dataPeriod: null,
			frequency: "monthly",
			source: "BIS unavailable",
		});
	}
}
