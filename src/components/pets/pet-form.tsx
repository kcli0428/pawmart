"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const SPECIES = [
  { value: "DOG", label: "狗" },
  { value: "CAT", label: "貓" },
  { value: "BIRD", label: "雀鳥" },
  { value: "RABBIT", label: "兔" },
  { value: "OTHER", label: "其他" },
];

const LIFE_STAGES = [
  { value: "PUPPY", label: "幼犬" },
  { value: "KITTEN", label: "幼貓" },
  { value: "ADULT", label: "成犬/成貓" },
  { value: "SENIOR", label: "老年" },
];

export function PetForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const allergiesRaw = (form.get("allergies") as string) || "";
    const allergies = allergiesRaw
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/pets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        species: form.get("species"),
        breed: form.get("breed") || undefined,
        weightKg: form.get("weightKg") ? Number(form.get("weightKg")) : undefined,
        lifeStage: form.get("lifeStage") || undefined,
        allergies,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "建立失敗");
      setLoading(false);
      return;
    }

    router.refresh();
    (e.target as HTMLFormElement).reset();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <input
        name="name"
        placeholder="寵物名字 *"
        required
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <select
        name="species"
        required
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      >
        {SPECIES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        name="breed"
        placeholder="品種（選填）"
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <select
        name="lifeStage"
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      >
        <option value="">生命階段（選填）</option>
        {LIFE_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        name="weightKg"
        type="number"
        step="0.1"
        min="0"
        placeholder="體重 kg（選填）"
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="allergies"
        placeholder="過敏原（逗號分隔，如：雞肉, 穀物）"
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" size="sm" className="w-full" disabled={loading}>
        {loading ? "儲存中…" : "新增寵物"}
      </Button>
    </form>
  );
}
