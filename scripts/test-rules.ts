import assert from "node:assert";
import { computeConsultantDigests } from "../lib/rules";
import { SAMPLE_CV_SENT_ROWS, SAMPLE_CCM_ROWS, TODAY } from "./fixtures/sample-data";

const digests = computeConsultantDigests(SAMPLE_CV_SENT_ROWS, SAMPLE_CCM_ROWS, TODAY);
console.log(JSON.stringify(digests, null, 2));

const consultant1 = digests.find((d) => d.consultantName === "顾问一");
const consultant2 = digests.find((d) => d.consultantName === "顾问二");

assert.ok(consultant1, "应该找到 顾问一 的待办清单");
assert.ok(consultant2, "应该找到 顾问二 的待办清单");

// 规则1：今日跟进岗位——去重后应该是 3 个（客户A-岗位1、客户B-岗位2、客户D-岗位4）
// 客户B-岗位2 在 CV Sent 和 CCM 里各出现一次，必须只算一次
assert.strictEqual(
  consultant1!.followUpJobs.length,
  3,
  `规则1去重失败，期望3条，实际${consultant1!.followUpJobs.length}条`
);

// 规则2：简历发送 >= 3 天。顾问一只有 候选人B（4天）触发，候选人A（0天）不触发
assert.strictEqual(consultant1!.cvFeedbackAlerts.length, 1);
assert.strictEqual(consultant1!.cvFeedbackAlerts[0].candidate, "候选人B");
assert.strictEqual(consultant1!.cvFeedbackAlerts[0].daysElapsed, 4);

// 顾问二：候选人C 3天，边界值也应该触发
assert.strictEqual(consultant2!.cvFeedbackAlerts.length, 1);
assert.strictEqual(consultant2!.cvFeedbackAlerts[0].candidate, "候选人C");
assert.strictEqual(consultant2!.cvFeedbackAlerts[0].daysElapsed, 3);

// 规则3：面试 >= 1 天。顾问一有 候选人D（1天，边界值）和 候选人F（2天），共2条
assert.strictEqual(consultant1!.interviewFeedbackAlerts.length, 2);

// 顾问二：候选人E 是 0天，不应该触发，所以应该是 0条
assert.strictEqual(consultant2!.interviewFeedbackAlerts.length, 0);

console.log("\n✅ 所有规则断言通过");
