"use client";

/**
 * ProfileEditor Component
 * Form to edit demographics (age, location, occupation) and preferences
 */

import { useState, useCallback } from "react";
import { Input, Select, Textarea, Checkbox } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

// ============ Types ============

interface ProfileData {
  displayName: string;
  email: string;
  ageRange: string;
  location: string;
  occupation: string;
  bio: string;
  preferences: {
    emailNotifications: boolean;
    pollAlerts: boolean;
    marketingEmails: boolean;
  };
}

interface ProfileEditorProps {
  /** Initial profile data */
  initialData: ProfileData;
  /** Callback when profile is saved */
  onSave: (data: ProfileData) => Promise<void>;
  /** Whether the form is in loading state */
  loading?: boolean;
  /** Additional className */
  className?: string;
}

// ============ Constants ============

const AGE_RANGES = [
  { value: "", label: "Select age range" },
  { value: "18-24", label: "18-24 years" },
  { value: "25-34", label: "25-34 years" },
  { value: "35-44", label: "35-44 years" },
  { value: "45-54", label: "45-54 years" },
  { value: "55-64", label: "55-64 years" },
  { value: "65+", label: "65+ years" },
];

const LOCATIONS = [
  { value: "", label: "Select location" },
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "other", label: "Other" },
];

const OCCUPATIONS = [
  { value: "", label: "Select occupation" },
  { value: "student", label: "Student" },
  { value: "employed", label: "Employed Full-time" },
  { value: "employed_part", label: "Employed Part-time" },
  { value: "self_employed", label: "Self-employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "retired", label: "Retired" },
  { value: "homemaker", label: "Homemaker" },
  { value: "other", label: "Other" },
];

// ============ Component ============

export function ProfileEditor({
  initialData,
  onSave,
  loading = false,
  className = "",
}: ProfileEditorProps) {
  const [formData, setFormData] = useState<ProfileData>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileData, string>>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Handle input changes
  const handleChange = useCallback(
    (field: keyof ProfileData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
      // Clear error on change
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  // Handle preference changes
  const handlePreferenceChange = useCallback(
    (field: keyof ProfileData["preferences"], value: boolean) => {
      setFormData((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, [field]: value },
      }));
      setIsDirty(true);
    },
    []
  );

  // Validate form
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProfileData, string>> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = "Display name is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSave(formData);
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData(initialData);
    setErrors({});
    setIsDirty(false);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {/* Basic Information */}
      <Card padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Basic Information
        </h2>

        <div className="space-y-4">
          <Input
            label="Display Name"
            value={formData.displayName}
            onChange={(e) => handleChange("displayName", e.target.value)}
            error={errors.displayName}
            placeholder="Enter your display name"
          />

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            error={errors.email}
            placeholder="your@email.com"
            helperText="Used for notifications only, not shared publicly"
          />

          <Textarea
            label="Bio"
            value={formData.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
            placeholder="Tell us a bit about yourself (optional)"
            rows={3}
          />
        </div>
      </Card>

      {/* Demographics */}
      <Card padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Demographics
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          This information helps match you with relevant polls. All data is anonymized.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Age Range"
            options={AGE_RANGES}
            value={formData.ageRange}
            onChange={(e) => handleChange("ageRange", e.target.value)}
          />

          <Select
            label="Location"
            options={LOCATIONS}
            value={formData.location}
            onChange={(e) => handleChange("location", e.target.value)}
          />

          <Select
            label="Occupation"
            options={OCCUPATIONS}
            value={formData.occupation}
            onChange={(e) => handleChange("occupation", e.target.value)}
            className="md:col-span-2"
          />
        </div>
      </Card>

      {/* Notification Preferences */}
      <Card padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Notification Preferences
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Choose how you want to be notified about polls and earnings.
        </p>

        <div className="space-y-4">
          <Checkbox
            label="Email Notifications"
            description="Receive email notifications for important updates"
            checked={formData.preferences.emailNotifications}
            onChange={(e) =>
              handlePreferenceChange("emailNotifications", e.target.checked)
            }
          />

          <Checkbox
            label="Poll Alerts"
            description="Get notified when new polls matching your profile are available"
            checked={formData.preferences.pollAlerts}
            onChange={(e) =>
              handlePreferenceChange("pollAlerts", e.target.checked)
            }
          />

          <Checkbox
            label="Marketing Emails"
            description="Receive occasional updates about new features and promotions"
            checked={formData.preferences.marketingEmails}
            onChange={(e) =>
              handlePreferenceChange("marketingEmails", e.target.checked)
            }
          />
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={handleReset}
          disabled={!isDirty || loading}
        >
          Reset Changes
        </Button>

        <Button type="submit" loading={loading} disabled={!isDirty}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}

export default ProfileEditor;
