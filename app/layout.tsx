import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boardmark — know your days",
  description: "A simple personal tracker for boarding stays and monthly bill days."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
