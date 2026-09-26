import "./globals.css";

export const metadata = {
  title: "Travel App",
  description: "Making travel easier.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
