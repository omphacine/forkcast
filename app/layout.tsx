import type { Metadata } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "./ThemeToggle";
import { ToastListener } from "./ToastListener";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ForkCast",
  description: "ForkCast — recipes, meal planning, food inventory, and shopping in one place.",
  appleWebApp: {
    title: "ForkCast",
  },
};

// Applied before paint so a returning visitor's saved theme choice never
// flashes the wrong theme first.
const themeInitScript = `(function() {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.classList.add(stored);
    }
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeToggle />
        <ToastListener />
      </body>
    </html>
  );
}
