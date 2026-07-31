import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PasteListener } from "./paste-listener";
import { RegisterServiceWorker } from "./register-service-worker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inventro",
  description: "Household inventory and grocery-prediction tracker.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16a34a",
  colorScheme: "light dark",
};

// S-36a/REQ-26: applies the .dark class before first paint (a blocking
// inline script, not useEffect -- a post-hydration toggle would show a
// flash of the wrong theme, the exact bug this exists to prevent). This is
// the ONLY mechanism that flips dark mode: app/globals.css's `dark:` variant
// is defined as `&:is(.dark *)` (class-driven), not a
// `prefers-color-scheme` media query, so nothing else may set the dark
// palette without also touching this class or the ~13 `dark:`-variant call
// sites go dead.
const DARK_MODE_SCRIPT = `
(function () {
  var mql = window.matchMedia('(prefers-color-scheme: dark)');
  function apply(matches) {
    document.documentElement.classList.toggle('dark', matches);
  }
  apply(mql.matches);
  mql.addEventListener('change', function (e) { apply(e.matches); });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />
      </head>
      <body>
        <RegisterServiceWorker />
        <PasteListener />
        {children}
      </body>
    </html>
  );
}
