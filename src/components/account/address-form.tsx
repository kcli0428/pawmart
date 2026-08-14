"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  saveAddressAction,
  type AddressActionState,
} from "@/app/account/actions";
import { HK_DISTRICTS } from "@/lib/constants";

type AddressValues = {
  id: string;
  label: string | null;
  recipient: string;
  phone: string;
  district: string;
  address: string;
  isDefault: boolean;
};

export function AddressForm({ address }: { address?: AddressValues }) {
  const [state, formAction, pending] = useActionState<AddressActionState, FormData>(
    saveAddressAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      {address && <input type="hidden" name="id" value={address.id} />}
      <input
        name="label"
        placeholder="標籤（家 / 公司）"
        defaultValue={address?.label ?? ""}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="recipient"
        required
        placeholder="收件人 *"
        defaultValue={address?.recipient}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <input
        name="phone"
        required
        placeholder="電話 *"
        defaultValue={address?.phone}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <select
        name="district"
        required
        defaultValue={address?.district ?? ""}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      >
        <option value="">選擇地區 *</option>
        {HK_DISTRICTS.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </select>
      <textarea
        name="address"
        required
        placeholder="詳細地址 *"
        defaultValue={address?.address}
        rows={2}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} />
        設為預設送貨地址
      </label>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-green-700">{state.ok}</p>}
      <Button type="submit" size="sm" className="w-full" disabled={pending}>
        {pending ? "儲存中…" : address ? "更新地址" : "新增地址"}
      </Button>
    </form>
  );
}
