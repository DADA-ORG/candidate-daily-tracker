import * as XLSX from "xlsx";
import type { RawRow } from "./types";

const EXPECTED_HEADERS = [
  "Candidate",
  "Client Name",
  "Job",
  "User",
  "Last Update",
  "Process",
  "Client Interview Rounds",
  "Client Interview Interview Date",
  "ClientInterview Round",
  "Company",
  "Candidate Status",
  "Candidate Tags",
  "Date Added",
];

/** Excel 日期序列号 -> JS Date（Excel 以 1899-12-30 为纪元起点） */
function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial);
  const totalSeconds = Math.round(fractionalDay * 86400);
  dateInfo.setSeconds(dateInfo.getSeconds() + totalSeconds);
  return dateInfo;
}

/** 把各种可能的日期表示（Date对象/Excel序列号/"2026-06-26 10:52"字符串）统一转成 ISO 字符串 */
function normalizeDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return excelSerialToDate(value).toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value.trim().replace(" ", "T"));
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    return value; // 解析不了先原样保留，rules.ts 里会再兜底跳过
  }
  return String(value);
}

/**
 * 解析上传的 Excel（ATS 按 Process 阶段导出的候选人流程表）为标准化的行数组。
 * 两张表（CV Sent / CCM）表头一致，用同一个解析函数处理。
 */
export function parseExcelToRawRows(buffer: ArrayBuffer | Buffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  if (json.length > 0) {
    const missingHeaders = EXPECTED_HEADERS.filter((h) => !(h in json[0]));
    if (missingHeaders.length > 0) {
      throw new Error(
        `表格缺少预期字段：${missingHeaders.join(
          "、"
        )}。请确认上传的是候选人流程导出表，且表头没有被改动。`
      );
    }
  }

  return json.map((row) => ({
    Candidate: String(row["Candidate"] ?? ""),
    "Client Name": String(row["Client Name"] ?? ""),
    Job: String(row["Job"] ?? ""),
    User: String(row["User"] ?? ""),
    "Last Update": normalizeDateValue(row["Last Update"]),
    Process: String(row["Process"] ?? ""),
    "Client Interview Rounds":
      row["Client Interview Rounds"] != null
        ? String(row["Client Interview Rounds"])
        : null,
    "Client Interview Interview Date": normalizeDateValue(
      row["Client Interview Interview Date"]
    ),
    "ClientInterview Round":
      row["ClientInterview Round"] != null
        ? Number(row["ClientInterview Round"])
        : null,
    Company: row["Company"] != null ? String(row["Company"]) : null,
    "Candidate Status":
      row["Candidate Status"] != null ? String(row["Candidate Status"]) : null,
    "Candidate Tags":
      row["Candidate Tags"] != null ? String(row["Candidate Tags"]) : null,
    "Date Added": normalizeDateValue(row["Date Added"]),
  }));
}
