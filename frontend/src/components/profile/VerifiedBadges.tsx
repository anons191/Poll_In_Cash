"use client";

/**
 * VerifiedBadges Component
 * Grid of verified attribute badges with verification date and issuer
 */

import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

// ============ Types ============

interface VerifiedAttribute {
  id: string;
  type: string;
  label: string;
  verifiedAt: Date | string;
  issuer: string;
  expiresAt?: Date | string;
}

interface VerifiedBadgesProps {
  /** List of verified attributes */
  attributes: VerifiedAttribute[];
  /** Available attributes that can be verified */
  availableAttributes?: { type: string; label: string }[];
  /** Callback when user wants to verify an attribute */
  onVerify?: (type: string) => void;
  /** Additional className */
  className?: string;
}

// ============ Badge Icons ============

const attributeIcons: Record<string, React.ReactNode> = {
  veteran: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  voter: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    </svg>
  ),
  student: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
      />
    </svg>
  ),
  homeowner: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  parent: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
  employed: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  healthcare_worker: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  ),
  educator: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  ),
};

// ============ Helper Functions ============

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(date?: Date | string): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d < new Date();
}

function isExpiringSoon(date?: Date | string): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return d < thirtyDaysFromNow && d > new Date();
}

// ============ Component ============

export function VerifiedBadges({
  attributes,
  availableAttributes = [],
  onVerify,
  className = "",
}: VerifiedBadgesProps) {
  // Filter available attributes that haven't been verified yet
  const unverifiedAttributes = availableAttributes.filter(
    (attr) => !attributes.some((a) => a.type === attr.type)
  );

  if (attributes.length === 0 && unverifiedAttributes.length === 0) {
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
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          No verified badges
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Verify your credentials to unlock more poll opportunities.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Verified Badges */}
      {attributes.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Verified Credentials ({attributes.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {attributes.map((attr) => (
              <VerifiedBadgeCard key={attr.id} attribute={attr} />
            ))}
          </div>
        </div>
      )}

      {/* Available to Verify */}
      {unverifiedAttributes.length > 0 && onVerify && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Available to Verify
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unverifiedAttributes.map((attr) => (
              <UnverifiedBadgeCard
                key={attr.type}
                type={attr.type}
                label={attr.label}
                onVerify={() => onVerify(attr.type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Verified Badge Card ============

interface VerifiedBadgeCardProps {
  attribute: VerifiedAttribute;
}

function VerifiedBadgeCard({ attribute }: VerifiedBadgeCardProps) {
  const expired = isExpired(attribute.expiresAt);
  const expiringSoon = isExpiringSoon(attribute.expiresAt);

  return (
    <Card
      padding="md"
      className={expired ? "opacity-60" : ""}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            expired
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400"
              : "bg-[#22C55E]/10 text-[#22C55E]"
          }`}
        >
          {attributeIcons[attribute.type] || (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {attribute.label}
            </h4>
            {expired ? (
              <Badge variant="danger" size="sm">
                Expired
              </Badge>
            ) : expiringSoon ? (
              <Badge variant="warning" size="sm">
                Expiring
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                Verified
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Issued by {attribute.issuer}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Verified {formatDate(attribute.verifiedAt)}
            {attribute.expiresAt && (
              <> | Expires {formatDate(attribute.expiresAt)}</>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============ Unverified Badge Card ============

interface UnverifiedBadgeCardProps {
  type: string;
  label: string;
  onVerify: () => void;
}

function UnverifiedBadgeCard({ type, label, onVerify }: UnverifiedBadgeCardProps) {
  return (
    <Card padding="md" className="border-dashed">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
          {attributeIcons[type] || (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {label}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Not yet verified
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onVerify}
            className="mt-2"
          >
            Verify Now
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default VerifiedBadges;
