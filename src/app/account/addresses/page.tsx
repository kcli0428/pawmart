import { AddressForm } from "@/components/account/address-form";
import { Button } from "@/components/ui/button";
import {
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/app/account/actions";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function AddressesPage() {
  const session = await requireUser();
  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });

  return (
    <div>
      <h1 className="text-3xl font-bold">送貨地址</h1>
      <p className="mt-1 text-zinc-600">結帳時會使用預設地址</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-white p-6">
          <h2 className="font-semibold">新增地址</h2>
          <div className="mt-4">
            <AddressForm />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {addresses.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-amber-200 bg-white p-8 text-center text-zinc-500">
              尚未新增送貨地址。
            </p>
          ) : (
            addresses.map((address) => (
              <div
                key={address.id}
                className="rounded-2xl border border-amber-100 bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {address.label || "地址"}
                      {address.isDefault && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          預設
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {address.recipient} · {address.phone}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {address.district} {address.address}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!address.isDefault && (
                      <form action={setDefaultAddressAction}>
                        <input type="hidden" name="id" value={address.id} />
                        <Button type="submit" size="sm" variant="outline">
                          設為預設
                        </Button>
                      </form>
                    )}
                    <form action={deleteAddressAction}>
                      <input type="hidden" name="id" value={address.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        刪除
                      </Button>
                    </form>
                  </div>
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-amber-700">
                    編輯
                  </summary>
                  <div className="mt-3 max-w-md">
                    <AddressForm address={address} />
                  </div>
                </details>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
