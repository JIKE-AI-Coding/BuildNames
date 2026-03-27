import { NextRequest, NextResponse } from "next/server";

export interface VerifyRequest {
  names: string[];
}

export interface VerificationResult {
  name: string;
  githubAvailable: boolean;
  domains: {
    com: boolean;
    cn: boolean;
    io: boolean;
    app: boolean;
    dev: boolean;
    ai: boolean;
  };
  scores?: {
    githubScore: number;
    domainScore: number;
    lengthBonus: number;
    totalScore: number;
  };
}

export interface VerifyResponse {
  success: boolean;
  data?: {
    jobId?: string;
    results?: VerificationResult[];
  };
  error?: string;
}

// In-memory job storage (for development)
// In production, use Vercel KV or Upstash Redis
const jobStore = new Map<
  string,
  {
    status: "pending" | "completed" | "failed";
    results?: VerificationResult[];
    error?: string;
  }
>();

// Rate limit delay function - can be overridden in tests
let rateLimitDelay = 2100;
export function setRateLimitDelay(ms: number) {
  rateLimitDelay = ms;
}

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    return data.total_count === 0;
  } catch (error) {
    console.error("GitHub check error:", error);
    return false;
  }
}

async function checkDomain(name: string, tld: string): Promise<boolean> {
  try {
    const domain = `${name.toLowerCase()}.${tld}`;
    const url = `https://api.whoiscx.com/whois/?domain=${encodeURIComponent(domain)}`;

    // Rate limit: 1 request per 2 seconds for WhoisCX API
    await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));

    const response = await fetch(url);

    if (!response.ok) {
      // If API request fails, return false (don't assume available)
      return false;
    }

    const data = await response.json();

    // is_available: 1 = available, 0 = registered
    if (data.status === 1) {
      return data.is_available === 1;
    }

    // If API returns non-success status, return false (don't assume available)
    return false;
  } catch {
    // On error, return false (don't assume available)
    return false;
  }
}

async function checkAllDomains(name: string): Promise<VerificationResult["domains"]> {
  const tlds = ["com", "cn"] as const;

  // Sequential check to respect rate limit (1 req/2s)
  const domains = {
    com: false,
    cn: false,
    io: false,
    app: false,
    dev: false,
    ai: false,
  } as VerificationResult["domains"];

  for (const tld of tlds) {
    const available = await checkDomain(name, tld);
    (domains as Record<string, boolean>)[tld] = available;
  }

  return domains;
}

function calculateDomainScore(domains: VerificationResult["domains"]): number {
  if (domains.com) return 1.0;
  if (domains.cn) return 0.8;
  return 0;
}

function calculateLengthBonus(name: string): number {
  const len = name.length;
  if (len >= 2 && len <= 6) return 0.2;
  if (len >= 7 && len <= 10) return 0.1;
  return 0;
}

function calculateScores(
  name: string,
  githubAvailable: boolean,
  domains: VerificationResult["domains"]
): VerificationResult["scores"] {
  const githubScore = githubAvailable ? 1.0 : 0;
  const domainScore = calculateDomainScore(domains);
  const lengthBonus = calculateLengthBonus(name);
  const totalScore = githubScore + domainScore + lengthBonus;

  return {
    githubScore,
    domainScore,
    lengthBonus,
    totalScore: Math.round(totalScore * 100) / 100,
  };
}

async function processVerification(
  jobId: string,
  names: string[],
  githubToken?: string
): Promise<void> {
  try {
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
          const scores = calculateScores(name, githubAvailable, domains);
          return {
            name,
            githubAvailable,
            domains,
            scores,
          };
        })
      );
      results.push(...batchResults);
    }

    jobStore.set(jobId, {
      status: "completed",
      results,
    });
  } catch (error) {
    console.error("Verification error:", error);
    jobStore.set(jobId, {
      status: "failed",
      error: "验证过程出错",
    });
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

    const githubToken = process.env.GITHUB_TOKEN;
    const jobId = generateJobId();

    // For small requests (<=3 names), process synchronously
    if (names.length <= 3) {
      const results: VerificationResult[] = [];
      const batchResults = await Promise.all(
        names.map(async (name) => {
          const [githubAvailable, domains] = await Promise.all([
            checkGithub(name, githubToken),
            checkAllDomains(name),
          ]);
          const scores = calculateScores(name, githubAvailable, domains);
          return {
            name,
            githubAvailable,
            domains,
            scores,
          };
        })
      );
      results.push(...batchResults);

      return NextResponse.json<VerifyResponse>({
        success: true,
        data: { results },
      });
    }

    // For larger requests, process asynchronously
    jobStore.set(jobId, { status: "pending" });

    // Start processing in background (non-blocking)
    processVerification(jobId, names, githubToken);

    return NextResponse.json<VerifyResponse>({
      success: true,
      data: { jobId },
    });
  } catch (error) {
    console.error("Verify API error:", error);
    return NextResponse.json<VerifyResponse>(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: "缺少 jobId 参数" },
      { status: 400 }
    );
  }

  const job = jobStore.get(jobId);

  if (!job) {
    return NextResponse.json(
      { success: false, error: "任务不存在或已过期" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      status: job.status,
      results: job.results,
      error: job.error,
    },
  });
}
