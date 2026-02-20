"use client";

/**
 * ResponseList Component
 * Anonymized individual responses displayed as cards with confidence badges
 */

import { useState, useMemo } from "react";
import { Card } from "../ui/Card";
import { Badge, ConfidenceBadge } from "../ui/Badge";
import { Select } from "../ui/Input";

// ============ Types ============

type ConfidenceLevel = "high" | "medium" | "low";

interface ResponseAnswer {
  questionId: string;
  questionText: string;
  answer: string | string[] | number;
  type: "text" | "multiple_choice" | "rating" | "yes_no" | "ranking";
}

interface PollResponse {
  id: string;
  respondentId: string; // Anonymized ID like "Respondent #42"
  submittedAt: Date | string;
  confidence: ConfidenceLevel;
  answers: ResponseAnswer[];
  metadata?: {
    ageRange?: string;
    location?: string;
    verifiedAttributes?: string[];
  };
}

interface ResponseListProps {
  /** List of responses */
  responses: PollResponse[];
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Whether to show respondent metadata */
  showMetadata?: boolean;
  /** Additional className */
  className?: string;
}

// ============ Helper Functions ============

function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAnswer(answer: ResponseAnswer): string {
  if (answer.type === "ranking" && Array.isArray(answer.answer)) {
    return answer.answer.map((item, idx) => `${idx + 1}. ${item}`).join(", ");
  }
  if (Array.isArray(answer.answer)) {
    return answer.answer.join(", ");
  }
  if (answer.type === "rating") {
    return `${answer.answer} / 5`;
  }
  return String(answer.answer);
}

// ============ Component ============

export function ResponseList({
  responses,
  maxHeight = "600px",
  showMetadata = true,
  className = "",
}: ResponseListProps) {
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Filter and sort responses
  const processedResponses = useMemo(() => {
    let filtered = [...responses];

    // Filter by confidence
    if (filterConfidence !== "all") {
      filtered = filtered.filter((r) => r.confidence === filterConfidence);
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = typeof a.submittedAt === "string" ? new Date(a.submittedAt) : a.submittedAt;
      const dateB = typeof b.submittedAt === "string" ? new Date(b.submittedAt) : b.submittedAt;

      switch (sortBy) {
        case "newest":
          return dateB.getTime() - dateA.getTime();
        case "oldest":
          return dateA.getTime() - dateB.getTime();
        case "confidence":
          const confidenceOrder = { high: 0, medium: 1, low: 2 };
          return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
        default:
          return 0;
      }
    });

    return filtered;
  }, [responses, filterConfidence, sortBy]);

  // Confidence counts for filter
  const confidenceCounts = useMemo(() => {
    return {
      all: responses.length,
      high: responses.filter((r) => r.confidence === "high").length,
      medium: responses.filter((r) => r.confidence === "medium").length,
      low: responses.filter((r) => r.confidence === "low").length,
    };
  }, [responses]);

  if (responses.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          No responses yet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Responses will appear here as participants complete the poll.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Filter:
          </span>
          <div className="flex gap-1">
            {(["all", "high", "medium", "low"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilterConfidence(level)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterConfidence === level
                    ? "bg-[#1B4D7A] text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}{" "}
                ({confidenceCounts[level]})
              </button>
            ))}
          </div>
        </div>

        <Select
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "confidence", label: "By confidence" },
          ]}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          fullWidth={false}
          className="w-40"
        />

        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {processedResponses.length} of {responses.length} responses
        </span>
      </div>

      {/* Response cards */}
      <div
        className="space-y-4 overflow-y-auto"
        style={{ maxHeight }}
      >
        {processedResponses.map((response) => (
          <ResponseCard
            key={response.id}
            response={response}
            showMetadata={showMetadata}
          />
        ))}
      </div>
    </div>
  );
}

// ============ Response Card ============

interface ResponseCardProps {
  response: PollResponse;
  showMetadata: boolean;
}

function ResponseCard({ response, showMetadata }: ResponseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card padding="md" hoverable onClick={() => setIsExpanded(!isExpanded)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B4D7A] to-[#14B8A6] flex items-center justify-center text-white font-medium text-sm">
            {response.respondentId.split("#")[1]?.slice(0, 2) || "?"}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {response.respondentId}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimestamp(response.submittedAt)}
            </p>
          </div>
        </div>
        <ConfidenceBadge level={response.confidence} />
      </div>

      {/* Metadata */}
      {showMetadata && response.metadata && (
        <div className="flex flex-wrap gap-2 mb-3">
          {response.metadata.ageRange && (
            <Badge variant="default" size="sm">
              {response.metadata.ageRange}
            </Badge>
          )}
          {response.metadata.location && (
            <Badge variant="default" size="sm">
              {response.metadata.location}
            </Badge>
          )}
          {response.metadata.verifiedAttributes?.map((attr) => (
            <Badge key={attr} variant="success" size="sm">
              {attr}
            </Badge>
          ))}
        </div>
      )}

      {/* Answers preview / expanded */}
      <div className="space-y-3">
        {(isExpanded ? response.answers : response.answers.slice(0, 2)).map(
          (answer, index) => (
            <div key={answer.questionId}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Q{index + 1}: {answer.questionText}
              </p>
              <p className="text-sm text-gray-900 dark:text-white">
                {formatAnswer(answer)}
              </p>
            </div>
          )
        )}
      </div>

      {/* Expand indicator */}
      {response.answers.length > 2 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button className="text-xs text-[#1B4D7A] dark:text-[#14B8A6] hover:underline flex items-center gap-1">
            {isExpanded ? (
              <>
                Show less
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                Show all {response.answers.length} answers
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </Card>
  );
}

export default ResponseList;
