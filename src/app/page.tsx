"use client";

import { useState, useCallback } from "react";
import { useHistoryStorage, HistorySession } from "@/hooks/useHistoryStorage";
import HistoryPanel from "@/components/HistoryPanel";

interface NameResult {
  name: string;
  chineseName?: string;
  reason?: string;
  githubAvailable?: boolean;
  domains?: {
    com: boolean | null;
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
  verified?: boolean;
}

type VerifyStatus = "idle" | "verifying";

export default function Home() {
  const [productIdea, setProductIdea] = useState("");
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [productPositioning, setProductPositioning] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [names, setNames] = useState<NameResult[]>([]);
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState<VerifyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [retryingDomains, setRetryingDomains] = useState<Set<string>>(new Set()); // track "name:tld"

  // History state
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const { history, saveSession, deleteSession, clearAllHistory } = useHistoryStorage();

  // Predefined target user options
  const userOptions = [
    "独立开发者",
    "初创团队",
    "中小企业",
    "大型企业",
    "程序员",
    "设计师",
    "产品经理",
    "学生",
    "教育工作者",
    "自由职业者",
  ];

  // 计算星级的辅助函数
  const calculateStarCount = (
    githubAvailable: boolean,
    domains: NameResult["domains"]
  ): number => {
    if (!domains) return 0;
    const comAvailable = domains.com === true;
    const cnAvailable = domains.cn === true;

    if (githubAvailable && comAvailable) return 5;
    if (githubAvailable && cnAvailable && !comAvailable) return 4;
    if (githubAvailable && !comAvailable && !cnAvailable) return 3;
    if (!githubAvailable && comAvailable) return 4;
    if (!githubAvailable && cnAvailable && !comAvailable) return 3;
    return 1;
  };

  const handleRetryDomain = useCallback(async (name: string, tld: string) => {
    const key = `${name}:${tld}`;
    setRetryingDomains((prev) => new Set(prev).add(key));

    try {
      const response = await fetch("/api/verify/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tld }),
      });

      const data = await response.json();

      if (data.success && data.data.available !== null) {
        setNames((prevNames) =>
          prevNames.map((item) => {
            if (item.name === name && item.domains) {
              const newDomains = {
                ...item.domains,
                [tld]: data.data.available,
              };
              // 重新计算分数
              const newStarCount = calculateStarCount(item.githubAvailable ?? false, newDomains);
              return {
                ...item,
                domains: newDomains,
                scores: {
                  githubScore: item.githubAvailable ? 1.0 : 0,
                  domainScore: newDomains.com === true ? 1.0 : newDomains.cn === true ? 0.8 : 0,
                  lengthBonus: 0,
                  totalScore: newStarCount,
                },
              };
            }
            return item;
          })
        );
      }
    } catch (err) {
      console.error("Retry domain error:", err);
    } finally {
      setRetryingDomains((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const handleRetryAll = useCallback(async () => {
    // Collect all null domains from all names
    const toRetry: { name: string; tld: string }[] = [];
    names.forEach((item) => {
      if (item.domains) {
        (["com", "cn"] as const).forEach((tld) => {
          if (item.domains?.[tld] === null) {
            toRetry.push({ name: item.name, tld });
          }
        });
      }
    });

    if (toRetry.length === 0) return;

    // Mark all as retrying
    const keysToRetry = new Set(toRetry.map((r) => `${r.name}:${r.tld}`));
    setRetryingDomains(keysToRetry);

    try {
      // Retry all in parallel
      await Promise.all(
        toRetry.map(async ({ name, tld }) => {
          const response = await fetch("/api/verify/retry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, tld }),
          });
          const data = await response.json();
          if (data.success && data.data.available !== null) {
            setNames((prevNames) =>
              prevNames.map((item) => {
                if (item.name === name && item.domains) {
                  const newDomains = {
                    ...item.domains,
                    [tld]: data.data.available,
                  };
                  // 重新计算分数
                  const newStarCount = calculateStarCount(item.githubAvailable ?? false, newDomains);
                  return {
                    ...item,
                    domains: newDomains,
                    scores: {
                      githubScore: item.githubAvailable ? 1.0 : 0,
                      domainScore: newDomains.com === true ? 1.0 : newDomains.cn === true ? 0.8 : 0,
                      lengthBonus: 0,
                      totalScore: newStarCount,
                    },
                  };
                }
                return item;
              })
            );
          }
        })
      );
    } catch (err) {
      console.error("Retry all error:", err);
    } finally {
      setRetryingDomains(new Set());
    }
  }, [names]);

  // History handlers - declared before handleGenerate to avoid temporal dead zone
  // Note: namesToSave parameter to avoid stale state issue with setNames being async
  const handleSaveSession = useCallback((namesToSave: NameResult[]) => {
    if (productIdea.trim() && targetUsers.length > 0 && productPositioning.trim() && namesToSave.length > 0) {
      saveSession({
        productIdea,
        targetUsers,
        productPositioning,
        generatedNames: namesToSave,
      });
    }
  }, [productIdea, targetUsers, productPositioning, saveSession]);

  const handleLoadSession = useCallback(
    (session: HistorySession) => {
      setProductIdea(session.productIdea);
      setTargetUsers(session.targetUsers);
      setProductPositioning(session.productPositioning);
      // Merge generated names from the session into the deduplication list
      const sessionNames = session.generatedNames.map((n) => n.name);
      setGeneratedNames((prev) => {
        const combined = [...prev, ...sessionNames];
        // Deduplicate
        return [...new Set(combined)];
      });
      // Replace names with session's names and re-verify for current availability
      setNames(session.generatedNames.map((n) => ({ ...n, verified: false })));
      // Trigger verification for the loaded names
      handleVerify(sessionNames);
    },
    []
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);
    },
    [deleteSession]
  );

  const handleClearAllHistory = useCallback(() => {
    clearAllHistory();
  }, [clearAllHistory]);

  const handleGenerate = useCallback(async () => {
    setError(null);

    // Validate
    if (!productIdea.trim()) {
      setError("请输入产品想法");
      return;
    }
    if (targetUsers.length === 0) {
      setError("请选择目标用户");
      return;
    }
    if (!productPositioning.trim()) {
      setError("请输入产品定位");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIdea,
          targetUsers,
          productPositioning,
          excludeNames: generatedNames,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "生成失败");
        setIsGenerating(false);
        return;
      }

      const newNames = data.data.names.map(
        (item: { name: string; chineseName: string; reason: string }) => ({
          name: item.name,
          chineseName: item.chineseName,
          reason: item.reason,
          verified: false,
        })
      );
      // Replace names list with new names (not append)
      setNames(newNames);
      setGeneratedNames((prev) => [...prev, ...newNames.map((n: NameResult) => n.name)]);
      setIsGenerating(false);

      // Auto-verify after generation
      handleVerify(newNames.map((n: NameResult) => n.name));

      // Save to history after successful generation (pass newNames directly to avoid stale state)
      handleSaveSession(newNames);
    } catch (err) {
      console.error("Generate error:", err);
      setError("网络错误，请重试");
      setIsGenerating(false);
    }
  }, [productIdea, targetUsers, productPositioning, generatedNames, handleSaveSession]);

  const handleVerify = useCallback(async (namesToVerify: string[]) => {
    setIsVerifying("verifying");
    setError(null);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: namesToVerify }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "验证失败");
        setIsVerifying("idle");
        return;
      }

      // Check if async job (has jobId) or sync results
      if (data.data.jobId) {
        // Async job - poll for results
        pollForResults(data.data.jobId, namesToVerify);
      } else if (data.data.results) {
        // Sync results (small request)
        mergeResults(data.data.results);
        setIsVerifying("idle");
      }
    } catch (err) {
      console.error("Verify error:", err);
      setError("验证失败，请重试");
      setIsVerifying("idle");
    }
  }, []);

  const pollForResults = async (jobId: string, namesToVerify: string[]) => {
    const maxAttempts = 150; // ~150s timeout for rate-limited domain checks
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/verify?jobId=${jobId}`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || "查询任务状态失败");
          setIsVerifying("idle");
          return;
        }

        if (data.data.status === "completed" && data.data.results) {
          mergeResults(data.data.results);
          setIsVerifying("idle");
          return;
        }

        if (data.data.status === "failed") {
          setError(data.data.error || "验证任务失败");
          setIsVerifying("idle");
          return;
        }

        // Still pending, wait and retry
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (err) {
        console.error("Poll error:", err);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    setError("验证超时（域名API限速），请稍后重试");
    setIsVerifying("idle");
  };

  const mergeResults = (results: { name: string; githubAvailable: boolean; domains: { com: boolean | null; cn: boolean | null; io: boolean | null; app: boolean | null; dev: boolean | null; ai: boolean | null }; scores?: { githubScore: number; domainScore: number; lengthBonus: number; totalScore: number } }[]) => {
    setNames((prevNames) =>
      prevNames.map((nameObj) => {
        const result = results.find((r) => r.name === nameObj.name);
        return result
          ? {
              ...nameObj,
              githubAvailable: result.githubAvailable,
              domains: result.domains,
              scores: result.scores,
              verified: true,
            }
          : nameObj;
      })
    );
  };

  const handleCopy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 1000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Header - Full Width */}
      <div className="border-b border-[#E5E7EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            BuildNames
          </h1>
          <button
            onClick={() => setShowHistoryPanel(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] rounded-md transition-colors"
            aria-label="查看历史记录"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            历史记录
            {history.length > 0 && (
              <span className="px-1.5 py-0.5 bg-[#E5E7EB] text-[#6B7280] text-xs rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner - Full Width */}
      {error && (
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-3">
          <div className="p-4 bg-[#FEF2F2] border border-[#EF4444] rounded-md flex items-center justify-between">
            <span className="text-[#EF4444] text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[#EF4444] hover:text-[#DC2626] text-lg leading-none"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Left Right Split */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-6">
        <div className="flex gap-16">
          {/* Left Column - Form (40%) */}
          <div className="w-[40%] shrink-0">
            {/* Input Form */}
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="productIdea"
                  className="block text-sm font-medium text-[#111827] mb-1.5"
                >
                  产品想法
                </label>
                <textarea
                  id="productIdea"
                  value={productIdea}
                  onChange={(e) => setProductIdea(e.target.value)}
                  placeholder="例如：一个帮助程序员管理时间的工具"
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md text-[#111827] placeholder-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
                />
                <div className="text-xs text-[#9CA3AF] text-right mt-1">
                  {productIdea.length}/500
                </div>
              </div>

              <div className="relative">
                <label
                  htmlFor="targetUsers"
                  className="block text-sm font-medium text-[#111827] mb-1.5"
                >
                  目标用户
                </label>
                <button
                  id="targetUsers"
                  type="button"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md text-left text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow flex items-center justify-between"
                >
                  <span className={targetUsers.length === 0 ? "text-[#9CA3AF]" : ""}>
                    {targetUsers.length === 0
                      ? "选择目标用户"
                      : targetUsers.length === 1
                        ? targetUsers[0]
                        : `${targetUsers[0]} 等${targetUsers.length}个`}
                  </span>
                  <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                {showUserDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-[#E5E7EB] rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {userOptions.map((option) => (
                      <label
                        key={option}
                        className="flex items-center px-3 py-2 hover:bg-[#F9FAFB] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={targetUsers.includes(option)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetUsers([...targetUsers, option]);
                            } else {
                              setTargetUsers(targetUsers.filter((u) => u !== option));
                            }
                          }}
                          className="w-4 h-4 text-[#2563EB] border-[#E5E7EB] rounded focus:ring-[#2563EB]"
                        />
                        <span className="ml-2 text-sm text-[#111827]">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Selected tags */}
                {targetUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {targetUsers.map((user) => (
                      <span
                        key={user}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DBEAFE] text-[#2563EB] text-xs rounded-full"
                      >
                        {user}
                        <button
                          onClick={() => setTargetUsers(targetUsers.filter((u) => u !== user))}
                          className="hover:text-[#1D4ED8]"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="productPositioning"
                  className="block text-sm font-medium text-[#111827] mb-1.5"
                >
                  产品定位
                </label>
                <textarea
                  id="productPositioning"
                  value={productPositioning}
                  onChange={(e) => setProductPositioning(e.target.value)}
                  placeholder="例如：极简、高效、可定制的任务管理"
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md text-[#111827] placeholder-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
                />
                <div className="text-xs text-[#9CA3AF] text-right mt-1">
                  {productPositioning.length}/500
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isVerifying === "verifying"}
              className={`mt-6 w-full py-3 rounded-md font-medium text-white transition-all duration-100 ${
                isGenerating || isVerifying === "verifying"
                  ? "bg-[#93C5FD] cursor-not-allowed"
                  : "bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF]"
              }`}
              aria-label="生成10个产品名字"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  生成中...
                </span>
              ) : (
                "生成名字"
              )}
            </button>
          </div>

          {/* Right Column - Results (60%) */}
          <div className="flex-1 min-w-0">
            {/* Results Section */}
            {names.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#111827]">
                    推荐名字
                  </h2>
                  {isVerifying === "verifying" && (
                    <span className="text-sm text-[#6B7280] flex items-center gap-1.5">
                      <svg
                        className="animate-spin h-3.5 w-3.5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      验证中...
                    </span>
                  )}
                  {names.some(
                    (item) =>
                      item.domains &&
                      (item.domains.com === null || item.domains.cn === null)
                  ) && (
                    <button
                      onClick={handleRetryAll}
                      disabled={retryingDomains.size > 0}
                      className="mt-3 px-3 py-1.5 text-sm bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] rounded-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {retryingDomains.size > 0 ? (
                        <>
                          <svg
                            className="animate-spin h-3.5 w-3.5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          重试中...
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3.5 w-3.5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          重试全部未知域名
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-2" role="list">
                  {[...names]
                    .sort((a, b) => (b.scores?.totalScore || 0) - (a.scores?.totalScore || 0))
                    .map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="group py-3 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg hover:border-[#2563EB] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCopy(item.name)}
                            className="text-[#111827] font-semibold text-lg hover:text-[#2563EB] transition-colors cursor-pointer"
                            title="点击复制英文名"
                          >
                            {item.name}
                          </button>
                          {item.chineseName && (
                            <button
                              onClick={() => handleCopy(item.chineseName)}
                              className="text-[#6B7280] text-lg hover:text-[#2563EB] transition-colors cursor-pointer"
                              title="点击复制中文名"
                            >
                              ({item.chineseName})
                            </button>
                          )}
                          {copiedName === item.name && (
                            <span className="text-sm text-[#10B981] font-medium animate-pulse">
                              已复制
                            </span>
                          )}
                          {item.verified && item.scores && (() => {
                                const starCount = item.scores.totalScore;
                                const { githubAvailable, domains } = item;
                                const comAvailable = domains?.com === true;
                                const cnAvailable = domains?.cn === true;

                                if (starCount === 0) return null;

                                // 计算简要理由和 tooltip 原因，基于实际状态
                                let briefReason = "";
                                let tooltipReasons: string[] = [];

                                if (githubAvailable) {
                                  tooltipReasons.push("• GitHub 可用");
                                  if (comAvailable) {
                                    briefReason = "满分推荐";
                                    tooltipReasons.push("• .com 可用");
                                  } else if (cnAvailable) {
                                    briefReason = "推荐";
                                    tooltipReasons.push("• .cn 可用");
                                  } else {
                                    briefReason = "可考虑";
                                    tooltipReasons.push("• 域名已注册");
                                  }
                                } else {
                                  tooltipReasons.push("• GitHub 已占用");
                                  if (comAvailable) {
                                    briefReason = "推荐";
                                    tooltipReasons.push("• .com 可用");
                                  } else if (cnAvailable) {
                                    briefReason = "一般";
                                    tooltipReasons.push("• .cn 可用");
                                  } else {
                                    briefReason = "不推荐";
                                    tooltipReasons.push("• 域名已注册");
                                  }
                                }

                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5 group relative">
                                      {[1, 2, 3, 4, 5].map((star) => {
                                        const filled = star <= starCount;
                                        return (
                                          <svg
                                            key={star}
                                            className={`w-4 h-4 ${filled ? "text-[#F59E0B]" : "text-[#E5E7EB]"}`}
                                            fill={filled ? "currentColor" : "none"}
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={filled ? 0 : 1.5}
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                            />
                                          </svg>
                                        );
                                      })}
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#111827] text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                        {tooltipReasons.map((reason, i) => (
                                          <div key={i}>{reason}</div>
                                        ))}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111827]"></div>
                                      </div>
                                    </div>
                                    {/* Brief reason */}
                                    <span className="text-xs text-[#9CA3AF]">
                                      {briefReason}
                                    </span>
                                  </div>
                                );
                              })()}
                        </div>

                        <div className="flex items-center gap-3">
                        {item.verified ? (
                          <>
                            <div className="flex items-center gap-2 text-sm">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  item.githubAvailable
                                    ? "bg-[#ECFDF5] text-[#10B981]"
                                    : "bg-[#FEF2F2] text-[#EF4444]"
                                }`}
                              >
                                GitHub {item.githubAvailable ? "可用" : "已占用"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {(["com", "cn"] as const).map((tld) => {
                                const status = item.domains?.[tld];
                                const retryKey = `${item.name}:${tld}`;
                                const isRetrying = retryingDomains.has(retryKey);
                                return (
                                  <div key={tld} className="flex items-center gap-1 text-sm">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        status === true
                                          ? "bg-[#ECFDF5] text-[#10B981]"
                                          : status === false
                                            ? "bg-[#FEF2F2] text-[#EF4444]"
                                            : "bg-[#F3F4F6] text-[#9CA3AF]"
                                      }`}
                                    >
                                      .{tld} {status === true ? "可用" : status === false ? "已注册" : "未知"}
                                    </span>
                                    {status === null && (
                                      <button
                                        onClick={() => handleRetryDomain(item.name, tld)}
                                        disabled={isRetrying}
                                        className="text-[#9CA3AF] hover:text-[#2563EB] disabled:cursor-wait"
                                        title="重试验证"
                                      >
                                        {isRetrying ? (
                                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                          </svg>
                                        ) : (
                                          <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[#9CA3AF]">
                            <svg
                              className="animate-spin h-3.5 w-3.5"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      </div>
                      {item.reason && (
                        <p className="text-sm text-[#6B7280] mt-2">{item.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {names.length === 0 && !isGenerating && (
              <div className="pt-8">
                <p className="text-[#111827] font-medium mb-1">暂无生成结果</p>
                <p className="text-[#9CA3AF] text-sm">
                  在左侧输入产品信息，点击"生成名字"开始
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        history={history}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleClearAllHistory}
      />
    </main>
  );
}
