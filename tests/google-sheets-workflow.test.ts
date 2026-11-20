import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Source-level contract tests for multi-format file import workflow.
 */

const pagePath = path.resolve("src/pages/app/GoogleSheetsPage.tsx");
const page = fs.readFileSync(pagePath, "utf8");

describe("GoogleSheetsPage file import workflow", () => {
  it("supports CSV, Excel, and JSON uploads", () => {
    expect(page).toMatch(/\.csv,\s*\.xlsx,\s*\.xls,\s*\.json/);
    expect(page).toMatch(/handleFile/);
    expect(page).toMatch(/parseJson/);
    expect(page).toMatch(/XLSX/);
  });

  it("provides preview, mapping, and import confirmation", () => {
    expect(page).toMatch(/Preview & map/);
    expect(page).toMatch(/entityFields/);
    expect(page).toMatch(/showImportConfirm/);
    expect(page).toMatch(/Confirm import/);
    expect(page).toMatch(/disabled=\{importing/);
  });

  it("persists mapped records and refreshes data", () => {
    expect(page).toMatch(/createEntitiesBatch\(importTarget/);
    expect(page).toMatch(/ledgerly:data-updated/);
  });

  it("redirects to dashboard on successful import", () => {
    expect(page).toMatch(/navigate\('\/app\/dashboard'\)/);
  });

  it("does not include direct Google Sheet URL/ID paste or Drive discovery", () => {
    expect(page).not.toMatch(/loadTabsFromUrl/);
    expect(page).not.toMatch(/listTabs/);
    expect(page).not.toMatch(/previewSheet/);
    expect(page).not.toMatch(/syncSheet/);
    expect(page).not.toMatch(/Paste a Google Sheet URL/);
    expect(page).not.toMatch(/gapi\.picker/);
    expect(page).not.toMatch(/drive\.readonly/);
  });

  it("does not expose tokens to the UI", () => {
    expect(page).not.toMatch(/access[_-]?token/i);
    expect(page).not.toMatch(/refresh[_-]?token/i);
    expect(page).not.toMatch(/client[_-]?secret/i);
  });
});


