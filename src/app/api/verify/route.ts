import { NextRequest, NextResponse } from "next/server";

export interface VerifyRequest {
  names: string[];
}

export interface VerificationResult {
  name: string;
  githubAvailable: boolean;
  domainAvailable: boolean;
}

export interface VerifyResponse {
  success: boolean;
  data?: {
    results: VerificationResult[];
  };
  error?: string;
}

async function checkGithub(name: string, token?: string): Promise<boolean> {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(name)}+in:name&per_page=1`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error("GitHub API error:", response.status);
      return false;
    }

    const data = await response.json();
    // If total_count > 0, there's at least one repo with this name
    return data.total_count === 0;
  } catch (error) {
    console.error("GitHub check error:", error);
    return false;
  }
}

async function checkDomain(name: string): Promise<boolean> {
  try {
    // Using Cloudflare DNS-over-HTTPS API
    const domain = `${name.toLowerCase()}.com`;
    const url = `https://cloudflare-dns.com/dns-query?type=A&name=${encodeURIComponent(domain)}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/dns-json",
      },
    });

    if (!response.ok) {
      // If API fails, assume domain might be available
      return true;
    }

    const data = await response.json();

    // NXDOMAIN means domain is available (Status: 3 or no A records)
    // If Status is not 3 and there are answers, domain is taken
    if (data.Status === 3) {
      return true; // NXDOMAIN - available
    }

    if (data.Answer && data.Answer.length > 0) {
      // Has A records - domain is taken
      return false;
    }

    // Fallback - assume available
    return true;
  } catch (error) {
    console.error("Domain check error:", error);
    // On error, be optimistic and say it's available
    return true;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    const { names } = body;

    if (!names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json<VerifyResponse>(
        { success: false, error: "名字列表不能为空" },
        { status: 400 }
      );
    }

    if (names.length > 20) {
      return NextResponse.json<VerifyResponse>(
        { success: false, error: "一次验证最多20个名字" },
        { status: 400 }
      );
    }

    // Get GitHub token for higher rate limit
    const githubToken = process.env.GITHUB_TOKEN;

    // Run checks in parallel with concurrency limit
    const results: VerificationResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < names.length; i += batchSize) {
      const batch = names.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (name) => {
          const [githubAvailable, domainAvailable] = await Promise.all([
            checkGithub(name, githubToken),
            checkDomain(name),
          ]);
          return {
            name,
            githubAvailable,
            domainAvailable,
          };
        })
      );
      results.push(...batchResults);
    }

    return NextResponse.json<VerifyResponse>({
      success: true,
      data: { results },
    });
  } catch (error) {
    console.error("Verify API error:", error);
    return NextResponse.json<VerifyResponse>(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
