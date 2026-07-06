import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import Script from "next/script";

export const metadata = {
  title: "Hazel Market",
  description: "Standalone storefront application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://www.gstatic.com/chat-messenger/sdk/prod/v1.16/themes/chat-messenger-default.css" />
        <link rel="stylesheet" href="https://www.gstatic.com/chat-messenger/sdk/prod/v1.16/themes/chat-messenger-layout.css" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ChatWidget />
        {/* Load the widget script after the page is interactive so it finds the custom elements in the DOM */}
        <Script
          src="https://www.gstatic.com/chat-messenger/sdk/prod/v1.16/chat-messenger.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
