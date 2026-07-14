import type { RawRow } from "../../lib/types";

// 纯合成的测试数据（不含任何真实候选人/客户信息），仅用于验证规则逻辑。
// "今天" 固定为 2026-07-14，方便断言天数计算。

function row(partial: Partial<RawRow> & Pick<RawRow, "Candidate" | "Client Name" | "Job" | "User" | "Process">): RawRow {
  return {
    "Last Update": null,
    "Client Interview Rounds": null,
    "Client Interview Interview Date": null,
    "ClientInterview Round": null,
    Company: null,
    "Candidate Status": null,
    "Candidate Tags": null,
    "Date Added": null,
    ...partial,
  };
}

export const SAMPLE_CV_SENT_ROWS: RawRow[] = [
  row({
    Candidate: "候选人A",
    "Client Name": "客户A",
    Job: "客户A - 岗位1",
    User: "顾问一",
    Process: "CV Sent",
    "Date Added": "2026-07-14T09:00:00.000Z", // 0天，不应触发
  }),
  row({
    Candidate: "候选人B",
    "Client Name": "客户B",
    Job: "客户B - 岗位2",
    User: "顾问一",
    Process: "CV Sent",
    "Date Added": "2026-07-10T09:00:00.000Z", // 4天，应触发
  }),
  row({
    Candidate: "候选人C",
    "Client Name": "客户C",
    Job: "客户C - 岗位3",
    User: "顾问二",
    Process: "CV Sent",
    "Date Added": "2026-07-11T09:00:00.000Z", // 3天，边界值，应触发
  }),
];

export const SAMPLE_CCM_ROWS: RawRow[] = [
  row({
    Candidate: "候选人D",
    "Client Name": "客户D",
    Job: "客户D - 岗位4",
    User: "顾问一",
    Process: "CCM",
    "Client Interview Interview Date": "2026-07-13T06:00:00.000Z", // 1天，边界值，应触发
  }),
  row({
    Candidate: "候选人E",
    "Client Name": "客户E",
    Job: "客户E - 岗位5",
    User: "顾问二",
    Process: "CCM",
    "Client Interview Interview Date": "2026-07-14T06:00:00.000Z", // 0天，不应触发
  }),
  row({
    Candidate: "候选人F",
    "Client Name": "客户B",
    Job: "客户B - 岗位2", // 故意和 CV Sent 里顾问一的岗位重复，用于验证规则1去重
    User: "顾问一",
    Process: "CCM",
    "Client Interview Interview Date": "2026-07-12T06:00:00.000Z", // 2天，应触发
  }),
];

export const TODAY = new Date("2026-07-14T12:00:00.000Z");
