import type { Metadata } from "next";
import "@cloudscape-design/global-styles/index.css";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Route 53 | Global",
  description: "Amazon Route 53 console clone - hosted zones and DNS record management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
