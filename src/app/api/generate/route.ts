import { NextRequest, NextResponse } from "next/server";

export interface GenerateRequest {
  productIdea: string;
  targetUsers: string;
  productPositioning: string;
}

export interface GenerateResponse {
  success: boolean;
  data?: {
    names: string[];
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    const { productIdea, targetUsers, productPositioning } = body;

    // Validate inputs
    if (!productIdea?.trim()) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "产品想法不能为空" },
        { status: 400 }
      );
    }

    if (!targetUsers?.trim()) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "目标用户不能为空" },
        { status: 400 }
      );
    }

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

    const prompt = `你是一个专业的品牌命名顾问。请根据以下信息生成10个独特、易记、适合的产品名称。

产品想法：${productIdea}
目标用户：${targetUsers}
产品定位：${productPositioning}

要求：
1. 名称应该简短（2-12个字符）
2. 易于发音和记忆
3. 能够体现产品价值或特点
4. 在 GitHub 和主流域名（如 .com）上可用
5. 避免使用连字符或数字

请只返回10个名称，用换行分隔，不要包含任何解释或其他内容。`;

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
        temperature: 0.8,
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

    // Parse names - split by newline and filter empty lines
    const names = content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 10); // Ensure max 10 names

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
