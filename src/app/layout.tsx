import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "NuAnswers — AI Tutor for Accounting & Finance",
  description:
    "A step-by-step AI tutor built by Beta Alpha Psi, Nu Sigma Chapter. Guides you to the answer — never just gives it.",
  metadataBase: new URL("https://nuanswers.org"),
  openGraph: {
    title: "NuAnswers — AI Tutor for Accounting & Finance",
    description:
      "Step-by-step AI tutoring for FDU students. Guides you to the answer — never just gives it.",
    type: "website",
  },
};

export const THEME_COOKIE_NAME = "nuanswers-theme";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the user's preferred theme cookie server-side so the very first
  // paint already has the right colors — no flash, no flicker. Default
  // is dark to match the BAP brand.
  const c = await cookies();
  const theme =
    c.get(THEME_COOKIE_NAME)?.value === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
