// The promote step of the validate→promote gate (BRA-36). Fetches a DataSource,
// validates it as a unit, and writes to the live tables ONLY if there are no
// errors. On failure it returns the report without touching live data, so the
// caller (seed / scheduled scraper) can alert and leave yesterday's good data intact.

import type { PrismaClient } from "@/generated/prisma/client";
import type { DataSource } from "./types";
import { fetchDataSource, loadData, type LoadResult } from "./load";
import {
  validateLoadedData,
  formatValidationReport,
  type ValidationReport,
  type ValidateOptions,
} from "./validate";

export interface IngestResult {
  promoted: boolean;
  report: ValidationReport;
  // Present only when promoted.
  result?: LoadResult;
}

export async function promoteIfValid(
  prisma: PrismaClient,
  source: DataSource,
  opts: ValidateOptions = {},
): Promise<IngestResult> {
  const data = await fetchDataSource(source);
  const report = validateLoadedData(data, opts);

  if (!report.ok) {
    return { promoted: false, report };
  }

  const result = await loadData(prisma, data, source.name);
  return { promoted: true, report, result };
}

export { formatValidationReport };
