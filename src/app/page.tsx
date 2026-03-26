"use client";

import { useState, useCallback } from "react";

interface NameResult {
  name: string;
  reason?: string;
  githubAvailable?: boolean;
  domains?: {
    com: boolean;
    io: boolean;
    app: boolean;
    dev: boolean;
    ai: boolean;
  };
  verified?: boolean;
}

type VerifyStatus = "idle" | "verifying";

export default function Home() {
  const [productIdea, setProductIdea] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [productPositioning, setProductPositioning] = useState("");
  const [names, setNames] = useState<NameResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState<VerifyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setError(null);

    // Validate
    if (!productIdea.trim()) {
      setError("请输入产品想法");
      return;
    }
    if (!targetUsers.trim()) {
      setError("请输入目标用户");
      return;
    }
    if (!productPositioning.trim()) {
      setError("请输入产品定位");
      return;
    }

    setIsGenerating(true);
    setNames([]);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIdea,
          targetUsers,
          productPositioning,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "生成失败");
        setIsGenerating(false);
        return;
      }

      const initialNames = data.data.names.map(
        (item: { name: string; reason: string }) => ({
          name: item.name,
          reason: item.reason,
          verified: false,
        })
      );
      setNames(initialNames);
      setIsGenerating(false);

      // Auto-verify after generation
      handleVerify(initialNames.map((n: NameResult) => n.name));
    } catch (err) {
      console.error("Generate error:", err);
      setError("网络错误，请重试");
      setIsGenerating(false);
    }
  }, [productIdea, targetUsers, productPositioning]);

  const handleVerify = async (namesToVerify: string[]) => {
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

      // Merge verification results with existing names
      setNames((prevNames) =>
        prevNames.map((nameObj) => {
          const result = data.data.results.find(
            (r: { name: string }) => r.name === nameObj.name
          );
          return result
            ? {
                ...nameObj,
                githubAvailable: result.githubAvailable,
                domains: result.domains,
                verified: true,
              }
            : nameObj;
        })
      );
      setIsVerifying("idle");
    } catch (err) {
      console.error("Verify error:", err);
      setError("验证失败，请重试");
      setIsVerifying("idle");
    }
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
      <div className="max-w-[640px] mx-auto px-6 md:px-12 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-[#111827] mb-2">
            BuildNames
          </h1>
          <p className="text-[#6B7280] text-base">
            AI 产品名生成与验证工具
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-[#FEF2F2] border border-[#EF4444] rounded-md flex items-center justify-between">
            <span className="text-[#EF4444] text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[#EF4444] hover:text-[#DC2626] text-lg leading-none"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        )}

        {/* Input Form */}
        <div className="space-y-4 mb-6">
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

          <div>
            <label
              htmlFor="targetUsers"
              className="block text-sm font-medium text-[#111827] mb-1.5"
            >
              目标用户
            </label>
            <input
              id="targetUsers"
              type="text"
              value={targetUsers}
              onChange={(e) => setTargetUsers(e.target.value)}
              placeholder="例如：独立开发者、初创团队"
              maxLength={200}
              className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
            />
          </div>

          <div>
            <label
              htmlFor="productPositioning"
              className="block text-sm font-medium text-[#111827] mb-1.5"
            >
              产品定位
            </label>
            <input
              id="productPositioning"
              type="text"
              value={productPositioning}
              onChange={(e) => setProductPositioning(e.target.value)}
              placeholder="例如：极简、高效、可定制的任务管理"
              maxLength={300}
              className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
            />
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || isVerifying === "verifying"}
          className={`w-full py-3 rounded-md font-medium text-white transition-all duration-100 ${
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

        {/* Results Section */}
        {names.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#111827]">
                生成结果
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
            </div>

            <div className="space-y-2" role="list">
              {names.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="group py-3 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg hover:border-[#2563EB] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCopy(item.name)}
                        className="text-[#111827] font-medium hover:text-[#2563EB] transition-colors cursor-pointer"
                        title="点击复制"
                      >
                        {item.name}
                      </button>
                      {copiedName === item.name && (
                        <span className="text-[#10B981] text-sm animate-pulse">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                    {item.verified ? (
                      <>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span
                            className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                              item.githubAvailable
                                ? "bg-[#ECFDF5] text-[#10B981]"
                                : "bg-[#FEF2F2] text-[#EF4444]"
                            }`}
                          >
                            GitHub
                          </span>
                          {item.githubAvailable ? (
                            <span className="text-[#10B981]">✓</span>
                          ) : (
                            <span className="text-[#EF4444]">✗</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {(["com", "io", "app", "dev", "ai"] as const).map((tld) => (
                            <div key={tld} className="flex items-center gap-0.5 text-sm">
                              <span
                                className={`font-mono text-xs px-1 py-0.5 rounded ${
                                  item.domains?.[tld]
                                    ? "bg-[#ECFDF5] text-[#10B981]"
                                    : "bg-[#FEF2F2] text-[#EF4444]"
                                }`}
                              >
                                .{tld}
                              </span>
                              {item.domains?.[tld] ? (
                                <span className="text-[#10B981]">✓</span>
                              ) : (
                                <span className="text-[#EF4444]">✗</span>
                              )}
                            </div>
                          ))}
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
                    <p className="text-sm text-[#6B7280] mt-1.5">{item.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {names.length === 0 && !isGenerating && (
          <div className="mt-16 text-center">
            <p className="text-[#111827] font-medium mb-1">准备开始</p>
            <p className="text-[#9CA3AF] text-sm">
              输入你的产品想法，AI 将生成 10 个符合条件的名字
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
