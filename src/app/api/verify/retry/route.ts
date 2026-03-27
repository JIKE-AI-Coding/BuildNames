import { NextRequest, NextResponse } from "next/server";

// Rate limit delay - shared with main verify route
let rateLimitDelay = 2100;

async function checkDomain(name: string, tld: string): Promise<boolean | null> {
  try {
    const domain = `${name.toLowerCase()}.${tld}`;
    const url = `http://api.whoiscx.com/whois/?domain=${encodeURIComponent(domain)}`;

    // Rate limit: 1 request per 2 seconds for WhoisCX API
    await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));

    const response = await fetch(url);

    if (!response.ok) {
      console.log(`[WhoisCX API] domain=${domain}, status=${response.status}, ok=false`);
      return null;
    }

    const data = await response.json();
    console.log(`[WhoisCX API] domain=${domain}, rawResponse=`, data);

    // is_available: 1 = available, 0 = registered
    // Note: WhoisCX returns { status: 1, data: { is_available: 1, ... } }
    if (data.status === 1 && data.data) {
      return data.data.is_available === 1;
    }

    return null;
  } catch (e) {
    console.error(`[WhoisCX API] domain=${name}.${tld}, error=`, e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, tld } = body;

    if (!name || !tld) {
      return NextResponse.json(
        { success: false, error: "缺少 name 或 tld 参数" },
        { status: 400 }
      );
    }

    const available = await checkDomain(name, tld);

    console.log(`[DomainVerify] name=${name}, tld=${tld}, available=${available}`);

    return NextResponse.json({
      success: true,
      data: { name, tld, available },
    });
  } catch (error) {
    console.error("Retry domain error:", error);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
