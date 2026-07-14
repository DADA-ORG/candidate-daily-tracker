import { NextRequest, NextResponse } from "next/server";
import { parseExcelToRawRows } from "@/lib/excelParser";
import { computeConsultantDigests } from "@/lib/rules";
import {
  fetchConsultantNameToOpenId,
  matchConsultants,
} from "@/lib/larkMatch";
import { buildCardForConsultant } from "@/lib/larkCard";
import { sendCardToOpenId } from "@/lib/larkSend";

export const runtime = "nodejs";

function todayLabel(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const cvSentFile = formData.get("cvSent");
    const ccmFile = formData.get("ccm");
    const mode = (formData.get("mode") as string) || "preview"; // "preview" | "send"

    const hasCvSent = cvSentFile instanceof File;
    const hasCcm = ccmFile instanceof File;

    if (!hasCvSent && !hasCcm) {
      return NextResponse.json(
        { error: "请至少上传 CV Sent 表或 CCM 表其中一个文件。" },
        { status: 400 }
      );
    }

    const cvSentRows = hasCvSent
      ? parseExcelToRawRows(Buffer.from(await cvSentFile.arrayBuffer()))
      : [];
    const ccmRows = hasCcm
      ? parseExcelToRawRows(Buffer.from(await ccmFile.arrayBuffer()))
      : [];

    const digests = computeConsultantDigests(cvSentRows, ccmRows);

    if (mode !== "send") {
      return NextResponse.json({ mode: "preview", digests });
    }

    // mode === "send"：读取姓名对照表 -> 匹配 open_id -> 逐个顾问发送卡片
    const nameToOpenId = await fetchConsultantNameToOpenId();
    const matches = matchConsultants(
      digests.map((d) => d.consultantName),
      nameToOpenId
    );
    const matchMap = new Map(matches.map((m) => [m.consultantName, m.openId]));

    const label = todayLabel(new Date());
    const results: {
      consultantName: string;
      status: "sent" | "unmatched" | "failed";
      error?: string;
    }[] = [];

    for (const digest of digests) {
      const openId = matchMap.get(digest.consultantName);
      if (!openId) {
        results.push({ consultantName: digest.consultantName, status: "unmatched" });
        continue;
      }
      try {
        const card = buildCardForConsultant(digest, label);
        await sendCardToOpenId(openId, card);
        results.push({ consultantName: digest.consultantName, status: "sent" });
      } catch (err) {
        results.push({
          consultantName: digest.consultantName,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ mode: "send", digests, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
