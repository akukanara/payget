import "./globals.css";

export const metadata = {
  title: "Payment Dashboard",
  description: "Dashboard user dan admin untuk Midtrans Payment API",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
