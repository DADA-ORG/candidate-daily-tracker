# 候选人每日追踪工具

把 ATS 导出的候选人流程表转成每位顾问的每日待办清单，通过飞书私信卡片推送。设计背景见 `docs/候选人每日追踪工具_设计方案.md`。

## 使用流程

1. 打开网页，上传当天的两张表：`CV Sent` 阶段导出表 + `CCM` 阶段导出表
2. 点"预览"，逐个顾问检查将要发送的内容
3. 确认无误后点"确认发送到飞书"

不做定时自动化，也不做去重记录——同一提醒会一直发到状态变化为止，这是设计上的选择（宁可重复也不遗漏）。

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

## 环境变量（发送功能需要，预览不需要）

复制 `.env.example` 为 `.env.local` 并填写：

| 变量 | 说明 |
|---|---|
| `LARK_APP_ID` / `LARK_APP_SECRET` | 飞书自建应用凭证 |
| `LARK_BITABLE_APP_TOKEN` / `LARK_BITABLE_TABLE_ID` | 姓名对照表（Bitable）的定位信息，从表格链接里截取 |
| `LARK_BITABLE_NAME_FIELD` / `LARK_BITABLE_USER_FIELD` | 对照表里"姓名"列和"关联人员"列的字段名 |

### 创建飞书自建应用（如果还没有）

1. 打开 [飞书开放平台](https://open.feishu.cn) → 创建企业自建应用
2. 「权限管理」里开通 `im:message`（发送单聊、群组消息）
3. 「应用发布」把应用可见范围设置为包含所有顾问（或者整个组织）
4. 「凭证与基础信息」里拿到 App ID / App Secret

### 姓名对照表 App Token / Table ID

打开对照表，链接形如：
```
https://xxx.feishu.cn/base/{APP_TOKEN}?table={TABLE_ID}
```
把 `{APP_TOKEN}` 和 `{TABLE_ID}` 分别填进对应环境变量。

## 推送到 GitHub（DADA Org）

```bash
cd candidate-daily-tracker
git remote add origin git@github.com:DADA-Org/candidate-daily-tracker.git
git push -u origin main
```
（仓库名按你在 GitHub 上实际创建的名字改；这是一个 public 仓库，代码里不含任何真实候选人/客户数据，`.gitignore` 已经挡掉了 `.xlsx` 文件和临时验证脚本。）

## 部署到 Vercel

1. Vercel 后台 → Add New Project → Import 刚才推送的 GitHub 仓库
2. Framework 会自动识别为 Next.js，不需要改构建命令
3. 在 Project Settings → Environment Variables 里把上面那几个 `LARK_*` 变量填上
4. Deploy

之后每次 push 到 main 分支，Vercel 会自动重新部署。

## 目录结构

```
app/
  page.tsx              上传+预览+发送 的页面
  api/process/route.ts  处理请求：解析表格 -> 跑规则 -> (可选)匹配飞书用户并发送
lib/
  types.ts               数据类型
  config.ts               规则阈值配置
  excelParser.ts          解析 Excel 为标准化行
  rules.ts                三条业务规则
  larkAuth.ts             获取飞书 tenant_access_token
  larkMatch.ts             读取姓名对照表 Bitable，匹配 open_id
  larkCard.ts             生成飞书消息卡片 JSON
  larkSend.ts             调用飞书 API 发送卡片
scripts/
  test-rules.ts           用合成数据验证规则逻辑
  fixtures/sample-data.ts 合成测试数据（不含真实信息）
docs/
  候选人每日追踪工具_设计方案.md
```

## 已知待办

- 飞书自建应用还未创建（发送功能会报错提示缺少环境变量，预览功能不受影响）
- 姓名对照表的 App Token / Table ID 还未提供
