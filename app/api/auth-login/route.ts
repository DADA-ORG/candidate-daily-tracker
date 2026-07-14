import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForUserInfo } from "@/lib/larkOAuth";
import { fetchAdminOpenIds } from "@/lib/larkMatch";
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

export const runtime = "nodejs";

/** 简单包一层错误/无权限页面，跟主页配色保持一致，不用额外建页面文件 */
function htmlResponse(status: number, title: string, message: string) {
  return new NextResponse(
    `<!doctype html>
<html lang="zh"><head><meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: #f5f6f8; color: #111827; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px 40px; max-width: 420px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; }
</style>
</head><body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/** 飞书登录跳转回来的地址：/api/auth-login?code=xxx */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return htmlResponse(400, "登录失败", "飞书没有返回登录code，请重新访问首页再登录一次。");
  }

  try {
    const user = await exchangeCodeForUserInfo(code);
    const adminOpenIds = await fetchAdminOpenIds();

    if (!adminOpenIds.has(user.openId)) {
      return htmlResponse(
        403,
        "暂无权限访问",
        `你好 ${user.name}，你的飞书账号还没有被加进 Admins 名单。请联系管理员把你加进飞书多维表格里的 Admins 表后再试。`
      );
    }

    const cookieValue = createSessionCookieValue({
      openId: user.openId,
      name: user.name,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    });

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    return htmlResponse(
      500,
      "登录出错",
      err instanceof Error ? err.message : String(err)
    );
  }
}
