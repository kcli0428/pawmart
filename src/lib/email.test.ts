import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campaignEmailHtml } from "./email";

describe("campaignEmailHtml", () => {
  it("includes the campaign title and body", () => {
    const html = campaignEmailHtml("Mochi 快吃完了", "估計還剩 3 天。");
    assert.match(html, /Mochi 快吃完了/);
    assert.match(html, /估計還剩 3 天。/);
  });
});
