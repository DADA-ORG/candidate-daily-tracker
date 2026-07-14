// 只读连通性测试：验证 App ID/Secret、API 域名、姓名对照表权限是否配置正确。
// 不会发送任何飞书/Lark消息。需要在有真实公网访问的机器上运行（本地电脑或 Vercel），
// 不能在网络受限的沙盒环境里跑。
//
// 用法：
//   cp .env.example .env.local   # 然后把 LARK_APP_ID / LARK_APP_SECRET 填进去
//   npm run test:lark

import { config } from "dotenv";
config({ path: ".env.local" });

import { getTenantAccessToken } from "../lib/larkAuth";
import {
  fetchConsultantNameToOpenId,
  fetchSampleRecordFields,
  fetchAdminOpenIds,
} from "../lib/larkMatch";

async function main() {
  console.log("1) 获取 tenant_access_token ...");
  const token = await getTenantAccessToken();
  console.log("   ✅ 成功，token 前缀：", token.slice(0, 12) + "...");

  console.log("2) 读取姓名对照表 ...");
  const map = await fetchConsultantNameToOpenId();
  console.log(`   ✅ 成功，匹配到 ${map.size} 条 姓名 -> open_id 记录`);

  const sample = Array.from(map.entries()).slice(0, 5);
  for (const [name, openId] of sample) {
    console.log(`   - ${name} -> ${openId.slice(0, 6)}...`);
  }

  if (process.env.LARK_ADMIN_TABLE_ID) {
    console.log("\n3) 读取 Admins 白名单表 ...");
    try {
      const admins = await fetchAdminOpenIds();
      console.log(`   ✅ 成功，白名单里有 ${admins.size} 个 open_id`);
      if (admins.size === 0) {
        console.log(
          "   ⚠️  读到了表，但一个 open_id 都没取到。检查 LARK_ADMIN_PERSON_FIELD 是否和表格里的列名完全一致（默认 Person）。"
        );
      }
    } catch (err) {
      console.log(
        "   ❌ 读取 Admins 表失败：",
        err instanceof Error ? err.message : String(err)
      );
    }
  } else {
    console.log(
      "\n3) 跳过 Admins 白名单表检查（没配置 LARK_ADMIN_TABLE_ID，登录鉴权功能还用不了）"
    );
  }

  if (map.size === 0) {
    console.log(
      "\n⚠️  读到了表，但一条 姓名->open_id 都没匹配上。检查 LARK_BITABLE_NAME_FIELD / LARK_BITABLE_USER_FIELD 是否和表格里的列名完全一致。"
    );
    console.log("\n4) 打印第一条记录的真实字段名和内容，对照一下 ...");
    const sampleFields = await fetchSampleRecordFields();
    if (sampleFields) {
      console.log("   表格里实际的列名有：", Object.keys(sampleFields));
      console.log("   完整内容：");
      console.log(JSON.stringify(sampleFields, null, 2));
      console.log(
        `\n   当前配置的 LARK_BITABLE_NAME_FIELD=${
          process.env.LARK_BITABLE_NAME_FIELD || "姓名"
        }，LARK_BITABLE_USER_FIELD=${
          process.env.LARK_BITABLE_USER_FIELD || "关联人员"
        }`
      );
      console.log(
        "   把上面两个环境变量改成和实际列名完全一致（包括中英文、空格），再跑一次 npm run test:lark"
      );
    } else {
      console.log("   表格是空的，一条记录都没有。");
    }
  } else {
    console.log("\n没有发送任何消息，这一步只验证凭证和读取权限。");
  }
}

main().catch((err) => {
  console.error("\n❌ 出错：", err.message);
  process.exit(1);
});
