import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TestTick",
  description: "Modern test case management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
