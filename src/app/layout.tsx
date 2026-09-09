import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OMS Pro — Order Management System",
  description:
    "OMS Pro — complete Order Management System for export & marketplace sellers. Orders, dispatch, documents, finance, inventory and HR in one place.",
  icons: {
    icon: [
      { url: "/logo-icon.png", type: "image/png", sizes: "256x256" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
