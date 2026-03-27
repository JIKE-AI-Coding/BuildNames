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

    const systemPrompt = `你是一位世界顶级的品牌命名专家，精通语言学、营销学和域名策略。
你的专长是创造令人难忘、与产品本质深度契合的名字。
你生成的名字必须：
1. 精准捕捉产品的核心价值和使用场景
2. 在众多竞争名字中脱颖而出，避免平庸
3. 简短有力，2-12个字符，易读易记
4. 域名友好（.com/.io/.ai 可用）
5. 无连字符、无数字、纯字母组合`;

    let prompt = `请根据以下产品信息，生成10个令人惊艳的产品名称。

产品想法：${productIdea}
目标用户：${targetUsersStr}
产品定位：${productPositioning}

重要指导：
1. 名字必须精准体现产品想法中最独特的点
2. 名字要与"${productPositioning}"的关键词有强关联
3. 英文名要能够体现产品价值或核心特点，避免平庸的通用词
4. 中文名简洁有力，与英文名形成呼应
5. 优先选择在 .com/.io/.ai 域名上可用的名字
6. 禁止使用连字符、数字或下划线`;

    // Add exclusion instruction if there are previously generated names
    if (excludeNames && excludeNames.length > 0) {
      prompt += `\n\n重要：请不要生成以下名字（这些已经被使用）：${excludeNames.join("、")}`;
    }

    prompt += `

请按以下格式返回10个名字（用英文冒号分隔）：
英文名:中文名:理由
示例：
Pomodoro:番茄芯:直接关联番茄钟核心概念，简洁有力
FocusFlow:专注流:表达程序员沉浸式工作状态

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 800,
        temperature: 0.85,
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
