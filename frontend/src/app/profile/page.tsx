"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RequireWallet } from "@/components/RequireWallet";
import { useProfile, useEarnings, useAgentPreferences } from "@/hooks/useProfile";
import type { Profile, Earning, AgentPreferences } from "@/lib/types";

// ============ Skeleton Components ============

function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className}`} />;
}

function ProfileHeaderSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <SkeletonBox className="w-20 h-20 rounded-2xl" />
        <div className="flex-1">
          <SkeletonBox className="h-8 w-32 mb-2" />
          <SkeletonBox className="h-4 w-40 mb-2" />
          <SkeletonBox className="h-4 w-32" />
        </div>
        <div className="bg-muted rounded-xl p-4 w-40">
          <SkeletonBox className="h-4 w-24 mb-2" />
          <SkeletonBox className="h-8 w-28" />
        </div>
      </div>
    </div>
  );
}

function AttributesSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <SkeletonBox className="h-6 w-36 mb-2" />
          <SkeletonBox className="h-4 w-64" />
        </div>
        <SkeletonBox className="h-10 w-20 rounded-lg" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <SkeletonBox className="h-4 w-16 mb-2" />
            <SkeletonBox className="h-6 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentSettingsSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-6">
        <SkeletonBox className="h-6 w-40 mb-2" />
        <SkeletonBox className="h-4 w-64" />
      </div>
      <div className="space-y-6">
        <div>
          <SkeletonBox className="h-4 w-24 mb-3" />
          <div className="flex gap-3">
            <SkeletonBox className="flex-1 h-24 rounded-xl" />
            <SkeletonBox className="flex-1 h-24 rounded-xl" />
          </div>
        </div>
        <div>
          <SkeletonBox className="h-4 w-36 mb-2" />
          <SkeletonBox className="h-10 w-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function EarningsHistorySkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <SkeletonBox className="h-6 w-36 mb-2" />
          <SkeletonBox className="h-4 w-48" />
        </div>
        <div className="text-right">
          <SkeletonBox className="h-4 w-24 mb-1" />
          <SkeletonBox className="h-6 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div>
              <SkeletonBox className="h-5 w-32 mb-1" />
              <SkeletonBox className="h-4 w-24" />
            </div>
            <SkeletonBox className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <SkeletonBox className="h-5 w-36 mb-4" />
        </div>
        <div className="space-y-6">
          <ProfileHeaderSkeleton />
          <AttributesSkeleton />
          <AgentSettingsSkeleton />
          <EarningsHistorySkeleton />
        </div>
      </div>
    </div>
  );
}

// ============ Error State ============

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ============ Constants ============

const AVAILABLE_VERIFICATIONS = [
  { name: "Veteran", description: "Verify military service status", icon: "shield" },
  { name: "College Student", description: "Verify current enrollment", icon: "academic" },
  { name: "Healthcare Worker", description: "Verify medical profession", icon: "medical" },
  { name: "Business Owner", description: "Verify business ownership", icon: "briefcase" },
  { name: "Parent", description: "Verify parental status", icon: "users" },
];

const TOPIC_OPTIONS = [
  "Politics",
  "Religion",
  "Health",
  "Finance",
  "Technology",
  "Entertainment",
  "Sports",
  "Travel",
  "Food",
  "Fashion",
];

// ============ Data Components ============

function ProfileHeader({ profile }: { profile: Profile }) {
  const shortenAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const totalEarnings = parseFloat(profile.totalEarnings) || 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <span className="text-3xl font-bold text-white">
            {profile.walletAddress.slice(2, 4).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {profile.displayName || "Your Profile"}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            {shortenAddress(profile.walletAddress)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Member since {formatDate(profile.createdAt)}
          </p>
        </div>

        {/* Wallet Balance */}
        <div className="bg-muted rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Total Earnings</p>
          <p className="text-2xl font-bold text-foreground">
            ${totalEarnings.toFixed(2)}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              USDC
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function AttributesSection({
  profile,
  onUpdate,
  isUpdating,
}: {
  profile: Profile;
  onUpdate: (updates: { displayName?: string; email?: string; bio?: string }) => Promise<void>;
  isUpdating: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: profile.displayName || "",
    email: profile.email || "",
    bio: profile.bio || "",
  });

  useEffect(() => {
    setEditData({
      displayName: profile.displayName || "",
      email: profile.email || "",
      bio: profile.bio || "",
    });
  }, [profile]);

  const handleSave = async () => {
    await onUpdate(editData);
    setIsEditing(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Profile Information
          </h2>
          <p className="text-sm text-muted-foreground">
            Your basic profile information
          </p>
        </div>
        <button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          disabled={isUpdating}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            isEditing
              ? "bg-success text-white hover:bg-success/90"
              : "bg-muted text-foreground hover:bg-border"
          }`}
        >
          {isUpdating ? "Saving..." : isEditing ? "Save Changes" : "Edit"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-2">
            Display Name
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editData.displayName}
              onChange={(e) =>
                setEditData({ ...editData, displayName: e.target.value })
              }
              placeholder="Enter your name"
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <p className="text-foreground font-medium">
              {profile.displayName || "Not set"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">
            Email
          </label>
          {isEditing ? (
            <input
              type="email"
              value={editData.email}
              onChange={(e) =>
                setEditData({ ...editData, email: e.target.value })
              }
              placeholder="Enter your email"
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <p className="text-foreground font-medium">
              {profile.email || "Not set"}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm text-muted-foreground mb-2">Bio</label>
          {isEditing ? (
            <textarea
              value={editData.bio}
              onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
              placeholder="Tell us about yourself"
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          ) : (
            <p className="text-foreground">
              {profile.bio || "No bio provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">
            Polls Created
          </label>
          <p className="text-foreground font-medium">{profile.pollsCreated}</p>
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">
            Polls Completed
          </label>
          <p className="text-foreground font-medium">{profile.pollsCompleted}</p>
        </div>
      </div>
    </div>
  );
}

function VerifiedAttributesSection() {
  // TODO: This would come from a separate API endpoint in a real implementation
  const verifiedAttributes: { name: string; verifiedAt: string; provider: string }[] = [];
  const pendingVerifications: { name: string; status: string }[] = [];

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          Verified Attributes
        </h2>
        <p className="text-sm text-muted-foreground">
          Cryptographically verified credentials that unlock premium polls
        </p>
      </div>

      {/* Verified */}
      <div className="space-y-3 mb-6">
        {verifiedAttributes.length === 0 && pendingVerifications.length === 0 && (
          <div className="text-center py-6">
            <p className="text-muted-foreground">No verified attributes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add verifications to unlock premium polls
            </p>
          </div>
        )}

        {verifiedAttributes.map((attr) => (
          <div
            key={attr.name}
            className="flex items-center justify-between bg-success/5 border border-success/20 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-success"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">{attr.name}</p>
                <p className="text-sm text-muted-foreground">
                  Verified via {attr.provider} on {attr.verifiedAt}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
              Verified
            </span>
          </div>
        ))}

        {pendingVerifications.map((attr) => (
          <div
            key={attr.name}
            className="flex items-center justify-between bg-warning/5 border border-warning/20 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-warning animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">{attr.name}</p>
                <p className="text-sm text-muted-foreground">
                  Verification in progress...
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-warning/10 text-warning text-sm font-medium">
              Pending
            </span>
          </div>
        ))}
      </div>

      {/* Available Verifications */}
      <div>
        <p className="text-sm font-medium text-foreground mb-3">
          Add More Verifications
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {AVAILABLE_VERIFICATIONS.filter(
            (v) =>
              !verifiedAttributes.find((va) => va.name === v.name) &&
              !pendingVerifications.find((pv) => pv.name === v.name)
          ).map((verification) => (
            <button
              key={verification.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-muted hover:bg-border transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">{verification.name}</p>
                <p className="text-sm text-muted-foreground">
                  {verification.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentSettingsSection({
  preferences,
  onUpdate,
  isSaving,
}: {
  preferences: AgentPreferences | null;
  onUpdate: (updates: Partial<AgentPreferences>) => Promise<void>;
  isSaving: boolean;
}) {
  const [settings, setSettings] = useState<AgentPreferences>(
    preferences || {
      enabled: false,
      categories: [],
      minPayout: "0.10",
      maxDailyPolls: 50,
      excludedTopics: [],
    }
  );

  useEffect(() => {
    if (preferences) {
      setSettings(preferences);
    }
  }, [preferences]);

  const handleModeChange = async (enabled: boolean) => {
    setSettings({ ...settings, enabled });
    await onUpdate({ enabled });
  };

  const toggleExcludedTopic = async (topic: string) => {
    const newExcluded = settings.excludedTopics.includes(topic)
      ? settings.excludedTopics.filter((t) => t !== topic)
      : [...settings.excludedTopics, topic];
    setSettings({ ...settings, excludedTopics: newExcluded });
    await onUpdate({ excludedTopics: newExcluded });
  };

  const handleMinPayoutChange = async (value: string) => {
    setSettings({ ...settings, minPayout: value });
  };

  const handleMinPayoutBlur = async () => {
    await onUpdate({ minPayout: settings.minPayout });
  };

  const handleMaxDailyPollsChange = async (value: string) => {
    const numValue = parseInt(value) || 0;
    setSettings({ ...settings, maxDailyPolls: numValue });
  };

  const handleMaxDailyPollsBlur = async () => {
    await onUpdate({ maxDailyPolls: settings.maxDailyPolls });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          Agent Preferences
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure how your AI agent finds and responds to polls
        </p>
      </div>

      <div className="space-y-6">
        {/* Auto/Manual Mode */}
        <div>
          <p className="text-sm font-medium text-foreground mb-3">Agent Mode</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleModeChange(true)}
              disabled={isSaving}
              className={`flex-1 p-4 rounded-xl border transition-colors disabled:opacity-50 ${
                settings.enabled
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span className="font-medium">Automatic</span>
              </div>
              <p className="text-sm opacity-80">
                Agent responds to matching polls automatically
              </p>
            </button>
            <button
              onClick={() => handleModeChange(false)}
              disabled={isSaving}
              className={`flex-1 p-4 rounded-xl border transition-colors disabled:opacity-50 ${
                !settings.enabled
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span className="font-medium">Manual</span>
              </div>
              <p className="text-sm opacity-80">
                Review and approve each poll before responding
              </p>
            </button>
          </div>
        </div>

        {/* Minimum Payout */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Minimum Payout Threshold
          </label>
          <div className="relative w-full max-w-xs">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <input
              type="number"
              value={settings.minPayout}
              onChange={(e) => handleMinPayoutChange(e.target.value)}
              onBlur={handleMinPayoutBlur}
              step="0.10"
              min="0"
              disabled={isSaving}
              className="w-full pl-8 pr-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Only participate in polls paying at least this amount
          </p>
        </div>

        {/* Max Polls Per Day */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Maximum Polls Per Day
          </label>
          <input
            type="number"
            value={settings.maxDailyPolls}
            onChange={(e) => handleMaxDailyPollsChange(e.target.value)}
            onBlur={handleMaxDailyPollsBlur}
            min="1"
            max="100"
            disabled={isSaving}
            className="w-full max-w-xs px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <p className="text-sm text-muted-foreground mt-2">
            Limit how many polls your agent responds to daily
          </p>
        </div>

        {/* Excluded Topics */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Excluded Topics
          </label>
          <div className="flex flex-wrap gap-2">
            {TOPIC_OPTIONS.map((topic) => (
              <button
                key={topic}
                onClick={() => toggleExcludedTopic(topic)}
                disabled={isSaving}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
                  settings.excludedTopics.includes(topic)
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {settings.excludedTopics.includes(topic) && (
                  <span className="mr-1">x</span>
                )}
                {topic}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Your agent will not respond to polls about these topics
          </p>
        </div>
      </div>
    </div>
  );
}

function EarningsHistorySection({
  earnings,
  isLoading,
  summary,
}: {
  earnings: Earning[];
  isLoading: boolean;
  summary: {
    total: number;
    pending: number;
    paid: number;
    thisWeek: number;
    thisMonth: number;
  };
}) {
  if (isLoading) {
    return <EarningsHistorySkeleton />;
  }

  // Group earnings by month
  const earningsByMonth = earnings.reduce(
    (acc, earning) => {
      const date = new Date(earning.createdAt);
      const monthKey = `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { amount: 0, count: 0 };
      }
      acc[monthKey].amount += parseFloat(earning.amount) || 0;
      acc[monthKey].count += 1;
      return acc;
    },
    {} as Record<string, { amount: number; count: number }>
  );

  const monthlyEarnings = Object.entries(earningsByMonth)
    .map(([month, data]) => ({ month, ...data }))
    .slice(0, 6);

  const totalPollCount = earnings.length;
  const avgPerPoll = totalPollCount > 0 ? summary.total / totalPollCount : 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Earnings History
          </h2>
          <p className="text-sm text-muted-foreground">
            Your earnings over the past months
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Earnings</p>
          <p className="text-xl font-bold text-success">
            ${summary.total.toFixed(2)}
          </p>
        </div>
      </div>

      {monthlyEarnings.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No earnings yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Complete polls to start earning
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {monthlyEarnings.map((month) => (
              <div
                key={month.month}
                className="flex items-center justify-between p-4 bg-muted rounded-xl"
              >
                <div>
                  <p className="font-medium text-foreground">{month.month}</p>
                  <p className="text-sm text-muted-foreground">
                    {month.count} polls completed
                  </p>
                </div>
                <p className="font-semibold text-success">
                  ${month.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalPollCount}
                </p>
                <p className="text-sm text-muted-foreground">Total Polls</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  ${avgPerPoll.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Avg. per Poll</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ Main Page Component ============

export default function ProfilePage() {
  const { profile, isLoading, error, refetch, update, isUpdating } = useProfile();
  const { earnings, isLoading: earningsLoading, summary: earningsSummary } = useEarnings();
  const { preferences, updatePreferences, isSaving } = useAgentPreferences();

  const handleProfileUpdate = async (updates: {
    displayName?: string;
    email?: string;
    bio?: string;
  }) => {
    try {
      await update(updates);
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  const handleAgentPreferencesUpdate = async (
    updates: Partial<AgentPreferences>
  ) => {
    try {
      await updatePreferences(updates);
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  };

  // Show loading state
  if (isLoading && !profile) {
    return <ProfilePageSkeleton />;
  }

  // Show error state
  if (error && !profile) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  // If no profile after loading, show setup prompt
  if (!profile) {
    return (
      <RequireWallet
        title="Connect to View Profile"
        description="Connect your wallet to view and manage your profile settings."
      >
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Profile Not Found
            </h2>
            <p className="text-muted-foreground mb-6">
              Your profile is being set up. Please wait a moment and refresh.
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </RequireWallet>
    );
  }

  return (
    <RequireWallet
      title="Connect to View Profile"
      description="Connect your wallet to view and manage your profile settings."
    >
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="space-y-6">
          <ProfileHeader profile={profile} />
          <AttributesSection
            profile={profile}
            onUpdate={handleProfileUpdate}
            isUpdating={isUpdating}
          />
          <VerifiedAttributesSection />
          <AgentSettingsSection
            preferences={preferences}
            onUpdate={handleAgentPreferencesUpdate}
            isSaving={isSaving}
          />
          <EarningsHistorySection
            earnings={earnings}
            isLoading={earningsLoading}
            summary={earningsSummary}
          />
        </div>
      </div>
    </div>
    </RequireWallet>
  );
}
