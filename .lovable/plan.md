

# Fix: High Severity Vulnerability in `xlsx` Package

## Problem
The `xlsx` package (v0.18.5) has two known high-severity vulnerabilities:
- Prototype Pollution
- Regular Expression Denial of Service (ReDoS)

The `xlsx` package (SheetJS Community Edition) is no longer maintained on npm. The last update was 2022.

## Solution
Replace `xlsx` with `xlsx-js-style` (a maintained fork) or use the official SheetJS distribution. However, the simplest safe path is to keep using `xlsx` but ensure we're not exposed to the vulnerabilities by updating usage patterns.

Looking at the codebase, `xlsx` is used in:
- `src/utils/narrationExport.ts` — Excel export for narration reports
- `src/components/CsvBulkImport.tsx` — CSV/Excel import

Since SheetJS CE on npm is abandoned, the recommended approach is to **replace it with a maintained alternative**. The best drop-in option is to keep the current version but acknowledge the risk, OR switch to a different library.

**Recommended**: The vulnerabilities in `xlsx` are in parsing untrusted input. Our export-only usage in `narrationExport.ts` is low-risk, but `CsvBulkImport.tsx` parses user-uploaded files which IS at risk.

**Plan**: Remove `xlsx` and replace with `read-excel-file` for import functionality, and use a lightweight CSV/JSON-to-XLSX writer for exports. However, this would be a significant refactor.

**Pragmatic approach**: Since there's no patched version of `xlsx` on npm, and the alternatives require API changes, I'll document this clearly:

1. **Replace `xlsx` with `xlsx-js-style`** (v1.2+) — a maintained fork that is API-compatible and includes security fixes
2. Update `package.json` to swap the dependency
3. Update imports in both files — the API is identical, only the import name changes

## Files to Change

| File | Change |
|------|--------|
| `package.json` | Remove `xlsx`, add `xlsx-js-style` |
| `src/utils/narrationExport.ts` | Change import from `xlsx` to `xlsx-js-style` |
| `src/components/CsvBulkImport.tsx` | Change import from `xlsx` to `xlsx-js-style` |

