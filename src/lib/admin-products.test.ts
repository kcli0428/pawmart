import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminProductOrderBy,
  adminProductQueryIsFiltered,
  adminProductWhere,
  parseAdminProductQuery,
  productStockTotal,
  sortAdminProducts,
} from "./admin-products";

describe("parseAdminProductQuery", () => {
  it("defaults to all products sorted by recent update", () => {
    assert.deepEqual(parseAdminProductQuery({}), {
      q: "",
      categoryId: "",
      status: "all",
      species: "",
      sort: "updated",
    });
  });

  it("reads search, filters, and a valid sort", () => {
    const query = parseAdminProductQuery({
      q: " Astkatta ",
      categoryId: "cat-wet",
      status: "inactive",
      species: "CAT",
      sort: "stockAsc",
    });
    assert.equal(query.q, "Astkatta");
    assert.equal(query.status, "inactive");
    assert.equal(query.sort, "stockAsc");
    assert.equal(adminProductQueryIsFiltered(query), true);
  });

  it("ignores unknown sort and status values", () => {
    const query = parseAdminProductQuery({ status: "deleted", sort: "price" });
    assert.equal(query.status, "all");
    assert.equal(query.sort, "updated");
  });
});

describe("adminProductWhere", () => {
  it("builds name/brand/sku search and active status", () => {
    const where = adminProductWhere({
      q: "Kidney",
      categoryId: "abc",
      status: "active",
      species: "CAT",
      sort: "name",
    });
    assert.equal(where.categoryId, "abc");
    assert.equal(where.isActive, true);
    assert.deepEqual(where.suitableFor, { has: "CAT" });
    assert.ok(Array.isArray(where.OR));
  });

  it("omits empty filters", () => {
    assert.deepEqual(
      adminProductWhere({
        q: "",
        categoryId: "",
        status: "all",
        species: "DRAGON",
        sort: "updated",
      }),
      {},
    );
  });
});

describe("sortAdminProducts", () => {
  it("orders by total stock", () => {
    const products = [
      { id: "a", variants: [{ stockQuantity: 10 }, { stockQuantity: 2 }] },
      { id: "b", variants: [{ stockQuantity: 1 }] },
    ];
    assert.equal(productStockTotal(products[0]!), 12);
    assert.deepEqual(
      sortAdminProducts(products, "stockAsc").map((item) => item.id),
      ["b", "a"],
    );
    assert.deepEqual(
      sortAdminProducts(products, "stockDesc").map((item) => item.id),
      ["a", "b"],
    );
    assert.equal(sortAdminProducts(products, "name")[0]?.id, "a");
  });

  it("maps name sorts to prisma orderBy", () => {
    assert.deepEqual(adminProductOrderBy("nameDesc"), { name: "desc" });
    assert.deepEqual(adminProductOrderBy("updated"), { updatedAt: "desc" });
  });
});
