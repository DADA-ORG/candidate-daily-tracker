"use client";

import { useState } from "react";

interface FollowUpJob {
  clientName: string;
  job: string;
}

interface CandidateAlert {
  candidate: string;
  clientName: string;
  job: string;
  daysElapsed: number;
  referenceDate: string;
}

interface Digest {
  consultantName: string;
  followUpJobs: FollowUpJob[];
  cvFeedbackAlerts: CandidateAlert[];
  interviewFeedbackAlerts: CandidateAlert[];
}

interface SendResult {
  consultantName: string;
  status: "sent" | "unmatched" | "failed";
  error?: string;
}

export default function Home() {
  const [cvSentFile, setCvSentFile] = useState<File | null>(null);
  const [ccmFile, setCcmFile] = useState<File | null>(null);
  const [digests, setDigests] = useState<Digest[] | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runRequest(mode: "preview" | "send") {
    if (!cvSentFile || !ccmFile) {
      setError("请先选择 CV Sent 表和 CCM 表两个文件。");
      return;
    }
    setLoading(true);
    setError(null);
    if (mode === "preview") setResults(null);

    try {
      const formData = new FormData();
      formData.append("cvSent", cvSentFile);
      formData.append("ccm", ccmFile);
      formData.append("mode", mode);

      const res = await fetch("/api/process", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "处理失败");

      setDigests(data.digests);
      if (mode === "send") setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px 60px" }}>
      <h1>候选人每日追踪工具</h1>
      <p style={{ color: "#666" }}>
        上传当天导出的 CV Sent 表和 CCM 表，先预览各顾问将收到的内容，确认无误后再发送到飞书。
      </p>

      <div style={{ display: "flex", gap: 24, margin: "24px 0", flexWrap: "wrap" }}>
        <label>
          CV Sent 表：{" "}
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setCvSentFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          CCM 表：{" "}
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setCcmFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button disabled={loading} onClick={() => runRequest("preview")}>
          {loading ? "处理中..." : "预览"}
        </button>
        <button
          disabled={loading || !digests}
          onClick={() => runRequest("send")}
          style={{ background: "#2563eb", color: "white", borderColor: "#2563eb" }}
        >
          确认发送到飞书
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {digests && (
        <section style={{ marginTop: 32 }}>
          <h2>预览（共 {digests.length} 位顾问）</h2>
          {digests.map((d) => {
            const result = results?.find((r) => r.consultantName === d.consultantName);
            return (
              <div
                key={d.consultantName}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16, background: "white" }}
              >
                <h3 style={{ marginTop: 0 }}>
                  {d.consultantName}
                  {result && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        fontWeight: "normal",
                        color:
                          result.status === "sent"
                            ? "green"
                            : result.status === "unmatched"
                            ? "#b45309"
                            : "crimson",
                      }}
                    >
                      [
                      {result.status === "sent"
                        ? "已发送"
                        : result.status === "unmatched"
                        ? "未匹配到飞书用户，需要人工确认对照表"
                        : `发送失败：${result.error}`}
                      ]
                    </span>
                  )}
                </h3>

                {d.followUpJobs.length > 0 && (
                  <div>
                    <b>📋 今日跟进岗位</b>
                    <ul>
                      {d.followUpJobs.map((j, i) => (
                        <li key={i}>
                          {j.clientName} - {j.job}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {d.cvFeedbackAlerts.length > 0 && (
                  <div>
                    <b>⏰ 简历待反馈（发送≥3天）</b>
                    <ul>
                      {d.cvFeedbackAlerts.map((a, i) => (
                        <li key={i}>
                          {a.candidate} - {a.clientName} - {a.job} - 已发送 {a.daysElapsed} 天
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {d.interviewFeedbackAlerts.length > 0 && (
                  <div>
                    <b>🎤 面试待反馈（面试≥1天）</b>
                    <ul>
                      {d.interviewFeedbackAlerts.map((a, i) => (
                        <li key={i}>
                          {a.candidate} - {a.clientName} - {a.job} - 已过 {a.daysElapsed} 天
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {d.followUpJobs.length === 0 &&
                  d.cvFeedbackAlerts.length === 0 &&
                  d.interviewFeedbackAlerts.length === 0 && (
                    <p style={{ color: "#999" }}>今天没有需要跟进的事项。</p>
                  )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
