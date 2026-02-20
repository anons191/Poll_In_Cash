"use client";

/**
 * CriteriaSelector Component
 * Targeting criteria with checkboxes (age ranges, locations) and
 * dropdowns (verified attributes like veteran, voter, student)
 */

import { useCallback } from "react";
import { Checkbox, Select } from "../ui/Input";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

// ============ Types ============

interface CriteriaConfig {
  ageRanges: string[];
  locations: string[];
  verifiedAttributes: string[];
}

interface CriteriaSelectorProps {
  /** Selected criteria */
  criteria: CriteriaConfig;
  /** Callback when criteria change */
  onChange: (criteria: CriteriaConfig) => void;
  /** Additional className */
  className?: string;
}

// ============ Constants ============

const AGE_RANGES = [
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55-64", label: "55-64" },
  { value: "65+", label: "65+" },
];

const LOCATIONS = [
  { value: "us", label: "United States" },
  { value: "us-ca", label: "California, US" },
  { value: "us-ny", label: "New York, US" },
  { value: "us-tx", label: "Texas, US" },
  { value: "us-fl", label: "Florida, US" },
  { value: "uk", label: "United Kingdom" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
];

const VERIFIED_ATTRIBUTES = [
  { value: "veteran", label: "Military Veteran", icon: "shield" },
  { value: "voter", label: "Registered Voter", icon: "check-badge" },
  { value: "student", label: "Student", icon: "academic-cap" },
  { value: "homeowner", label: "Homeowner", icon: "home" },
  { value: "parent", label: "Parent", icon: "users" },
  { value: "employed", label: "Employed", icon: "briefcase" },
  { value: "healthcare_worker", label: "Healthcare Worker", icon: "heart" },
  { value: "educator", label: "Educator", icon: "book-open" },
];

// ============ Component ============

export function CriteriaSelector({
  criteria,
  onChange,
  className = "",
}: CriteriaSelectorProps) {
  // Toggle age range
  const toggleAgeRange = useCallback(
    (value: string) => {
      const newAgeRanges = criteria.ageRanges.includes(value)
        ? criteria.ageRanges.filter((v) => v !== value)
        : [...criteria.ageRanges, value];
      onChange({ ...criteria, ageRanges: newAgeRanges });
    },
    [criteria, onChange]
  );

  // Toggle location
  const toggleLocation = useCallback(
    (value: string) => {
      const newLocations = criteria.locations.includes(value)
        ? criteria.locations.filter((v) => v !== value)
        : [...criteria.locations, value];
      onChange({ ...criteria, locations: newLocations });
    },
    [criteria, onChange]
  );

  // Toggle verified attribute
  const toggleAttribute = useCallback(
    (value: string) => {
      const newAttributes = criteria.verifiedAttributes.includes(value)
        ? criteria.verifiedAttributes.filter((v) => v !== value)
        : [...criteria.verifiedAttributes, value];
      onChange({ ...criteria, verifiedAttributes: newAttributes });
    },
    [criteria, onChange]
  );

  // Select all age ranges
  const selectAllAges = useCallback(() => {
    const allAges = AGE_RANGES.map((a) => a.value);
    const hasAll = allAges.every((a) => criteria.ageRanges.includes(a));
    onChange({
      ...criteria,
      ageRanges: hasAll ? [] : allAges,
    });
  }, [criteria, onChange]);

  // Count selected criteria
  const selectedCount =
    criteria.ageRanges.length +
    criteria.locations.length +
    criteria.verifiedAttributes.length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
            Targeting:
          </span>
          {criteria.ageRanges.map((age) => (
            <Badge key={age} variant="primary" size="sm">
              {age} years
            </Badge>
          ))}
          {criteria.locations.map((loc) => (
            <Badge key={loc} variant="info" size="sm">
              {LOCATIONS.find((l) => l.value === loc)?.label || loc}
            </Badge>
          ))}
          {criteria.verifiedAttributes.map((attr) => (
            <Badge key={attr} variant="success" size="sm">
              {VERIFIED_ATTRIBUTES.find((a) => a.value === attr)?.label || attr}
            </Badge>
          ))}
        </div>
      )}

      {/* Age Ranges */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Age Range
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select age groups to target
            </p>
          </div>
          <button
            onClick={selectAllAges}
            className="text-xs font-medium text-[#1B4D7A] dark:text-[#14B8A6] hover:underline"
          >
            {criteria.ageRanges.length === AGE_RANGES.length
              ? "Deselect all"
              : "Select all"}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {AGE_RANGES.map((age) => (
            <Checkbox
              key={age.value}
              label={age.label}
              checked={criteria.ageRanges.includes(age.value)}
              onChange={() => toggleAgeRange(age.value)}
            />
          ))}
        </div>
      </Card>

      {/* Locations */}
      <Card padding="md">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Location
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select locations to target (leave empty for worldwide)
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {LOCATIONS.map((location) => (
            <Checkbox
              key={location.value}
              label={location.label}
              checked={criteria.locations.includes(location.value)}
              onChange={() => toggleLocation(location.value)}
            />
          ))}
        </div>
      </Card>

      {/* Verified Attributes */}
      <Card padding="md">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Verified Attributes
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Require specific verified credentials (optional)
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VERIFIED_ATTRIBUTES.map((attr) => (
            <div
              key={attr.value}
              onClick={() => toggleAttribute(attr.value)}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                criteria.verifiedAttributes.includes(attr.value)
                  ? "border-[#1B4D7A] bg-[#1B4D7A]/5 dark:border-[#14B8A6] dark:bg-[#14B8A6]/5"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  criteria.verifiedAttributes.includes(attr.value)
                    ? "bg-[#1B4D7A]/10 dark:bg-[#14B8A6]/10"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}
              >
                <AttributeIcon
                  icon={attr.icon}
                  active={criteria.verifiedAttributes.includes(attr.value)}
                />
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    criteria.verifiedAttributes.includes(attr.value)
                      ? "text-[#1B4D7A] dark:text-[#14B8A6]"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {attr.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Verified credential required
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============ Attribute Icon ============

interface AttributeIconProps {
  icon: string;
  active: boolean;
}

function AttributeIcon({ icon, active }: AttributeIconProps) {
  const color = active
    ? "text-[#1B4D7A] dark:text-[#14B8A6]"
    : "text-gray-400";

  const icons: Record<string, React.ReactNode> = {
    shield: (
      <svg
        className={`w-5 h-5 ${color}`}
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
    ),
    "check-badge": (
      <svg
        className={`w-5 h-5 ${color}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
    ),
    "academic-cap": (
      <svg
        className={`w-5 h-5 ${color}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
        />
      </svg>
    ),
    home: (
      <svg
        className={`w-5 h-5 ${color}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
    users: (
      <svg
        className={`w-5 h-5 ${color}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
    briefcase: (
      <svg
        className={`w-5 h-5 ${color}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    heart: (
      <svg
        className={`w-5 h-5 ${color}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
    "book-open": (
      <svg
        className={`w-5 h-5 ${color}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  };

  return icons[icon] || null;
}

export default CriteriaSelector;
