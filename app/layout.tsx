import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CameraStatusProvider } from "@/components/CameraStatus";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Camera Node",
  description: "RTSP Camera Stream and Recording System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <CameraStatusProvider>
          {children}
        </CameraStatusProvider>
      </body>
    </html>
  );
}
