import { readFileSync } from "fs";
import path from "path";

export type FieldMappingRow = {
  entity: string;
  field: string;
  authoritativeSource: string;
  flow: string;
  policy: string;
};

export function loadFieldMappingSpec(): FieldMappingRow[] {
  const file = path.join(process.cwd(), "spec", "field_mapping.csv");
  const raw = readFileSync(file, "utf8");
  const lines = raw.trim().split("\n").slice(1);
  return lines.map((line) => {
    const cols = parseCsvLine(line);
    return {
      entity: cols[0] ?? "",
      field: cols[1] ?? "",
      authoritativeSource: cols[2] ?? "",
      flow: cols[3] ?? "",
      policy: cols[6] ?? "",
    };
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}
