import { NextRequest, NextResponse } from "next/server";

export interface VerifyRequest {
  names: string[];
}

export interface VerificationResult {
  name: string;
  githubAvailable: boolean;
  domains: {
    com: boolean;
    io: boolean;
    app: boolean;
    dev: boolean;
    ai: boolean;
  };
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

async function checkDomain(name: string, tld: string): Promise<boolean> {
  try {
    const domain = `${name.toLowerCase()}.${tld}`;
    const url = `https://cloudflare-dns.com/dns-query?type=A&name=${encodeURIComponent(domain)}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/dns-json",
      },
    });

    if (!response.ok) {
      return true;
    }

    const data = await response.json();

    if (data.Status === 3) {
      return true;
    }

    if (data.Answer && data.Answer.length > 0) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Domain check error:", error);
    return true;
  }
}

async function checkAllDomains(name: string): Promise<VerificationResult["domains"]> {
  const tlds = ["com", "io", "app", "dev", "ai"] as const;

  const results = await Promise.all(
    tlds.map(async (tld) => {
      const available = await checkDomain(name, tld);
      return { tld, available };
    })
  );

  const domains: VerificationResult["domains"] = {
    com: false,
    io: false,
    app: false,
    dev: false,
    ai: false,
  };

  results.forEach(({ tld, available }) => {
    domains[tld] = available;
  });

  return domains;
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
          const [githubAvailable, domains] = await Promise.all([
            checkGithub(name, githubToken),
            checkAllDomains(name),
          ]);
          return {
            name,
            githubAvailable,
            domains,
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
