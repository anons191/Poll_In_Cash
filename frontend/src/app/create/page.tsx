"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreatePoll } from "@/hooks/usePolls";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { RequireWallet } from "@/components/RequireWallet";
import { getContract } from "thirdweb";
import {
  getThirdwebClient,
  baseSepolia,
  USDC_ADDRESS,
  ERC20_ABI,
  formatUsdcAmount,
} from "@/lib/thirdweb";
import type { CreatePollInput, Question, QuestionType } from "@/lib/types";

// Contract addresses
const POLLPOOL_ADDRESS = "0xf6fea61ac2d3bfc57bb63048594a203970580bd6";

interface LocalQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  required: boolean;
}

interface PollFormData {
  title: string;
  description: string;
  objective: string;
  questions: LocalQuestion[];
  targeting: {
    minAge: string;
    maxAge: string;
    verifiedAttributes: string[];
    locations: string[];
  };
  budget: {
    totalAmount: string;
    participantCap: string;
    durationDays: string;
  };
}

const STEPS = [
  { id: 1, name: "Describe", description: "Poll details" },
  { id: 2, name: "Questions", description: "Add questions" },
  { id: 3, name: "Targeting", description: "Set criteria" },
  { id: 4, name: "Budget", description: "Set funding" },
  { id: 5, name: "Review", description: "Confirm & fund" },
];

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ReactNode }[] = [
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    value: "rating",
    label: "Rating (1-5)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    value: "yes_no",
    label: "Yes/No",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    value: "text",
    label: "Free Text",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
  {
    value: "ranking",
    label: "Ranking",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
];

const VERIFIED_ATTRIBUTES = [
  "Veteran",
  "Registered Voter",
  "Homeowner",
  "College Educated",
  "Parent",
  "Healthcare Worker",
  "Business Owner",
  "Student",
];

// ============ Step Components ============

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  currentStep === step.id
                    ? "bg-primary text-white"
                    : currentStep > step.id
                    ? "bg-success text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <div className="mt-2 text-center hidden sm:block">
                <p className={`text-sm font-medium ${currentStep === step.id ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.name}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-12 sm:w-24 h-1 mx-2 rounded ${
                  currentStep > step.id ? "bg-success" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Step1Describe({
  data,
  onChange,
}: {
  data: PollFormData;
  onChange: (data: Partial<PollFormData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Describe your poll</h2>
        <p className="text-muted-foreground">
          Tell us what you want to learn from respondents.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Poll Title
          </label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g., Consumer Technology Preferences 2024"
            className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Description
          </label>
          <textarea
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="A brief description of your poll that will be shown to potential respondents..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            What do you want to learn?
          </label>
          <textarea
            value={data.objective}
            onChange={(e) => onChange({ objective: e.target.value })}
            placeholder="Describe the insights you're hoping to gain from this poll..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>
      </div>
    </div>
  );
}

function Step2Questions({
  data,
  onChange,
}: {
  data: PollFormData;
  onChange: (data: Partial<PollFormData>) => void;
}) {
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>("multiple_choice");

  const addQuestion = () => {
    const newQuestion: LocalQuestion = {
      id: Date.now().toString(),
      type: newQuestionType,
      text: "",
      options: newQuestionType === "multiple_choice" || newQuestionType === "ranking" ? ["", ""] : undefined,
      required: true,
    };
    onChange({ questions: [...data.questions, newQuestion] });
  };

  const updateQuestion = (id: string, updates: Partial<LocalQuestion>) => {
    onChange({
      questions: data.questions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    });
  };

  const removeQuestion = (id: string) => {
    onChange({ questions: data.questions.filter((q) => q.id !== id) });
  };

  const addOption = (questionId: string) => {
    const question = data.questions.find((q) => q.id === questionId);
    if (question && question.options) {
      updateQuestion(questionId, { options: [...question.options, ""] });
    }
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = data.questions.find((q) => q.id === questionId);
    if (question && question.options) {
      const newOptions = [...question.options];
      newOptions[optionIndex] = value;
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = data.questions.find((q) => q.id === questionId);
    if (question && question.options && question.options.length > 2) {
      updateQuestion(questionId, {
        options: question.options.filter((_, i) => i !== optionIndex),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Add questions</h2>
        <p className="text-muted-foreground">
          Create the questions you want respondents to answer.
        </p>
      </div>

      {/* Existing Questions */}
      <div className="space-y-4">
        {data.questions.map((question, index) => (
          <div
            key={question.id}
            className="bg-card border border-border rounded-xl p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                  {index + 1}
                </span>
                <span className="text-sm text-muted-foreground capitalize">
                  {question.type.replace("_", " ")}
                </span>
              </div>
              <button
                onClick={() => removeQuestion(question.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <input
              type="text"
              value={question.text}
              onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
              placeholder="Enter your question..."
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
            />

            {(question.type === "multiple_choice" || question.type === "ranking") && question.options && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Options:</p>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    />
                    {question.options && question.options.length > 2 && (
                      <button
                        onClick={() => removeOption(question.id, optionIndex)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addOption(question.id)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add option
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id={`required-${question.id}`}
                checked={question.required}
                onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                className="rounded border-border"
              />
              <label htmlFor={`required-${question.id}`} className="text-sm text-muted-foreground">
                Required
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Question */}
      <div className="bg-muted/50 border border-dashed border-border rounded-xl p-6">
        <p className="text-sm font-medium text-foreground mb-4">Add a new question</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {QUESTION_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setNewQuestionType(type.value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                newQuestionType === type.value
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
              }`}
            >
              {type.icon}
              <span className="text-xs font-medium">{type.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={addQuestion}
          className="w-full py-3 rounded-xl border border-primary text-primary font-medium hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Question
        </button>
      </div>
    </div>
  );
}

function Step3Targeting({
  data,
  onChange,
}: {
  data: PollFormData;
  onChange: (data: Partial<PollFormData>) => void;
}) {
  const toggleAttribute = (attr: string) => {
    const current = data.targeting.verifiedAttributes;
    const updated = current.includes(attr)
      ? current.filter((a) => a !== attr)
      : [...current, attr];
    onChange({
      targeting: { ...data.targeting, verifiedAttributes: updated },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Set targeting criteria</h2>
        <p className="text-muted-foreground">
          Define who should respond to your poll.
        </p>
      </div>

      <div className="space-y-6">
        {/* Age Range */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Age Range</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Minimum Age</label>
              <input
                type="number"
                value={data.targeting.minAge}
                onChange={(e) =>
                  onChange({
                    targeting: { ...data.targeting, minAge: e.target.value },
                  })
                }
                placeholder="18"
                min="18"
                max="100"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Maximum Age</label>
              <input
                type="number"
                value={data.targeting.maxAge}
                onChange={(e) =>
                  onChange({
                    targeting: { ...data.targeting, maxAge: e.target.value },
                  })
                }
                placeholder="65"
                min="18"
                max="100"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Verified Attributes */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Verified Attributes</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Only users with verified credentials will be eligible.
          </p>
          <div className="flex flex-wrap gap-2">
            {VERIFIED_ATTRIBUTES.map((attr) => (
              <button
                key={attr}
                onClick={() => toggleAttribute(attr)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  data.targeting.verifiedAttributes.includes(attr)
                    ? "bg-accent text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-border"
                }`}
              >
                {attr}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Location</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Optionally restrict to specific regions.
          </p>
          <input
            type="text"
            value={data.targeting.locations.join(", ")}
            onChange={(e) =>
              onChange({
                targeting: {
                  ...data.targeting,
                  locations: e.target.value.split(",").map((l) => l.trim()).filter(Boolean),
                },
              })
            }
            placeholder="e.g., United States, Canada (leave empty for worldwide)"
            className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

function Step4Budget({
  data,
  onChange,
}: {
  data: PollFormData;
  onChange: (data: Partial<PollFormData>) => void;
}) {
  const totalAmount = parseFloat(data.budget.totalAmount) || 0;
  const participantCap = parseInt(data.budget.participantCap) || 0;
  const payoutPerPerson = participantCap > 0 ? (totalAmount * 0.9) / participantCap : 0;
  const platformFee = totalAmount * 0.1;

  // Check if on testnet
  const isTestnet = baseSepolia.testnet === true;

  // Get USDC balance
  const account = useActiveAccount();
  const client = getThirdwebClient();
  const usdcContract = getContract({
    client,
    chain: baseSepolia,
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
  });

  const { data: usdcBalance } = useReadContract({
    contract: usdcContract,
    method: "balanceOf",
    params: account?.address ? [account.address] as const : ["0x0000000000000000000000000000000000000000"] as const,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Set your budget</h2>
        <p className="text-muted-foreground">
          Determine the funding amount and participant cap for this poll.
        </p>
      </div>

      {/* Testnet USDC Info */}
      {isTestnet && (
        <div className="bg-gray-800 border border-yellow-600/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-yellow-500 font-medium text-sm">Base Sepolia Testnet</p>
              <p className="text-gray-400 text-sm mt-1">
                Current USDC Balance: <span className="text-white font-medium">{usdcBalance ? formatUsdcAmount(usdcBalance) : "0.00"} USDC</span>
              </p>
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mint Test USDC for testing
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Budget Settings */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Total Budget (USDC)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                type="number"
                value={data.budget.totalAmount}
                onChange={(e) =>
                  onChange({
                    budget: { ...data.budget, totalAmount: e.target.value },
                  })
                }
                placeholder="100"
                min="10"
                step="10"
                className="w-full pl-8 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Participant Cap
            </label>
            <input
              type="number"
              value={data.budget.participantCap}
              onChange={(e) =>
                onChange({
                  budget: { ...data.budget, participantCap: e.target.value },
                })
              }
              placeholder="50"
              min="1"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Maximum number of responses to collect
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Duration (Days)
            </label>
            <input
              type="number"
              value={data.budget.durationDays}
              onChange={(e) =>
                onChange({
                  budget: { ...data.budget, durationDays: e.target.value },
                })
              }
              placeholder="7"
              min="1"
              max="30"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Poll will close automatically after this period
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-card border border-border rounded-xl p-6 h-fit">
          <h3 className="text-lg font-semibold text-foreground mb-4">Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Budget</span>
              <span className="font-semibold text-foreground">
                ${totalAmount.toFixed(2)} USDC
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Platform Fee (10%)</span>
              <span className="text-muted-foreground">-${platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Distributable Pool</span>
              <span className="text-foreground">${(totalAmount - platformFee).toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Participants</span>
                <span className="text-foreground">{participantCap || "-"}</span>
              </div>
            </div>
            <div className="bg-accent/10 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-accent font-medium">Payout per person</span>
                <span className="text-2xl font-bold text-accent">
                  ${payoutPerPerson.toFixed(2)}
                </span>
              </div>
            </div>
            {payoutPerPerson > 0 && payoutPerPerson < 0.5 && (
              <p className="text-sm text-warning">
                Low payout may result in fewer responses. Consider increasing your budget or reducing participants.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step5Review({
  data,
}: {
  data: PollFormData;
}) {
  const totalAmount = parseFloat(data.budget.totalAmount) || 0;
  const participantCap = parseInt(data.budget.participantCap) || 0;
  const payoutPerPerson = participantCap > 0 ? (totalAmount * 0.9) / participantCap : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Review and fund</h2>
        <p className="text-muted-foreground">
          Confirm your poll details before publishing.
        </p>
      </div>

      <div className="space-y-6">
        {/* Poll Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Poll Details</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Title</p>
              <p className="font-medium text-foreground">{data.title || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-foreground">{data.description || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Objective</p>
              <p className="text-foreground">{data.objective || "-"}</p>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Questions ({data.questions.length})
          </h3>
          {data.questions.length === 0 ? (
            <p className="text-muted-foreground">No questions added</p>
          ) : (
            <div className="space-y-3">
              {data.questions.map((q, i) => (
                <div key={q.id} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{q.text || "Untitled question"}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {q.type.replace("_", " ")}
                      {q.required && " (required)"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Targeting */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Targeting</h3>
          <div className="space-y-3">
            <div className="flex gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Age Range</p>
                <p className="font-medium text-foreground">
                  {data.targeting.minAge || "18"} - {data.targeting.maxAge || "65"}
                </p>
              </div>
            </div>
            {data.targeting.verifiedAttributes.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Verified Attributes</p>
                <div className="flex flex-wrap gap-2">
                  {data.targeting.verifiedAttributes.map((attr) => (
                    <span
                      key={attr}
                      className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm"
                    >
                      {attr}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.targeting.locations.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Locations</p>
                <p className="font-medium text-foreground">
                  {data.targeting.locations.join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Budget Summary */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Funding Summary</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-bold text-foreground">${totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Participants</p>
              <p className="text-2xl font-bold text-foreground">{participantCap}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payout per person</p>
              <p className="text-2xl font-bold text-success">${payoutPerPerson.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Duration: {data.budget.durationDays || "7"} days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Error Banner ============

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-destructive mt-0.5"
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
          <div>
            <p className="font-medium text-destructive">Failed to create poll</p>
            <p className="text-sm text-destructive/80">{message}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-destructive hover:text-destructive/80 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============ Main Page Component ============

export default function CreatePollPage() {
  const router = useRouter();
  const { create, isCreating, error, reset } = useCreatePoll();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PollFormData>({
    title: "",
    description: "",
    objective: "",
    questions: [],
    targeting: {
      minAge: "",
      maxAge: "",
      verifiedAttributes: [],
      locations: [],
    },
    budget: {
      totalAmount: "",
      participantCap: "",
      durationDays: "7",
    },
  });

  const updateFormData = (updates: Partial<PollFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.title.trim() !== "";
      case 2:
        return formData.questions.length > 0 && formData.questions.every((q) => q.text.trim() !== "");
      case 3:
        return true;
      case 4:
        return parseFloat(formData.budget.totalAmount) >= 10 && parseInt(formData.budget.participantCap) >= 1;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    // Convert form data to API format (backend schema)
    const totalAmount = parseFloat(formData.budget.totalAmount) || 0;
    const participantCap = parseInt(formData.budget.participantCap) || 0;
    const durationDays = parseInt(formData.budget.durationDays) || 7;

    // Map frontend question types to backend types
    const mapQuestionType = (type: QuestionType): string => {
      const typeMap: Record<string, string> = {
        single_choice: "multiple_choice",
        multiple_choice: "multiple_choice",
        text: "short_text",
        rating: "rating_scale",
        scale: "rating_scale",
        yes_no: "yes_no",
        ranking: "ranking",
      };
      return typeMap[type] || "multiple_choice";
    };

    // Build backend-compatible payload
    const pollData = {
      title: formData.title,
      description: formData.description || undefined,
      questions: formData.questions.map((q, index) => ({
        id: q.id || `q_${index + 1}`,
        text: q.text,
        type: mapQuestionType(q.type),
        required: q.required,
        options: q.options?.filter(Boolean),
      })),
      criteria: {
        minAge: formData.targeting.minAge ? parseInt(formData.targeting.minAge) : undefined,
        maxAge: formData.targeting.maxAge ? parseInt(formData.targeting.maxAge) : undefined,
        states: formData.targeting.locations.length > 0
          ? formData.targeting.locations.filter(l => l.length === 2) // Only 2-letter state codes
          : undefined,
        // Map verified attributes to backend criteria
        isVeteran: formData.targeting.verifiedAttributes.includes("Veteran") || undefined,
        isRegisteredVoter: formData.targeting.verifiedAttributes.includes("Registered Voter") || undefined,
      },
      cashPoolUsdc: totalAmount.toFixed(6),
      participantCap,
      visibility: "public" as const,
      expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      const poll = await create(pollData as unknown as CreatePollInput);
      router.push(`/polls/${poll.id}`);
    } catch (err) {
      // Error is handled by the hook and displayed via the error state
      console.error("Failed to create poll:", err);
    }
  };

  return (
    <RequireWallet
      title="Connect to Create Polls"
      description="Connect your wallet to create and fund polls on Poll in Cash."
    >
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Create a Poll</h1>
          <p className="text-gray-400 mt-1">Or let your agent do it via the skill.md API</p>
        </div>

        {/* Agent-First Header */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-8">
          <p className="text-gray-300 text-sm">
            <span className="text-teal-400 font-medium">Tip:</span> Your agent can create polls for you.
            Just say: &quot;Create a poll about X targeting Y with a $Z budget&quot; — your agent handles everything.
          </p>
        </div>

        {/* Error Banner */}
        {error && <ErrorBanner message={error} onDismiss={reset} />}

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 1 && (
            <Step1Describe data={formData} onChange={updateFormData} />
          )}
          {currentStep === 2 && (
            <Step2Questions data={formData} onChange={updateFormData} />
          )}
          {currentStep === 3 && (
            <Step3Targeting data={formData} onChange={updateFormData} />
          )}
          {currentStep === 4 && (
            <Step4Budget data={formData} onChange={updateFormData} />
          )}
          {currentStep === 5 && <Step5Review data={formData} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || isCreating}
            className="px-6 py-3 rounded-xl text-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          {currentStep < 5 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
              disabled={!canProceed()}
              className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isCreating}
              className="px-6 py-3 rounded-xl bg-success text-white font-medium hover:bg-success/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
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
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Fund & Publish Poll
                </>
              )}
            </button>
          )}
        </div>

        {/* Contract Info Footer */}
        <div className="text-xs text-gray-500 mt-8 text-center">
          <p>Contract: 0xf6fea61ac2d3bfc57bb63048594a203970580bd6 on Base Sepolia</p>
          <p>USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (6 decimals)</p>
          <a
            href="https://sepolia.basescan.org/address/0xf6fea61ac2d3bfc57bb63048594a203970580bd6"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 hover:underline"
          >
            View on BaseScan
          </a>
        </div>
      </div>
    </div>
    </RequireWallet>
  );
}
