import { createHmac, timingSafeEqual } from "crypto";

/** 登录态用的 cookie 名 + 有效期（7 天，过期后重新走一遍飞书登录） */
export const SESSION_COOKIE_NAME = "dada_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  openId: string;
  name: string;
  exp: number; // 过期时间，epoch ms
}

function getSecret(): string {
  const secret = process.env.LARK_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "缺少 LARK_SESSION_SECRET 环境变量。随便生成一个足够长的随机字符串填进去就行（用来给登录态签名，防止被伪造），见 README。"
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/** 把登录信息签名成一个可以放进 cookie 的字符串：base64(payload).签名 */
export function createSessionCookieValue(payload: SessionPayload): string {
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

/** 校验 cookie 值：签名对不上或者已过期都会返回 null（相当于没登录） */
export function verifySessionCookieValue(value: string | undefined | null): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  let expectedSig: string;
  try {
    expectedSig = sign(payloadB64);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    );
    if (!payload.openId || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
