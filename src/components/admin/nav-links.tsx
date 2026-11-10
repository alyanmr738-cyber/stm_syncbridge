"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/overview", label: "Overview" },
  { href: "/activity", label: "Activity" },
  { href: "/links", label: "Customers" },
  { href: "/conflicts", label: "Conflicts" },
  { href: "/bookings", label: "Bookings" },
  { href: "/reviews", label: "Reviews" },
  { href: "/settings/connections", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-4 text-[13px] text-[#657683] md:gap-[22px]">
      {nav.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/settings/connections" &&
            pathname.startsWith("/settings"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "font-bold text-[#1d4654]"
                : "transition-colors hover:text-[#1d4654]"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
