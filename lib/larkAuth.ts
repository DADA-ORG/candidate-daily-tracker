interface TenantTokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

let cache: TenantTokenCache | null = null;

/**
 * 获取飞书 tenant_access_token，内存缓存直到快过期（提前1分钟刷新）。
 * 需要环境变量 LARK_APP_ID / LARK_APP_SECRET（在飞书开放平台创建自建应用后得到）。
 */
export async function getTenantAccessToken(): Promise<string> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "缺少 LARK_APP_ID / LARK_APP_SECRET 环境变量。需要先在飞书开放平台创建自建应用并开通单聊消息发送权限，见 README。"
    );
  }

  if (cache && cache.expiresAt > Date.now() + 60_000) {
    return cache.token;
  }

  const res = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
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
