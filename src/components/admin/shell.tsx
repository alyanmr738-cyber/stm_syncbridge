import Link from "next/link";
import { NavLinks } from "@/components/admin/nav-links";
import { LogoutButton } from "@/components/admin/logout-button";

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#192b36]">
      <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-[#e1e8ec] bg-white px-5 py-3 md:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-[#1c4454] text-sm font-extrabold text-white">
            S
          </span>
          <span>
            <span className="block text-[17px] font-semibold leading-tight tracking-[-0.4px]">
              SyncBridge
            </span>
            <span className="text-xs text-[#657683]">
              Septic Tank Man · All Access Digital
            </span>
          </span>
        </div>
        <div className="flex w-full flex-col items-start gap-3 md:w-auto md:flex-row md:items-center">
          <NavLinks />
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#e9f5ef] px-2.5 py-1 text-[11px] font-semibold text-[#267651]">
              Discovery
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1160px] px-5 pb-12 pt-8 md:px-[22px] md:pt-[34px]">
        <h1 className="text-[25px] font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mb-6 mt-1 text-[13px] text-[#657683]">{subtitle}</p>
        ) : (
          <div className="mb-6" />
        )}
        {children}
      </main>
    </div>
  );
}

export function Panel({
  children,
  heading,
  aside,
}: {
  children: React.ReactNode;
  heading?: string;
  aside?: string;
}) {
  return (
    <section className="rounded-[14px] border border-[#e1e8ec] bg-white p-5 md:p-[21px]">
      {heading ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">{heading}</h2>
          {aside ? <span className="text-xs text-[#657683]">{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <article className="rounded-[14px] border border-[#e1e8ec] bg-white p-5 md:p-[21px]">
      <label className="text-xs text-[#657683]">{label}</label>
      <div className="mt-2.5 text-[29px] font-bold leading-none">{value}</div>
      {caption ? <small className="mt-2 block text-xs text-[#657683]">{caption}</small> : null}
    </article>
  );
}

export function FlagRow({
  label,
  enabled,
  variant = "off",
}: {
  label: string;
  enabled: boolean;
  variant?: "off" | "available";
}) {
  const showAvailable = variant === "available" && enabled;
  return (
    <div className="flex items-center justify-between border-t border-[#eef1f3] py-3 text-[13px] first:border-t-0">
      <span>{label}</span>
      {showAvailable ? (
        <span className="rounded-full bg-[#e9f5ef] px-2.5 py-1 text-[11px] font-semibold text-[#267651]">
          Available
        </span>
      ) : (
        <span
          className={
            enabled
              ? "rounded-full bg-[#e9f5ef] px-2.5 py-1 text-[11px] font-semibold text-[#267651]"
              : "rounded-[9px] bg-[#eff1f3] px-2.5 py-1 text-[11px] text-[#52636b]"
          }
        >
          {enabled ? "ON" : "OFF"}
        </span>
      )}
    </div>
  );
}

export function SettingsSubnav() {
  const links = [
    { href: "/settings/connections", label: "Connections" },
    { href: "/settings/mappings", label: "Mappings" },
    { href: "/settings/audit", label: "Audit" },
  ];
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-lg border border-[#e1e8ec] bg-white px-3 py-1.5 text-xs font-medium text-[#657683] hover:border-[#1c4454] hover:text-[#1d4654]"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
