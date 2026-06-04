import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import ThemeRegistry from "@/theme/ThemeRegistry";
import SWRProvider from "@/lib/SWRProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { SnackbarProvider } from "@/contexts/SnackbarContext";
import { CourseFilterProvider } from "@/contexts/CourseFilterContext";
import { Header, Footer, ProgressBar } from "@/components/layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CourseBench",
  description: "ShanghaiTech 课程评价平台 — To be the best bench.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeRegistry>
          <SWRProvider>
            <AuthProvider>
              <SearchProvider>
                <SnackbarProvider>
                  <CourseFilterProvider>
                    {/* <Suspense fallback={null}> */}
                    {/* </Suspense> */}
                    <ProgressBar />
                    <Header />
                    <main className="flex-1">{children}</main>
                    <Footer />
                  </CourseFilterProvider>
                </SnackbarProvider>
              </SearchProvider>
            </AuthProvider>
          </SWRProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
