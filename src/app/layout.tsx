import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";

const bodyStyle = {
  "--font-inter": '"Inter", "Segoe UI", Arial, sans-serif',
  "--font-geist-mono": '"Consolas", "Courier New", monospace',
} satisfies CSSProperties;

export const metadata: Metadata = {
  title: "WorkHive - UC South Campus HRMS",
  description:
    "WorkHive: a modern Human Resource Information System for University of Cebu - South Campus. Attendance, leave, recruitment, and records - all in one hive.",
  keywords: [
    "WorkHive",
    "UC South Campus",
    "HRMS",
    "Human Resource",
    "University of Cebu",
  ],
  authors: [{ name: "University of Cebu - South Campus HR" }],
  icons: {
    icon: "/workhive-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={bodyStyle}
        className="font-sans antialiased bg-background text-foreground"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <Toaster />
            <Sonner />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
