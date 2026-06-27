"use client";

import { useState, useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";

interface ChatInputProps {
  isGenerating: boolean;
  hasSession: boolean;
  onSend: (value: string, imageFile?: File) => void;
  onAbort: () => void;
  disabled?: boolean;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export default function ChatInput({
  isGenerating,
  hasSession,
  onSend,
  onAbort,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachImage = useCallback(
    (file: File) => {
      if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return;
      if (file.size > MAX_IMAGE_BYTES) {
        alert("Image must be under 5 MB");
        return;
      }
      const url = URL.createObjectURL(file);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImageFile(file);
      setImagePreviewUrl(url);
    },
    [imagePreviewUrl],
  );

  function clearImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSend() {
    const trimmed = value.trim();
    if ((!trimmed && !imageFile) || isGenerating) return;
    onSend(trimmed, imageFile ?? undefined);
    setValue("");
    clearImage();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        attachImage(file);
      }
    },
    [attachImage],
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) attachImage(file);
  }

  const canSend = (value.trim().length > 0 || imageFile !== null) && !isGenerating && !disabled;

  return (
    <div className="flex-shrink-0 bg-[#262626] px-3 pb-3 pt-2">
      <div
        className={`flex min-h-[120px] flex-col gap-3 rounded-[14px] border bg-[#262626] px-3.5 pb-3 pt-4 transition-colors duration-150 ${
          focused ? "border-[#7c3aed]" : "border-[#3C3C3C]"
        }`}
      >
        {/* Image preview */}
        {imagePreviewUrl && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreviewUrl}
              alt="Attached Figma frame"
              className="max-h-[120px] rounded-lg border border-[#3C3C3C] object-contain"
            />
            <button
              onClick={clearImage}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#3C3C3C] text-[#ccc] hover:bg-[#555]"
              title="Remove image"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
        )}

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            imageFile
              ? "Add a note (optional)…"
              : hasSession
                ? "Ask for a change"
                : "Name a screen or paste a Figma frame…"
          }
          rows={2}
          disabled={disabled}
          className="flex-1 resize-none border-none bg-transparent text-[16px] leading-relaxed text-[#ccc] outline-none placeholder:text-[#5F5F5F]"
        />

        <div className="flex items-center justify-between">
          {/* Paperclip / file picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isGenerating}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5F5F5F] transition-colors hover:text-[#aaa] disabled:opacity-30"
            title="Attach Figma frame image"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05L12.25 20.24a5.5 5.5 0 01-7.78-7.78L13.59 3.34a3.5 3.5 0 014.95 4.95L9.42 17.41a1.5 1.5 0 01-2.12-2.12l8.12-8.13" />
            </svg>
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Send / Stop */}
          {isGenerating ? (
            <button
              onClick={onAbort}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7c3aed] transition-colors hover:bg-[#6d28d9]"
              title="Stop generation"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="white">
                <rect x="1" y="1" width="10" height="10" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7c3aed] transition-colors hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40"
              title="Send"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
