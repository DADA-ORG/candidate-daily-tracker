interface TenantTokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

let cache: TenantTokenCache | null = null;

/**
 * 飞书/Lark 开放平台的 API 域名。国际版 Lark Suite（larksuite.com 租户，比如这个项目对接的
 * dadaconsultants.sg.larksuite.com）要用 open.larksuite.com；国内飞书租户用 open.feishu.cn。
 * 通过 LARK_API_BASE_URL 环境变量覆盖，默认按国际版 Lark Suite 配置。
 */
export function getLarkApiBase(): string {
  return process.env.LARK_API_BASE_URL || "https://open.larksuite.com";
}

/**
 * 获取 tenant_access_token，内存缓存直到快过期（提前1分钟刷新）。
 * 需要环境变量 LARK_APP_ID / LARK_APP_SECRET（在开放平台创建自建应用后得到）。
 */
export async function getTenantAccessToken(): Promise<string> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "缺少 LARK_APP_ID / LARK_APP_SECRET 环境变量。需要先在开放平台创建自建应用并开通单聊消息发送权限，见 README。"
    );
  }

  if (cache && cache.expiresAt > Date.now() + 60_000) {
    return cache.token;
  }

  const res = await fetch(
    `${getLarkApiBase()}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取飞书 tenant_access_token 失败：${data.msg}`);
  }

  cache = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + data.expire * 1000,
  };
  return cache.token;
}
