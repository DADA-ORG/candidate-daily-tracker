import type { ConsultantDigest } from "./types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

/** 按设计方案里的卡片格式，把一位顾问的待办清单渲染成飞书 interactive 卡片 JSON */
export function buildCardForConsultant(
  digest: ConsultantDigest,
  todayLabel: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = [];

  if (digest.followUpJobs.length > 0) {
    const lines = digest.followUpJobs
      .map((j) => `- ${j.clientName} - ${j.job}`)
      .join("\n");
    elements.push({ tag: "markdown", content: `**📋 今日跟进岗位**\n${lines}` });
    elements.push({ tag: "hr" });
  }

  if (digest.cvFeedbackAlerts.length > 0) {
    const lines = digest.cvFeedbackAlerts
      .map(
        (a) =>
          `- ${a.candidate} - ${a.clientName} - ${a.job} - 已发送 ${a.daysElapsed} 天（${formatDate(
            a.referenceDate
          )}）`
      )
      .join("\n");
    elements.push({
      tag: "markdown",
      content: `**⏰ 简历待反馈（发送≥3天）**\n${lines}`,
    });
    elements.push({ tag: "hr" });
  }

  if (digest.interviewFeedbackAlerts.length > 0) {
    const lines = digest.interviewFeedbackAlerts
      .map(
        (a) =>
          `- ${a.candidate} - ${a.clientName} - ${a.job} - 面试日期 ${formatDate(
            a.referenceDate
          )}，已过 ${a.daysElapsed} 天`
      )
      .join("\n");
    elements.push({
      tag: "markdown",
      content: `**🎤 面试待反馈（面试≥1天）**\n${lines}`,
    });
  }

  if (elements.length > 0 && elements[elements.length - 1].tag === "hr") {
    elements.pop();
  }

  if (elements.length === 0) {
    elements.push({ tag: "markdown", content: "今天没有需要跟进的事项 🎉" });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content: `${digest.consultantName} 今日候选人跟进清单 — ${todayLabel}`,
      },
      template: "blue",
    },
    elements,
  };
}
