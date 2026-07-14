import { getTenantAccessToken } from "./larkAuth";

/** 把卡片以单聊消息形式发送给指定 open_id 的飞书用户 */
export async function sendCardToOpenId(
  openId: string,
  card: unknown
): Promise<void> {
  const token = await getTenantAccessToken();
  const res = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`发送飞书消息失败（open_id=${openId}）：${data.msg}`);
  }
}
