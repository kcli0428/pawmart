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

export type PetFormValues = {
  id: string;
  name: string;
  species: string;
  breed: string;
  weightKg: number | null;
  lifeStage: string;
  allergies: string[];
  birthDate: string;
};

export function PetForm({ pet }: { pet?: PetFormValues }) {
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

    const payload = {
      name: form.get("name"),
      species: form.get("species"),
      breed: form.get("breed") || undefined,
      weightKg: form.get("weightKg") ? Number(form.get("weightKg")) : undefined,
      lifeStage: form.get("lifeStage") || undefined,
      birthDate: form.get("birthDate") || undefined,
      allergies,
    };

    const res = await fetch(pet ? `/api/pets/${pet.id}` : "/api/pets", {
      method: pet ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "儲存失敗");
      setLoading(false);
      return;
    }

    router.refresh();
    if (!pet) (e.target as HTMLFormElement).reset();
    setLoading(false);
  }

  async function handleDelete() {
    if (!pet) return;
    if (!confirm(`確定刪除 ${pet.name} 的檔案？`)) return;
    setLoading(true);
    const res = await fetch(`/api/pets/${pet.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "刪除失敗");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <input
        name="name"
        placeholder="寵物名字 *"
        required
        defaultValue={pet?.name}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <select
        name="species"
        required
        defaultValue={pet?.species ?? "DOG"}
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
        defaultValue={pet?.breed}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <select
        name="lifeStage"
        defaultValue={pet?.lifeStage ?? ""}
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
        defaultValue={pet?.weightKg ?? ""}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="birthDate"
        type="date"
        defaultValue={pet?.birthDate}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="allergies"
        placeholder="過敏原（逗號分隔，如：雞肉, 穀物）"
        defaultValue={pet?.allergies.join("、")}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" size="sm" className="w-full" disabled={loading}>
        {loading ? "儲存中…" : pet ? "更新檔案" : "新增寵物"}
      </Button>
      {pet && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full text-red-700"
          disabled={loading}
          onClick={handleDelete}
        >
          刪除檔案
        </Button>
      )}
    </form>
  );
}
