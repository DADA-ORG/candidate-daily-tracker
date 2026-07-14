import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLarkAuthorizeUrl } from "@/lib/larkOAuth";
import { verifySessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";
import HomeClient from "./HomeClient";

export const runtime = "nodejs";

/**
 * 首页是一个 Server Component 网关：先看有没有登录态 cookie，
 * 没有的话直接跳去飞书登录（走完 OAuth 回到 /api/auth-login 校验完再跳回这里）。
 * 真正的上传/预览/发送 UI 都在 HomeClient 里（客户端组件）。
 */
export default async function Page() {
  const cookieStore = await cookies();
  const session = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );

  if (!session) {
    // 去掉结尾多余的斜杠，防止 APP_BASE_URL 填成 "https://xxx.vercel.app/" 时拼出
    // "https://xxx.vercel.app//api/auth-login" 这种多一个斜杠、跟飞书后台白名单对不上的地址
    const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/auth-login`;
    redirect(getLarkAuthorizeUrl(redirectUri));
  }

  return <HomeClient userName={session.name} />;
}
