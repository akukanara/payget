import "./globals.css";

export const metadata = {
  title: "Kanara Payments",
  description: "Modern dashboard dan playground untuk Midtrans Payment API",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
