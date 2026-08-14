import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campaignConversionSummary, campaignWouldConvert } from "./campaign-conversion";

describe("campaign conversion", () => {
  const sentAt = new Date("2026-08-01T00:00:00Z");

  it("converts a birthday campaign when the member orders within 14 days", () => {
    assert.equal(
      campaignWouldConvert({
        sentAt,
        convertedAt: null,
        orderedAt: new Date("2026-08-10T00:00:00Z"),
        type: "BIRTHDAY",
        orderProductSpecies: [["DOG"]],
      }),
      true,
    );
  });

  it("does not convert after the 14-day window", () => {
    assert.equal(
      campaignWouldConvert({
        sentAt,
        convertedAt: null,
        orderedAt: new Date("2026-08-20T00:00:00Z"),
        type: "BIRTHDAY",
        orderProductSpecies: [["CAT"]],
      }),
      false,
    );
  });

  it("requires a matching species for reorder campaigns", () => {
    assert.equal(
      campaignWouldConvert({
        sentAt,
        convertedAt: null,
        orderedAt: new Date("2026-08-03T00:00:00Z"),
        type: "REORDER",
        petSpecies: "CAT",
        orderProductSpecies: [["DOG"]],
      }),
      false,
    );
    assert.equal(
      campaignWouldConvert({
        sentAt,
        convertedAt: null,
        orderedAt: new Date("2026-08-03T00:00:00Z"),
        type: "REORDER",
        petSpecies: "CAT",
        orderProductSpecies: [["CAT"]],
      }),
      true,
    );
  });

  it("summarises conversion rate from sent campaigns", () => {
    assert.deepEqual(
      campaignConversionSummary([
        { sentAt, convertedAt: sentAt },
        { sentAt, convertedAt: null },
        { sentAt: null, convertedAt: null },
      ]),
      { sent: 2, converted: 1, rate: 50 },
    );
  });
});
