# 候选人每日追踪工具

把 ATS 导出的候选人流程表转成每位顾问的每日待办清单，通过飞书私信卡片推送。设计背景见 `docs/候选人每日追踪工具_设计方案.md`。

## 使用流程

1. 打开网页，第一次访问会跳到飞书登录（只有 Admins 白名单表里的人能登进来，见下方"登录鉴权"）
2. 上传当天的两张表：`CV Sent` 阶段导出表 + `CCM` 阶段导出表
3. 点"预览"，逐个顾问检查将要发送的内容
4. 确认无误后点"确认发送到飞书"

不做定时自动化，也不做去重记录——同一提醒会一直发到状态变化为止，这是设计上的选择（宁可重复也不遗漏）。

## 登录鉴权

网页本身现在需要飞书登录才能访问，而且只放行在 Admins 表里的人。流程：

1. 访问首页 → 没有登录态 cookie → 跳转到飞书登录页
2. 登录完飞书会带着 `?code=` 跳回 `/api/auth-login`
3. 后端用这个 code 换出用户的 `open_id`，去 Admins 表查这个 open_id 在不在名单里
   - 在名单里：签发一个 7 天有效的登录态 cookie，跳回首页
   - 不在名单里：显示"暂无权限访问"，提示联系管理员把人加进 Admins 表
4. 之后 7 天内访问都不用重新登录；`/api/process` 接口本身也会校验这个 cookie，绕开页面直接调接口一样会被挡

要管理"谁能用这个工具"，直接去改 Admins 这张飞书表（加人 / 删人），不用改代码、不用重新部署。

## 三条规则（详见设计方案）

- **今日跟进岗位**：CV Sent + CCM 表中该顾问名下的 (客户, 岗位)，去重
- **简历待反馈**：CV Sent 表，`今天 − Date Added ≥ 3 天`
- **面试待反馈**：CCM 表，`今天 − Client Interview Interview Date ≥ 1 天`

阈值在 `lib/config.ts` 里改。

## 本地开发

```bash
npm install
npm run dev       # http://localhost:3000
npm run test:rules  # 用合成数据跑一遍规则引擎的断言
```

### 验证飞书/Lark 凭证是否配置对了

```bash
cp .env.example .env.local   # 把 LARK_APP_ID / LARK_APP_SECRET 填进 .env.local
npm run test:lark
```
这个脚本只读取 tenant_access_token、姓名对照表、Admins 白名单表，**不会发送任何消息**，用来确认 App ID/Secret、域名、表格权限有没有配对。跑成功会打印匹配到几条"姓名 -> open_id"记录，以及 Admins 表里有几个 open_id。

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

| 变量 | 说明 |
|---|---|
| `LARK_APP_ID` / `LARK_APP_SECRET` | 自建应用凭证（登录、读表、发消息都要用） |
| `LARK_API_BASE_URL` | API 域名，默认 `https://open.larksuite.com`（国际版 Lark Suite，对应 dadaconsultants.sg.larksuite.com 这个租户）。如果换成国内飞书租户要改成 `https://open.feishu.cn` |
| `LARK_BITABLE_APP_TOKEN` 或 `LARK_WIKI_TOKEN` | 姓名对照表的定位信息，二选一——见下方说明 |
| `LARK_BITABLE_TABLE_ID` | 姓名对照表 Table ID，链接里 `table=` 后面那段 |
| `LARK_BITABLE_NAME_FIELD` / `LARK_BITABLE_USER_FIELD` | 对照表里用来匹配姓名的纯文本列、和用来取 open_id 的人员列。这张表里实际是 `GULU Account Name`（纯文本，和 Excel User 列写法一致）和 `Name`（人员字段） |
| `LARK_SESSION_SECRET` | 随便生成一段随机字符串，给登录态 cookie 签名用，跟飞书无关，自己定 |
| `LARK_ADMIN_TABLE_ID` | Admins 白名单表的 Table ID（和姓名对照表同一个 Base） |
| `LARK_ADMIN_PERSON_FIELD` | Admins 表里"人员"字段的列名，默认 `Person` |
| `APP_BASE_URL` | 这个工具部署后的完整地址（本地是 `http://localhost:3000`，部署到 Vercel 后要改成真实域名），飞书登录跳转要用 |

现在这张对照表是直接从多维表格打开的链接：
```
https://dadaconsultants.sg.larksuite.com/base/TyJYbQNpha75WCsQMIJlkbL5grf?table=tblsCuaKpDO72toQ&view=vewtnPhPDN
```
`/base/` 后面那段（`TyJYbQNpha75WCsQMIJlkbL5grf`）就是 app_token，`table=` 后面那段（`tblsCuaKpDO72toQ`）是 table_id，两个都已经预填在 `.env.example` 里了，不用再解析知识库链接。

（`LARK_WIKI_TOKEN` 这个变量还留着，如果以后对照表换成从知识库 Wiki 页面打开——链接形如 `.../wiki/{wiki_token}?table=...`——把 app_token 换成填这个即可，代码会自动解析，见 `lib/larkMatch.ts`。）

### 创建自建应用（如果还没有）

1. 打开 [Lark 开放平台](https://open.larksuite.com)（这个租户是国际版 Lark Suite，不是 open.feishu.cn）→ 创建企业自建应用
2. 「应用功能」里开启**机器人**能力（不开启的话，权限加了也不生效）
3. 「权限管理」里添加以下权限（每组任选一个即可，不用两个都加）：
   - 发送消息：`im:message`（获取与发送单聊、群组消息）或 `im:message:send_as_bot`（以应用的身份发消息）
   - 读取姓名对照表 / Admins 白名单表：`bitable:app:readonly`（查看、评论和导出多维表格，只读够用）或 `bitable:app`（查看、评论、编辑和管理多维表格）
   - 登录鉴权：默认的登录能力就够用（`authen/v1/*` 接口不需要额外加 scope）；如果调用 `user_info` 时报权限不足，补加 `contact:user.base:readonly`
   - （用不到了：`wiki:wiki:readonly` 只有对照表改回从知识库页面打开时才需要加）
4. 「安全设置」里把重定向 URL 加上：本地开发是 `http://localhost:3000/api/auth-login`，部署到 Vercel 后额外加一条 `https://你的域名/api/auth-login`——飞书登录跳转严格校验这个地址，没加会直接报错
5. 「应用发布」创建版本，把**可用范围**设置为包含所有顾问（最简单是设成全员可见），然后发布——不发布版本，权限和可用范围都不会生效
6. 「凭证与基础信息」里拿到 App ID / App Secret
7. 除了 API 权限，应用还需要对姓名对照表、Admins 表这两张表本身有实际访问权限：如果表开启了"高级权限"或分享范围受限，要在表格的分享设置里把这个应用加进去。不加的话即使权限开了也会报"无访问权限"

## 推送到 GitHub（DADA Org）

```bash
cd candidate-daily-tracker
git remote add origin https://github.com/DADA-Org/candidate-daily-tracker.git
git push -u origin master
```
（远程地址、分支名按你在 GitHub 上实际创建的改；本地当前分支叫 `master`，不改也没关系。这是一个 public 仓库，代码里不含任何真实候选人/客户数据，`.gitignore` 已经挡掉了 `.xlsx` 文件和临时验证脚本。）

## 部署到 Vercel

1. Vercel 后台 → Add New Project → Import 刚才推送的 GitHub 仓库
2. Framework 会自动识别为 Next.js，不需要改构建命令
3. 在 Project Settings → Environment Variables 里把上面那几个环境变量都填上，**包括 `APP_BASE_URL`**——填 Vercel 分配的那个 `https://xxx.vercel.app` 域名（部署一次后才能拿到，拿到了再回来补上并重新部署一次）
4. Deploy
5. 部署完把 `https://xxx.vercel.app/api/auth-login` 加到飞书开放平台「安全设置」的重定向 URL 里（见上面"创建自建应用"第 4 步），不加飞书登录会报错

之后每次 push 到这个分支，Vercel 会自动重新部署。

## 目录结构

```
app/
  page.tsx                 Server Component 网关：查登录态，没登录就跳去飞书登录
  HomeClient.tsx           真正的上传+预览+发送 UI（客户端组件）
  api/process/route.ts     处理请求：校验登录 -> 解析表格 -> 跑规则 -> (可选)匹配飞书用户并发送
  api/auth-login/route.ts  飞书登录跳转回来的回调：换身份、查 Admins 白名单、签发登录态 cookie
  api/logout/route.ts      清掉登录态 cookie
lib/
  types.ts               数据类型
  config.ts               规则阈值配置
  excelParser.ts          解析 Excel 为标准化行
  rules.ts                三条业务规则
  larkAuth.ts             获取飞书 tenant_access_token
  larkOAuth.ts             飞书登录：拼登录跳转地址、用 code 换用户身份
  larkMatch.ts             读取姓名对照表 / Admins 白名单表这两张 Bitable
  larkCard.ts             生成飞书消息卡片 JSON
  larkSend.ts             调用飞书 API 发送卡片
  session.ts               登录态 cookie 的签名 / 校验
scripts/
  test-rules.ts           用合成数据验证规则逻辑
  fixtures/sample-data.ts 合成测试数据（不含真实信息）
docs/
  候选人每日追踪工具_设计方案.md
```

## 已知待办

- 首次部署到 Vercel 后，记得回填 `APP_BASE_URL` 为实际域名、并把 `.../api/auth-login` 加进飞书「安全设置」重定向 URL，否则登录会报错（见"部署到 Vercel"）
- 目前只验证过登录换身份 + Admins 表查询这两步的代码逻辑（typecheck 通过），还没有拿真实浏览器走一遍完整登录流程，建议部署后先自己登录测试一次
- "确认发送到飞书"这个真正发消息的按钮，到目前为止也还没有实测跑过（`test:lark` 是只读检查，不发消息），建议先对自己小范围测试一次再全量使用
