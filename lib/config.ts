// 业务规则阈值——集中放这里，方便后续调整而不用去翻业务逻辑代码

export const RULES_CONFIG = {
  /** 规则2：简历发送多少天后开始提醒 */
  cvSentThresholdDays: 3,
  /** 规则3：面试结束多少天后开始提醒 */
  interviewThresholdDays: 1,
  /** 两张表分别对应的 Process 字段值 */
  processValues: {
    cvSent: "CV Sent",
    ccm: "CCM",
  },
} as const;
