import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * GoogleSheetsPage is now a synchronous file-upload workflow (no async tab/preview fetches),
 * so stale-request guards are no longer applicable.
 */

const pagePath = path.resolve("src/pages/app/GoogleSheetsPage.tsx");
const page = fs.readFileSync(pagePath, "utf8");

describe("GoogleSheetsPage upload workflow (no stale async sheet loads)", () => {
  it("does not use URL/ID tab/preview request counters", () => {
    expect(page).not.toMatch(/activeRequestId/);
    expect(page).not.toMatch(/requestCounter/);
  });

  it("handles file parsing and import confirmation", () => {
    expect(page).toMatch(/handleFile/);
    expect(page).toMatch(/showImportConfirm/);
    expect(page).toMatch(/Confirm import/);
  });
});


