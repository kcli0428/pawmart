import Link from "next/link";
import { requireUser } from "@/lib/session";

const LINKS = [
  { href: "/account/pets", label: "寵物檔案" },
  { href: "/account/orders", label: "訂單" },
  { href: "/account/subscriptions", label: "定期補貨" },
  { href: "/account/points", label: "寵物點數" },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-100 hover:bg-amber-50"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
