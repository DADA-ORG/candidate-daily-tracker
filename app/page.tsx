"use client";

import { useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";

/** 品牌色板 —— 和 DADA logo 的蓝色呼应，页面里所有强调色都从这里取，保持统一 */
const BRAND = {
  primary: "#2563eb",
  primaryLight: "#eff6ff",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
};

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif';

/** 统一的间距刻度，卡片内外的 padding/margin 都从这里取，避免到处出现随手写的数字 */
const SPACE = { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 };

const buttonBaseStyle: CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 20px",
  borderRadius: 8,
  border: `1px solid ${BRAND.border}`,
  background: "white",
  color: BRAND.text,
  cursor: "pointer",
  transition: "opacity 0.15s, background 0.15s",
};

/**
 * 字号层级（从大到小）：
 * 1. 顾问姓名 / 板块标题（📋⏰🎤）—— 同一大小，都是 18px
 * 2. 客户名 / 候选人名（"标题2"）—— 15px
 * 3. 岗位名 / 详情文字（内容）—— 13px，浅灰色
 */
const TITLE_SIZE = 18;
const SUBTITLE_SIZE = 15;
const CONTENT_SIZE = 13;

/** 表格分组的"主标题"（客户名 / 候选人名）统一用这一套样式，避免中英文混排看起来轻重不一 */
const rowTitleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: SUBTITLE_SIZE,
  color: BRAND.text,
  lineHeight: 1.5,
};

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

/** 支持点击选择、也支持把 .xlsx 文件直接拖进来的上传框 */
function FileDropZone({
  label,
  file,
  onFileSelected,
}: {
  label: string;
  file: File | null;
  onFileSelected: (file: File | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  }

  return (
    <div style={{ flex: "1 1 260px", minWidth: 240 }}>
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 700,
          color: BRAND.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? BRAND.primary : "#ccc"}`,
          borderRadius: 8,
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? BRAND.primaryLight : "#fafafa",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          style={{ display: "none" }}
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <span>📄 {file.name}</span>
        ) : (
          <span style={{ color: "#888" }}>
            把 .xlsx 文件拖到这里，或点击选择文件
          </span>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<
  SendResult["status"],
  { bg: string; fg: string; label: (r: SendResult) => string }
> = {
  sent: { bg: "#dcfce7", fg: "#15803d", label: () => "已发送" },
  unmatched: {
    bg: "#fef3c7",
    fg: "#b45309",
    label: () => "未匹配到飞书用户",
  },
  failed: {
    bg: "#fee2e2",
    fg: "#b91c1c",
    label: (r) => `发送失败：${r.error ?? ""}`,
  },
};

function StatusBadge({ result }: { result: SendResult }) {
  const s = STATUS_STYLES[result.status];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {s.label(result)}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  color,
}: {
  icon: string;
  title: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: SPACE.xl,
        marginBottom: SPACE.md,
        paddingTop: SPACE.lg,
        borderTop: `1px solid ${BRAND.borderLight}`,
        fontSize: TITLE_SIZE,
        fontWeight: 700,
        color,
      }}
    >
      <span style={{ fontSize: TITLE_SIZE }}>{icon}</span>
      <span>{title}</span>
    </div>
  );
}

/** 把同一个客户的多个岗位合并成一组，避免客户名字重复出现好几行 */
function groupJobsByClient(
  jobs: FollowUpJob[]
): { clientName: string; jobs: string[] }[] {
  const order: string[] = [];
  const map = new Map<string, string[]>();
  for (const j of jobs) {
    if (!map.has(j.clientName)) {
      map.set(j.clientName, []);
      order.push(j.clientName);
    }
    map.get(j.clientName)!.push(j.job);
  }
  return order.map((clientName) => ({ clientName, jobs: map.get(clientName)! }));
}

function JobGroupRow({
  group,
}: {
  group: { clientName: string; jobs: string[] };
}) {
  return (
    <div style={{ padding: `${SPACE.sm + 2}px 0`, borderBottom: `1px solid ${BRAND.borderLight}` }}>
      <div style={{ ...rowTitleStyle, marginBottom: SPACE.xs + 2 }}>{group.clientName}</div>
      {group.jobs.map((job, i) => (
        <div
          key={i}
          style={{
            fontSize: CONTENT_SIZE,
            color: BRAND.textMuted,
            paddingLeft: 14,
            lineHeight: 1.8,
          }}
        >
          · {job}
        </div>
      ))}
    </div>
  );
}

function AlertRow({
  alert,
  badgeText,
  badgeColor,
}: {
  alert: CandidateAlert;
  badgeText: string;
  badgeColor: { bg: string; fg: string };
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: `${SPACE.sm + 2}px 0`,
        borderBottom: `1px solid ${BRAND.borderLight}`,
      }}
    >
      <div>
        <div style={rowTitleStyle}>{alert.candidate}</div>
        <div style={{ fontSize: CONTENT_SIZE, color: BRAND.textMuted, marginTop: SPACE.xs - 2 }}>
          {alert.clientName} · {alert.job}
        </div>
      </div>
      <span
        style={{
          background: badgeColor.bg,
          color: badgeColor.fg,
          padding: "3px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {badgeText}
      </span>
    </div>
  );
}

function DigestCard({
  digest,
  result,
}: {
  digest: Digest;
  result?: SendResult;
}) {
  const isEmpty =
    digest.followUpJobs.length === 0 &&
    digest.cvFeedbackAlerts.length === 0 &&
    digest.interviewFeedbackAlerts.length === 0;

  return (
    <div
      style={{
        border: `1px solid ${BRAND.border}`,
        borderRadius: 12,
        padding: `${SPACE.lg}px ${SPACE.xl}px`,
        marginBottom: SPACE.lg,
        background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: SPACE.md,
          borderBottom: `1px solid ${BRAND.borderLight}`,
        }}
      >
        <h3 style={{ margin: 0, fontSize: TITLE_SIZE, fontWeight: 700, color: BRAND.text }}>
          {digest.consultantName}
        </h3>
        {result && <StatusBadge result={result} />}
      </div>

      {digest.followUpJobs.length > 0 && (
        <>
          <SectionHeader icon="📋" title="今日跟进岗位" color={BRAND.text} />
          {groupJobsByClient(digest.followUpJobs).map((g, i) => (
            <JobGroupRow key={i} group={g} />
          ))}
        </>
      )}

      {digest.cvFeedbackAlerts.length > 0 && (
        <>
          <SectionHeader
            icon="⏰"
            title="简历待反馈（发送≥3天）"
            color="#b45309"
          />
          {digest.cvFeedbackAlerts.map((a, i) => (
            <AlertRow
              key={i}
              alert={a}
              badgeText={`已发送 ${a.daysElapsed} 天`}
              badgeColor={{ bg: "#fef3c7", fg: "#92400e" }}
            />
          ))}
        </>
      )}

      {digest.interviewFeedbackAlerts.length > 0 && (
        <>
          <SectionHeader
            icon="🎤"
            title="面试待反馈（面试≥1天）"
            color="#7c3aed"
          />
          {digest.interviewFeedbackAlerts.map((a, i) => (
            <AlertRow
              key={i}
              alert={a}
              badgeText={`已过 ${a.daysElapsed} 天`}
              badgeColor={{ bg: "#ede9fe", fg: "#6d28d9" }}
            />
          ))}
        </>
      )}

      {isEmpty && (
        <p style={{ color: "#9ca3af", marginTop: 16, marginBottom: 0 }}>
          今天没有需要跟进的事项。
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const [cvSentFile, setCvSentFile] = useState<File | null>(null);
  const [ccmFile, setCcmFile] = useState<File | null>(null);
  const [digests, setDigests] = useState<Digest[] | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runRequest(mode: "preview" | "send") {
    if (!cvSentFile && !ccmFile) {
      setError("请至少选择 CV Sent 表或 CCM 表其中一个文件。");
      return;
    }
    setLoading(true);
    setError(null);
    if (mode === "preview") setResults(null);

    try {
      const formData = new FormData();
      if (cvSentFile) formData.append("cvSent", cvSentFile);
      if (ccmFile) formData.append("ccm", ccmFile);
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
    <div style={{ background: "#f5f6f8", minHeight: "100vh" }}>
      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          fontFamily: FONT_STACK,
          padding: "40px 16px 60px",
          color: BRAND.text,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingBottom: SPACE.lg,
            marginBottom: SPACE.xl,
            borderBottom: `1px solid ${BRAND.border}`,
          }}
        >
          {/* 把 logo 文件放到 public/logo.png 就会自动显示在这里；找不到文件时自动隐藏，不会出现裂图标 */}
          <img
            src="/logo.png"
            alt="DADA"
            style={{
              height: 56,
              width: 56,
              borderRadius: 12,
              objectFit: "cover",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              flexShrink: 0,
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: BRAND.text,
              letterSpacing: -0.3,
            }}
          >
            DADA候选人每日追踪工具
          </h1>
        </header>

        <section
          style={{
            background: "white",
            border: `1px solid ${BRAND.border}`,
            borderRadius: 12,
            padding: `${SPACE.lg}px ${SPACE.xl}px`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ color: BRAND.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            上传当天导出的 CV Sent 表和 CCM 表，先预览各顾问将收到的内容，确认无误后再发送到飞书。
          </p>

          <div style={{ display: "flex", gap: SPACE.xl, margin: `${SPACE.xl}px 0 ${SPACE.lg}px`, flexWrap: "wrap" }}>
            <FileDropZone label="CV Sent 表" file={cvSentFile} onFileSelected={setCvSentFile} />
            <FileDropZone label="CCM 表" file={ccmFile} onFileSelected={setCcmFile} />
          </div>

          <div style={{ display: "flex", gap: SPACE.md }}>
            <button
              disabled={loading}
              onClick={() => runRequest("preview")}
              style={{ ...buttonBaseStyle, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "处理中..." : "预览"}
            </button>
            <button
              disabled={loading || !digests}
              onClick={() => runRequest("send")}
              style={{
                ...buttonBaseStyle,
                background: BRAND.primary,
                color: "white",
                borderColor: BRAND.primary,
                opacity: loading || !digests ? 0.5 : 1,
              }}
            >
              确认发送到飞书
            </button>
          </div>

          {error && (
            <p style={{ color: "#dc2626", fontSize: 14, marginTop: SPACE.md, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </section>

        {digests && (
          <section style={{ marginTop: SPACE.xl }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: BRAND.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: SPACE.lg,
              }}
            >
              预览（共 {digests.length} 位顾问）
            </h2>
            {digests.map((d) => (
              <DigestCard
                key={d.consultantName}
                digest={d}
                result={results?.find((r) => r.consultantName === d.consultantName)}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
