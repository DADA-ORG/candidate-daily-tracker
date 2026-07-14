// 与设计方案（候选人每日追踪工具_设计方案.md）对应的数据类型定义

/** Excel 原始行（两张表共用同一套表头） */
export interface RawRow {
  Candidate: string;
  "Client Name": string;
  Job: string;
  User: string; // 负责顾问，匹配飞书的关键字段
  "Last Update": string | null;
  Process: string; // "CV Sent" | "CCM"
  "Client Interview Rounds": string | null;
  "Client Interview Interview Date": string | null;
  "ClientInterview Round": number | null;
  Company: string | null;
  "Candidate Status": string | null;
  "Candidate Tags": string | null;
  "Date Added": string | null;
}

/** 规则1：今日跟进岗位（去重后的客户+岗位组合） */
export interface FollowUpJob {
  clientName: string;
  job: string;
}

/** 规则2/3 命中的候选人待办项 */
export interface CandidateAlert {
  candidate: string;
  clientName: string;
  job: string;
  /** 距今天数，向下取整 */
  daysElapsed: number;
  /** 触发规则用到的原始日期（简历发送日期 或 面试日期） */
  referenceDate: string;
}

/** 单个顾问当天的完整待办清单 */
export interface ConsultantDigest {
  consultantName: string; // 对应 Excel 里的 User 字段
  followUpJobs: FollowUpJob[];
  cvFeedbackAlerts: CandidateAlert[]; // 规则2
  interviewFeedbackAlerts: CandidateAlert[]; // 规则3
}

/** 飞书姓名 -> open_id 匹配结果 */
export interface ConsultantMatch {
  consultantName: string;
  openId: string | null; // null 表示对照表里没找到，需要人工确认
}
