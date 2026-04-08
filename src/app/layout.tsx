import type { Metadata } from "next";
import { Manrope, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

const titleFont = Manrope({
	variable: "--font-title",
	weight: ["600", "700", "800"],
	subsets: ["latin"],
});

const bodyFont = IBM_Plex_Sans_KR({
	variable: "--font-body",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
	title: "Won Collapse Monitor",
	description: "원화 가치 하락을 실시간으로 보여주는 대시보드",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="ko"
			className={`${titleFont.variable} ${bodyFont.variable} h-full antialiased dark`}
		>
			<body className="min-h-full flex flex-col bg-background text-foreground">
				<QueryProvider>{children}</QueryProvider>
			</body>
		</html>
	);
}
