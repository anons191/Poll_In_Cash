"use client";

/**
 * QuestionBuilder Component
 * Add/remove/reorder questions with drag handle, question type selector,
 * options editor for multiple choice
 */

import { useState, useCallback } from "react";
import { Button, IconButton } from "../ui/Button";
import { Input, Textarea, Select } from "../ui/Input";
import { Card } from "../ui/Card";

// ============ Types ============

type QuestionType = "multiple_choice" | "rating" | "yes_no" | "text" | "ranking";

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  required: boolean;
  options?: QuestionOption[];
  minRating?: number;
  maxRating?: number;
}

interface QuestionBuilderProps {
  /** Initial questions */
  questions: Question[];
  /** Callback when questions change */
  onChange: (questions: Question[]) => void;
  /** Maximum number of questions allowed */
  maxQuestions?: number;
  /** Additional className */
  className?: string;
}

// ============ Question Type Options ============

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "rating", label: "Rating Scale" },
  { value: "yes_no", label: "Yes/No" },
  { value: "text", label: "Open Text" },
  { value: "ranking", label: "Ranking" },
];

// ============ Helper Functions ============

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function createDefaultQuestion(): Question {
  return {
    id: generateId(),
    type: "multiple_choice",
    text: "",
    required: true,
    options: [
      { id: generateId(), text: "" },
      { id: generateId(), text: "" },
    ],
  };
}

// ============ Component ============

export function QuestionBuilder({
  questions,
  onChange,
  maxQuestions = 20,
  className = "",
}: QuestionBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Add new question
  const addQuestion = useCallback(() => {
    if (questions.length >= maxQuestions) return;
    onChange([...questions, createDefaultQuestion()]);
  }, [questions, onChange, maxQuestions]);

  // Remove question
  const removeQuestion = useCallback(
    (id: string) => {
      onChange(questions.filter((q) => q.id !== id));
    },
    [questions, onChange]
  );

  // Update question
  const updateQuestion = useCallback(
    (id: string, updates: Partial<Question>) => {
      onChange(
        questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
      );
    },
    [questions, onChange]
  );

  // Reorder questions
  const moveQuestion = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newQuestions = [...questions];
      const [removed] = newQuestions.splice(fromIndex, 1);
      newQuestions.splice(toIndex, 0, removed);
      onChange(newQuestions);
    },
    [questions, onChange]
  );

  // Handle drag start
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveQuestion(draggedIndex, index);
    setDraggedIndex(index);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className={className}>
      {/* Questions list */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            onUpdate={(updates) => updateQuestion(question.id, updates)}
            onRemove={() => removeQuestion(question.id)}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            isDragging={draggedIndex === index}
            canRemove={questions.length > 1}
          />
        ))}
      </div>

      {/* Add question button */}
      <div className="mt-4">
        <Button
          variant="outline"
          onClick={addQuestion}
          disabled={questions.length >= maxQuestions}
          leftIcon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          }
        >
          Add Question
        </Button>
        {questions.length >= maxQuestions && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Maximum {maxQuestions} questions allowed
          </p>
        )}
      </div>
    </div>
  );
}

// ============ Question Card ============

interface QuestionCardProps {
  question: Question;
  index: number;
  onUpdate: (updates: Partial<Question>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  canRemove: boolean;
}

function QuestionCard({
  question,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  canRemove,
}: QuestionCardProps) {
  // Handle type change
  const handleTypeChange = (type: QuestionType) => {
    const updates: Partial<Question> = { type };

    // Add default options for multiple choice or ranking
    if (type === "multiple_choice" || type === "ranking") {
      if (!question.options || question.options.length === 0) {
        updates.options = [
          { id: generateId(), text: "" },
          { id: generateId(), text: "" },
        ];
      }
    } else {
      updates.options = undefined;
    }

    // Add default rating range
    if (type === "rating") {
      updates.minRating = 1;
      updates.maxRating = 5;
    } else {
      updates.minRating = undefined;
      updates.maxRating = undefined;
    }

    onUpdate(updates);
  };

  // Add option
  const addOption = () => {
    const newOption = { id: generateId(), text: "" };
    onUpdate({ options: [...(question.options || []), newOption] });
  };

  // Remove option
  const removeOption = (optionId: string) => {
    if (!question.options || question.options.length <= 2) return;
    onUpdate({
      options: question.options.filter((o) => o.id !== optionId),
    });
  };

  // Update option
  const updateOption = (optionId: string, text: string) => {
    onUpdate({
      options: question.options?.map((o) =>
        o.id === optionId ? { ...o, text } : o
      ),
    });
  };

  return (
    <Card
      className={`transition-all ${
        isDragging ? "opacity-50 ring-2 ring-[#1B4D7A]" : ""
      }`}
      padding="md"
    >
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {/* Header with drag handle */}
        <div className="flex items-center gap-3 mb-4">
          {/* Drag handle */}
          <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </div>

          {/* Question number */}
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Q{index + 1}
          </span>

          {/* Question type selector */}
          <Select
            options={questionTypes}
            value={question.type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
            fullWidth={false}
            className="flex-1 max-w-[200px]"
          />

          {/* Required toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="w-4 h-4 text-[#1B4D7A] border-gray-300 dark:border-gray-700 rounded focus:ring-[#1B4D7A]/50"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Required
            </span>
          </label>

          {/* Remove button */}
          {canRemove && (
            <IconButton
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              }
              aria-label="Remove question"
              variant="ghost"
              onClick={onRemove}
            />
          )}
        </div>

        {/* Question text */}
        <Textarea
          placeholder="Enter your question..."
          value={question.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={2}
          className="mb-4"
        />

        {/* Question type specific content */}
        {(question.type === "multiple_choice" ||
          question.type === "ranking") && (
          <OptionsEditor
            options={question.options || []}
            onAdd={addOption}
            onRemove={removeOption}
            onUpdate={updateOption}
            type={question.type}
          />
        )}

        {question.type === "rating" && (
          <RatingEditor
            minRating={question.minRating || 1}
            maxRating={question.maxRating || 5}
            onUpdate={onUpdate}
          />
        )}

        {question.type === "yes_no" && (
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
              Yes
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
              No
            </span>
          </div>
        )}

        {question.type === "text" && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Open text response - participants will enter free-form text
          </p>
        )}
      </div>
    </Card>
  );
}

// ============ Options Editor ============

interface OptionsEditorProps {
  options: QuestionOption[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
  type: "multiple_choice" | "ranking";
}

function OptionsEditor({
  options,
  onAdd,
  onRemove,
  onUpdate,
  type,
}: OptionsEditorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {type === "ranking" ? "Items to rank" : "Answer options"}
      </p>
      {options.map((option, index) => (
        <div key={option.id} className="flex items-center gap-2">
          <span className="w-6 text-center text-sm text-gray-400">
            {type === "ranking" ? `${index + 1}.` : String.fromCharCode(65 + index)}
          </span>
          <Input
            placeholder={`Option ${index + 1}`}
            value={option.text}
            onChange={(e) => onUpdate(option.id, e.target.value)}
            className="flex-1"
          />
          {options.length > 2 && (
            <IconButton
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              }
              aria-label="Remove option"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(option.id)}
            />
          )}
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={onAdd}>
        + Add option
      </Button>
    </div>
  );
}

// ============ Rating Editor ============

interface RatingEditorProps {
  minRating: number;
  maxRating: number;
  onUpdate: (updates: Partial<Question>) => void;
}

function RatingEditor({ minRating, maxRating, onUpdate }: RatingEditorProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">From</label>
        <Input
          type="number"
          value={minRating}
          onChange={(e) => onUpdate({ minRating: parseInt(e.target.value) || 1 })}
          min={0}
          max={maxRating - 1}
          className="w-20"
          fullWidth={false}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
        <Input
          type="number"
          value={maxRating}
          onChange={(e) => onUpdate({ maxRating: parseInt(e.target.value) || 5 })}
          min={minRating + 1}
          max={10}
          className="w-20"
          fullWidth={false}
        />
      </div>
    </div>
  );
}

export default QuestionBuilder;
