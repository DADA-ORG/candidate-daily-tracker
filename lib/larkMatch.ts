import { getTenantAccessToken, getLarkApiBase } from "./larkAuth";
import type { ConsultantMatch } from "./types";

interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

let cachedAppToken: string | null = null;

/**
 * 姓名对照表如果是从知识库（Wiki）里打开的，链接形如：
 *   https://xxx.larksuite.com/wiki/{wiki_token}?table={table_id}&view={view_id}
 * 这种链接里 /wiki/ 后面的那段不是多维表格真正的 app_token，只是知识库节点 token，
 * 需要先用 wiki/v2/spaces/get_node 解析出真正的 obj_token 才能拿来调 bitable API。
 *
 * 如果对照表是直接从多维表格打开的（链接形如 https://xxx.larksuite.com/base/{app_token}），
 * 直接把 {app_token} 填进 LARK_BITABLE_APP_TOKEN 就不需要走这一步。
 */
async function resolveBitableAppToken(): Promise<string> {
  const directAppToken = process.env.LARK_BITABLE_APP_TOKEN;
  if (directAppToken) return directAppToken;

  const wikiToken = process.env.LARK_WIKI_TOKEN;
  if (!wikiToken) {
    throw new Error(
      "缺少 LARK_BITABLE_APP_TOKEN 或 LARK_WIKI_TOKEN 环境变量。需要把姓名对照表的链接信息填进 .env，见 README。"
    );
  }

  if (cachedAppToken) return cachedAppToken;

  const token = await getTenantAccessToken();
  const url = new URL(`${getLarkApiBase()}/open-apis/wiki/v2/spaces/get_node`);
  url.searchParams.set("token", wikiToken);
  url.searchParams.set("obj_type", "wiki");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(
      `解析知识库链接失败：${data.msg}（LARK_WIKI_TOKEN=${wikiToken}）。需要应用有该知识库节点的阅读权限，见 README。`
    );
  }

  const node = data.data?.node;
  if (node?.obj_type !== "bitable" || !node?.obj_token) {
    throw new Error(
      `LARK_WIKI_TOKEN 对应的知识库节点不是一个多维表格（实际类型：${node?.obj_type}），请确认链接是否正确。`
    );
  }

  cachedAppToken = node.obj_token as string;
  return cachedAppToken;
}

function extractText(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v !== "object" || v === null) return "";
        const obj = v as Record<string, unknown>;
        // 富文本字段常见结构：[{ text: "..." }, ...]
        if (typeof obj.text === "string") return obj.text;
        // 人员字段常见结构：[{ id, name, en_name }, ...]——如果姓名列和关联人员列
        // 其实是同一个"人员"字段，就从这里兜底拿姓名。
        if (typeof obj.name === "string") return obj.name;
        if (typeof obj.en_name === "string") return obj.en_name;
        return "";
      })
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
 * 读取姓名对照表（多维表格 Bitable），返回 顾问姓名 -> open_id 的映射。
 * 需要环境变量：LARK_BITABLE_APP_TOKEN 或 LARK_WIKI_TOKEN（二选一） + LARK_BITABLE_TABLE_ID，
 * 以及可选的 LARK_BITABLE_NAME_FIELD / LARK_BITABLE_USER_FIELD（默认"姓名"/"关联人员"）。
 */
export async function fetchConsultantNameToOpenId(): Promise<
  Map<string, string>
> {
  const tableId = process.env.LARK_BITABLE_TABLE_ID;
  const nameField = process.env.LARK_BITABLE_NAME_FIELD || "姓名";
  const userField = process.env.LARK_BITABLE_USER_FIELD || "关联人员";

  if (!tableId) {
    throw new Error(
      "缺少 LARK_BITABLE_TABLE_ID 环境变量。需要把姓名对照表的链接信息填进 .env，见 README。"
    );
  }

  const appToken = await resolveBitableAppToken();
  const token = await getTenantAccessToken();
  const nameToOpenId = new Map<string, string>();

  let pageToken: string | undefined;
  do {
    const url = new URL(
      `${getLarkApiBase()}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
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

/**
 * 读取"Admins"对照表（同一个 Base 下另一张表），返回允许登录这个工具的所有人的 open_id 集合。
 * 需要环境变量：LARK_ADMIN_TABLE_ID，以及可选的 LARK_ADMIN_PERSON_FIELD（默认 "Person"）。
 * 复用同一个 LARK_BITABLE_APP_TOKEN / LARK_WIKI_TOKEN（Admins 表和姓名对照表在同一个 Base 里）。
 */
export async function fetchAdminOpenIds(): Promise<Set<string>> {
  const tableId = process.env.LARK_ADMIN_TABLE_ID;
  const personField = process.env.LARK_ADMIN_PERSON_FIELD || "Person";

  if (!tableId) {
    throw new Error(
      "缺少 LARK_ADMIN_TABLE_ID 环境变量。需要把 Admins 表的 table id 填进 .env，见 README。"
    );
  }

  const appToken = await resolveBitableAppToken();
  const token = await getTenantAccessToken();
  const openIds = new Set<string>();

  let pageToken: string | undefined;
  do {
    const url = new URL(
      `${getLarkApiBase()}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
    );
    url.searchParams.set("page_size", "100");
    url.searchParams.set("user_id_type", "open_id");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`读取 Admins 表失败：${data.msg}`);
    }

    const records: BitableRecord[] = data.data.items ?? [];
    for (const record of records) {
      // Person 字段可能是单人也可能是多人，统一按数组处理，把每个人的 open_id 都加进白名单
      const value = record.fields[personField];
      if (Array.isArray(value)) {
        for (const person of value) {
          const openId = (person as { id?: string })?.id;
          if (openId) openIds.add(openId);
        }
      }
    }

    pageToken = data.data.has_more ? data.data.page_token : undefined;
  } while (pageToken);

  return openIds;
}

/**
 * 诊断用：只取表里第一条记录的原始字段，用来核对 LARK_BITABLE_NAME_FIELD /
 * LARK_BITABLE_USER_FIELD 有没有跟表格里真实的列名对上。不影响正式的匹配逻辑。
 */
export async function fetchSampleRecordFields(): Promise<Record<
  string,
  unknown
> | null> {
  const tableId = process.env.LARK_BITABLE_TABLE_ID;
  if (!tableId) return null;

  const appToken = await resolveBitableAppToken();
  const token = await getTenantAccessToken();

  const url = new URL(
    `${getLarkApiBase()}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
  );
  url.searchParams.set("page_size", "1");
  url.searchParams.set("user_id_type", "open_id");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`读取姓名对照表失败：${data.msg}`);
  }

  const records: BitableRecord[] = data.data.items ?? [];
  return records[0]?.fields ?? null;
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
