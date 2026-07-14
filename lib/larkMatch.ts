import { getTenantAccessToken } from "./larkAuth";
import type { ConsultantMatch } from "./types";

interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

function extractText(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    // 富文本字段常见结构：[{ text: "..." }, ...]
    return value
      .map((v) =>
        typeof v === "object" && v && "text" in (v as Record<string, unknown>)
          ? String((v as Record<string, unknown>).text ?? "")
          : ""
      )
      .join("")
      .trim();
  }
  return null;
}

function extractPersonOpenId(value: unknown): string | null {
  // 人员字段返回形如 [{ id: "ou_xxx", name: "...", en_name: "..." }]
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as { id?: string };
    return first.id ?? null;
  }
  return null;
}

/**
 * 读取姓名对照表（飞书多维表格 Bitable），返回 顾问姓名 -> open_id 的映射。
 * 需要环境变量：LARK_BITABLE_APP_TOKEN / LARK_BITABLE_TABLE_ID，
 * 以及可选的 LARK_BITABLE_NAME_FIELD / LARK_BITABLE_USER_FIELD（默认"姓名"/"关联人员"）。
 */
export async function fetchConsultantNameToOpenId(): Promise<
  Map<string, string>
> {
  const appToken = process.env.LARK_BITABLE_APP_TOKEN;
  const tableId = process.env.LARK_BITABLE_TABLE_ID;
  const nameField = process.env.LARK_BITABLE_NAME_FIELD || "姓名";
  const userField = process.env.LARK_BITABLE_USER_FIELD || "关联人员";

  if (!appToken || !tableId) {
    throw new Error(
      "缺少 LARK_BITABLE_APP_TOKEN / LARK_BITABLE_TABLE_ID 环境变量。需要把姓名对照表的链接信息填进 .env，见 README。"
    );
  }

  const token = await getTenantAccessToken();
  const nameToOpenId = new Map<string, string>();

  let pageToken: string | undefined;
  do {
    const url = new URL(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
    );
    url.searchParams.set("page_size", "100");
    url.searchParams.set("user_id_type", "open_id");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`读取姓名对照表失败：${data.msg}`);
    }

    const records: BitableRecord[] = data.data.items ?? [];
    for (const record of records) {
      const name = extractText(record.fields[nameField]);
      const openId = extractPersonOpenId(record.fields[userField]);
      if (name && openId) {
        nameToOpenId.set(name, openId);
      }
    }

    pageToken = data.data.has_more ? data.data.page_token : undefined;
  } while (pageToken);

  return nameToOpenId;
}

/** 把顾问姓名列表匹配成 open_id；匹配不到的标记 openId: null，交给前端提示人工确认 */
export function matchConsultants(
  consultantNames: string[],
  nameToOpenId: Map<string, string>
): ConsultantMatch[] {
  return consultantNames.map((consultantName) => ({
    consultantName,
    openId: nameToOpenId.get(consultantName) ?? null,
  }));
}
