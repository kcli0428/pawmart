import Link from "next/link";
import Image from "next/image";
import { formatHkd } from "@/lib/utils";

type ProductCardProps = {
  slug: string;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  priceHkd: number;
  compareAtPrice?: number | null;
  caption?: string;
};

export function ProductCard({
  slug,
  name,
  brand,
  imageUrl,
  priceHkd,
  compareAtPrice,
  caption,
}: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square bg-amber-50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🐾</div>
        )}
      </div>
      <div className="p-4">
        {brand && (
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
            {brand}
          </p>
        )}
        <h3 className="mt-1 line-clamp-2 font-semibold text-zinc-900">{name}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-amber-700">
            {formatHkd(priceHkd)}
          </span>
          {compareAtPrice && compareAtPrice > priceHkd && (
            <span className="text-sm text-zinc-400 line-through">
              {formatHkd(compareAtPrice)}
            </span>
          )}
        </div>
        {caption ? <p className="mt-1 text-xs text-amber-700">{caption}</p> : null}
      </div>
    </Link>
  );
}
