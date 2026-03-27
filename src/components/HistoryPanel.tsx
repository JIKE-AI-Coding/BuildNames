"use client";

import { useState } from "react";
import { HistorySession, NameVerificationResult } from "@/hooks/useHistoryStorage";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistorySession[];
  onLoadSession: (session: HistorySession) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export default function HistoryPanel({
  isOpen,
  onClose,
  history,
  onLoadSession,
  onDeleteSession,
  onClearAll,
}: HistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleToggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleLoad = (session: HistorySession) => {
    onLoadSession(session);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteSession(id);
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleClearAll = () => {
    onClearAll();
    setShowClearConfirm(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-[400px] max-w-full bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="历史记录面板"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#111827]">历史记录</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F3F4F6] rounded-md transition-colors"
            aria-label="关闭面板"
          >
            <svg
              className="w-5 h-5 text-[#6B7280]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-64px)] overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#9CA3AF]">
              <svg
                className="w-12 h-12 mb-3 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h6m6-6a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">暂无历史记录</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {history.map((session) => (
                <div
                  key={session.id}
                  className="border border-[#E5E7EB] rounded-lg overflow-hidden"
                >
                  {/* Session Card Header */}
                  <button
                    onClick={() => handleToggleExpand(session.id)}
                    className="w-full px-4 py-3 text-left hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">
                          {truncateText(session.productIdea, 40)}
                        </p>
                        <p className="text-xs text-[#9CA3AF] mt-1">
                          {formatTimestamp(session.timestamp)} ·{" "}
                          {session.generatedNames.length} 个名字
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-[#9CA3AF] shrink-0 transition-transform ${
                          expandedId === session.id ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedId === session.id && (
                    <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] p-4">
                      {/* Product Info Summary */}
                      <div className="mb-3">
                        <p className="text-xs text-[#6B7280]">
                          <span className="font-medium">目标用户：</span>
                          {session.targetUsers.join("、")}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-1">
                          <span className="font-medium">产品定位：</span>
                          {truncateText(session.productPositioning, 50)}
                        </p>
                      </div>

                      {/* Names List */}
                      <div className="space-y-2 mb-4">
                        <p className="text-xs font-medium text-[#6B7280]">
                          生成的名字：
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {session.generatedNames.map((name, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 bg-white border border-[#E5E7EB] rounded text-xs text-[#111827]"
                            >
                              {name.name}
                              {name.chineseName && (
                                <span className="text-[#6B7280] ml-0.5">
                                  ({name.chineseName})
                                </span>
                              )}
                              {name.verified && name.scores && (
                                <span className="ml-1 text-[#F59E0B]">
                                  {"★".repeat(Math.round(name.scores.totalScore))}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoad(session)}
                          className="flex-1 py-2 px-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-md transition-colors"
                        >
                          加载此会话
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, session.id)}
                          className="py-2 px-3 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#EF4444] text-sm font-medium rounded-md transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Clear All */}
        {history.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-[#E5E7EB] bg-white">
            {showClearConfirm ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#6B7280]">确定清空所有历史？</span>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium rounded-md transition-colors"
                >
                  确定
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] text-sm font-medium rounded-md transition-colors"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2 px-3 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#EF4444] text-sm font-medium rounded-md transition-colors"
              >
                清空历史记录
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
