"use client";

import Link from "next/link";
import { useState } from "react";
import { Space_Grotesk } from "next/font/google";
import { ShopProvider, useShop } from "./ShopProvider";
import { Toaster } from "react-hot-toast";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-shop",
  weight: ["400", "500", "700"],
});

function ShopNavigation() {
  const { cartCount, resetShopState } = useShop();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const links = [
    { href: "/shop", label: "Home" },
    { href: "/shop/products", label: "Products" },
    { href: "/shop/car-parts", label: "Car Parts" },
    { href: "/shop/finance", label: "Finance" },
    { href: "/shop/orders", label: "My Orders" },
    { href: "/shop/cart", label: `Cart (${cartCount})` },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-amber-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link href="/shop" className="text-xl font-bold tracking-tight text-slate-900">
          Soko Marketplace
        </Link>

        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          aria-controls="shop-mobile-nav"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-2 text-slate-700 transition hover:bg-amber-100 md:hidden"
        >
          <span className="sr-only">Open menu</span>
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {isMenuOpen ? (
              <path
                d="M6 6L18 18M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M4 7H20M4 12H20M4 17H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>

        <nav className="hidden items-center gap-2 rounded-full bg-amber-50 p-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={resetShopState}
            className="rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            Reset
          </button>
        </nav>
      </div>

      {isMenuOpen && (
        <nav id="shop-mobile-nav" className="border-t border-amber-100 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-amber-100"
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                resetShopState();
                setIsMenuOpen(false);
              }}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Reset
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopProvider>
      <div
        className={`${spaceGrotesk.variable} min-h-screen bg-[radial-gradient(circle_at_20%_20%,#fff1d6_0,#fff9ec_35%,#f6f7fb_100%)] font-sans text-slate-900`}
      >
        <ShopNavigation />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">{children}</main>
        <Toaster />
      </div>
    </ShopProvider>
  );
}
