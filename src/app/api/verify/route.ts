import { NextRequest, NextResponse } from "next/server";

export interface VerifyRequest {
  names: string[];
}

export interface VerificationResult {
  name: string;
  githubAvailable: boolean;
  domains: {
    com: boolean | null;  // null = unknown (API failed)
    cn: boolean | null;
    io: boolean | null;
    app: boolean | null;
    dev: boolean | null;
    ai: boolean | null;
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
    // 精准匹配仓库名
    const searchQuery = `name:${name}`;
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.append("q", searchQuery);
    url.searchParams.append("per_page", "3");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.log(`[GitHub API] name=${name}, status=${response.status}, ok=false`);
      // API 异常时默认允许使用
      return true;
    }

    const data = await response.json();
    console.log(`[GitHub API] name=${name}, rawResponse=`, data);

    const repoItems = data.items || [];
    // 精准判断：是否存在完全同名仓库（忽略大小写）
    const hasDuplicate = repoItems.some(
      (item: any) => item.name.toLowerCase() === name.toLowerCase()
    );

    // 无重名 → 可用
    return !hasDuplicate;
  } catch (error) {
    console.error("GitHub check error:", error);
    // 异常不阻塞业务，默认允许
    return true;
  }
}

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

    // If API returns non-success status, return null (unknown)
    return null;
  } catch (e) {
    console.error(`[WhoisCX API] domain=${name}.${tld}, error=`, e);
    return null;
  }
}

async function checkAllDomains(name: string): Promise<VerificationResult["domains"]> {
  const tlds = ["com", "cn"] as const;

  // Sequential check to respect rate limit (1 req/2s)
  const domains: VerificationResult["domains"] = {
    com: null,
    cn: null,
    io: null,
    app: null,
    dev: null,
    ai: null,
  };

  for (const tld of tlds) {
    const available = await checkDomain(name, tld);
    (domains as Record<string, boolean | null>)[tld] = available;
  }

  return domains;
}

/**
 * 计算名称推荐星级
 * 5星：GitHub可用 + .com可用
 * 4星：GitHub可用 + .cn可用（.com不可用），或 .com可用但GitHub占用
 * 3星：.com或.cn可用，GitHub占用
 * 2星：只有GitHub可用，无域名
 * 1星：GitHub占用，无域名
 */
function calculateStarCount(
  githubAvailable: boolean,
  domains: VerificationResult["domains"]
): number {
  const comAvailable = domains.com === true;
  const cnAvailable = domains.cn === true;

  if (githubAvailable && comAvailable) {
    return 5; // 满分
  }
  if (githubAvailable && cnAvailable && !comAvailable) {
    return 4; // GitHub可用 + cn可用
  }
  if (githubAvailable && !comAvailable && !cnAvailable) {
    return 3; // 只有GitHub可用
  }
  if (!githubAvailable && comAvailable) {
    return 4; // .com可用但GitHub占用
  }
  if (!githubAvailable && cnAvailable && !comAvailable) {
    return 3; // .cn可用但GitHub占用
  }
  return 1; // GitHub占用，无好域名
}

function calculateScores(
  name: string,
  githubAvailable: boolean,
  domains: VerificationResult["domains"]
): VerificationResult["scores"] {
  const starCount = calculateStarCount(githubAvailable, domains);

  // 为了兼容性保留分数，但改为基于星级的固定分值
  const githubScore = githubAvailable ? 1.0 : 0;
  const domainScore = domains.com === true ? 1.0 : domains.cn === true ? 0.8 : 0;

  return {
    githubScore,
    domainScore,
    lengthBonus: 0, // 简化：不再使用长度奖励
    totalScore: starCount, // 直接使用星级作为总分
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
          console.log(`[DomainVerify] name=${name}, domains=${JSON.stringify(domains)}`);
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
