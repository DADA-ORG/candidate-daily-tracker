import { getLarkApiBase, getTenantAccessToken } from "./larkAuth";

/** 拼一个"跳到飞书扫码/账号登录"的地址，登录完飞书会带着 ?code=xxx 跳回 redirectUri */
export function getLarkAuthorizeUrl(redirectUri: string): string {
  const appId = process.env.LARK_APP_ID;
  if (!appId) {
    throw new Error("缺少 LARK_APP_ID 环境变量。");
  }
  const url = new URL(`${getLarkApiBase()}/open-apis/authen/v1/index`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export interface LarkUserInfo {
  openId: string;
  name: string;
  avatarUrl?: string;
}

/**
 * 用飞书登录跳转回来的 code 换用户身份。
 * 流程：先拿 tenant_access_token -> 用它把 code 换成 user_access_token -> 用 user_access_token 查用户信息。
 */
export async function exchangeCodeForUserInfo(code: string): Promise<LarkUserInfo> {
  const tenantToken = await getTenantAccessToken();

  const tokenRes = await fetch(`${getLarkApiBase()}/open-apis/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tenantToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.code !== 0) {
    throw new Error(`飞书登录换取用户 token 失败：${tokenData.msg}`);
  }
  const userAccessToken = tokenData.data?.access_token;
  if (!userAccessToken) {
    throw new Error("飞书登录返回结果里没有 access_token。");
  }

  const userRes = await fetch(`${getLarkApiBase()}/open-apis/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  const userData = await userRes.json();
  if (userData.code !== 0) {
    throw new Error(`获取飞书用户信息失败：${userData.msg}`);
  }

  return {
    openId: userData.data.open_id,
    name: userData.data.name,
    avatarUrl: userData.data.avatar_url,
  };
}
