import { NextRequest, NextResponse } from "next/server";

export interface GenerateRequest {
  productIdea: string;
  targetUsers: string | string[];
  productPositioning: string;
  excludeNames?: string[];
}

export interface GenerateResponse {
  success: boolean;
  data?: {
    names: { name: string; chineseName: string; reason: string }[];
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    const { productIdea, targetUsers, productPositioning, excludeNames } = body;

    // Validate inputs
    if (!productIdea?.trim()) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "产品想法不能为空" },
        { status: 400 }
      );
    }

    if (!targetUsers || (Array.isArray(targetUsers) && targetUsers.length === 0)) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "目标用户不能为空" },
        { status: 400 }
      );
    }

    // Convert targetUsers to display string
    const targetUsersStr = Array.isArray(targetUsers) ? targetUsers.join("、") : targetUsers;

    if (!productPositioning?.trim()) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "产品定位不能为空" },
        { status: 400 }
      );
    }

    if (productIdea.length > 500) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "产品想法不能超过500字符" },
        { status: 400 }
      );
    }

    // Call OpenAI API
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!openaiApiKey) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "服务器配置错误：OpenAI API Key 未设置" },
        { status: 500 }
      );
    }

    let prompt = `你是一个专业的品牌命名顾问。请根据以下信息生成10个独特、易记、适合的产品名称。

产品想法：${productIdea}
目标用户：${targetUsersStr}
产品定位：${productPositioning}`;

    // Add exclusion instruction if there are previously generated names
    if (excludeNames && excludeNames.length > 0) {
      prompt += `\n\n重要：请不要生成以下名字（这些已经被使用）：${excludeNames.join("、")}`;
    }

    prompt += `
要求：
1. 每个名字包含英文名（2-12字符，用于GitHub和域名）和中文名（2-6字符，品牌中文名）
2. 英文名易于发音和记忆，能够体现产品价值或特点
3. 中文名简洁有力，与英文名呼应
4. 在 GitHub 和主流域名（如 .com）上可用
5. 避免使用连字符或数字

请按以下格式返回10个名字（用英文冒号分隔）：
英文名:中文名:理由
示例：
TimeKeeper:时 Keeper:简洁有力，突出时间管理的核心功能
FlowState:流态:表达专注工作状态的概念

请直接返回10行，不要包含序号或其他内容。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的品牌命名顾问，只返回产品名称列表。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 1.0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "AI 服务暂时不可用，请稍后重试" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "AI 返回内容为空" },
        { status: 500 }
      );
    }

    // Parse names and reasons - split by newline, each line is "名称:理由"
    const lines = content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    const parsedNames = lines.slice(0, 10).map((line: string) => {
      // Format: 英文名:中文名:理由
      const parts = line.split(":");
      if (parts.length >= 3) {
        return {
          name: parts[0].trim(),
          chineseName: parts[1].trim(),
          reason: parts.slice(2).join(":").trim(),
        };
      } else if (parts.length === 2) {
        // Fallback: English name and reason (no Chinese name)
        return {
          name: parts[0].trim(),
          chineseName: "",
          reason: parts[1].trim(),
        };
      }
      // Fallback: if no colon found, treat whole line as name with empty reason
      return { name: line, reason: "", chineseName: "" };
    });

    // Server-side deduplication: filter out names that are in excludeNames
    const excludeSet = new Set(excludeNames || []);
    const names = parsedNames.filter((n: { name: string; reason: string }) => !excludeSet.has(n.name));

    if (names.length === 0) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "未能生成有效的产品名称" },
        { status: 500 }
      );
    }

    return NextResponse.json<GenerateResponse>({
      success: true,
      data: { names },
    });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json<GenerateResponse>(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
