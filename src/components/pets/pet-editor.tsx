"use client";

import { useState } from "react";
import { PetForm, type PetFormValues } from "@/components/pets/pet-form";
import { Button } from "@/components/ui/button";

export function PetEditor({ pet }: { pet: PetFormValues }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        {open ? "取消" : "編輯"}
      </Button>
      {open && <PetForm pet={pet} />}
    </div>
  );
}
