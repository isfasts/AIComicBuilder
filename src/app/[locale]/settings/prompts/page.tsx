"use client";

import { PromptEditor } from "@/components/prompt-templates/prompt-editor";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

export default function PromptSettingsPage() {
  const t = useTranslations("promptTemplates");
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-[--border-subtle] bg-white/80 backdrop-blur-xl px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--surface] hover:text-[--text-primary]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="font-display text-sm font-semibold text-[--text-primary]">
                {t("title")}
              </span>
              <span className="ml-2 text-xs text-[--text-muted]">
                {t("subtitle")}
              </span>
            </div>
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 flex-col overflow-hidden bg-[--surface] p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden animate-page-in">
          <PromptEditor />
        </div>
      </main>
    </div>
  );
}
