"use client";

import { useEffect, useState } from "react";
import { usePromptTemplateStore } from "@/stores/prompt-template-store";
import { SlotList } from "./slot-list";
import { PromptPreview } from "./prompt-preview";
import { AdvancedEditor } from "./advanced-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { Save, RotateCcw, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { PresetDialog } from "./preset-dialog";

const CATEGORIES = ["all", "script", "character", "shot", "frame", "video"] as const;

/** Strip "promptTemplates." prefix from registry nameKeys since t() is already scoped */
function tKey(nameKey: string): string {
  return nameKey.replace(/^promptTemplates\./, "");
}

interface PromptEditorProps {
  /** "global" or "project" — determines which API endpoints to use */
  scope?: "global" | "project";
  /** Required when scope="project" */
  projectId?: string;
  /** Auto-select this prompt on mount */
  initialPromptKey?: string;
}

export function PromptEditor({ scope = "global", projectId, initialPromptKey }: PromptEditorProps) {
  const t = useTranslations("promptTemplates");
  const store = usePromptTemplateStore();
  const {
    registry,
    setRegistry,
    selectedPromptKey,
    selectedSlotKey,
    selectPrompt,
    mode,
    setMode,
    getSlotContent,
    setSlotContent,
    clearEdits,
    isDirty,
    setServerOverrides,
    categoryFilter,
    setCategoryFilter,
    getCustomizedPromptKeys,
  } = store;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);

  const isProject = scope === "project" && !!projectId;

  // Build the correct API base path based on scope
  const templatesBasePath = isProject
    ? `/api/projects/${projectId}/prompt-templates`
    : "/api/prompt-templates";

  // Fetch registry + overrides on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [regResp, overResp] = await Promise.all([
          apiFetch("/api/prompt-templates/registry"),
          apiFetch(templatesBasePath),
        ]);
        const regData = await regResp.json();
        const overData = await overResp.json();
        setRegistry(regData);
        setServerOverrides(overData);

        // Auto-select prompt
        const autoKey = initialPromptKey || (regData.length > 0 ? regData[0].key : null);
        if (autoKey && !selectedPromptKey) {
          selectPrompt(autoKey);
        }
      } catch {
        toast.error("Failed to load prompt templates");
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, projectId]);

  // Filter prompts by category
  const filteredPrompts =
    categoryFilter === "all"
      ? registry
      : registry.filter((r) => r.category === categoryFilter);

  // Group by category
  const grouped = filteredPrompts.reduce<Record<string, typeof registry>>(
    (acc, prompt) => {
      if (!acc[prompt.category]) acc[prompt.category] = [];
      acc[prompt.category].push(prompt);
      return acc;
    },
    {}
  );

  const customizedKeys = getCustomizedPromptKeys();
  const selectedPrompt = registry.find((r) => r.key === selectedPromptKey);
  const selectedSlot = selectedPrompt?.slots.find(
    (s) => s.key === selectedSlotKey
  );
  const currentContent =
    selectedPromptKey && selectedSlotKey
      ? getSlotContent(selectedPromptKey, selectedSlotKey)
      : "";

  const handleSave = async () => {
    if (!selectedPromptKey) return;
    setSaving(true);
    try {
      const dirtySlots = store.dirtySlots(selectedPromptKey);
      const slots: Record<string, string> = {};
      for (const sk of dirtySlots) {
        slots[sk] = getSlotContent(selectedPromptKey, sk);
      }
      await apiFetch(`${templatesBasePath}/${selectedPromptKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "slots", slots }),
      });
      // Refresh overrides
      const resp = await apiFetch(templatesBasePath);
      const data = await resp.json();
      setServerOverrides(data);
      clearEdits(selectedPromptKey);
      toast.success(t("editor.savedSuccess"));
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedPromptKey) return;
    try {
      await apiFetch(`${templatesBasePath}/${selectedPromptKey}`, {
        method: "DELETE",
      });
      const resp = await apiFetch(templatesBasePath);
      const data = await resp.json();
      setServerOverrides(data);
      clearEdits(selectedPromptKey);
      toast.success(t("editor.resetSuccess"));
    } catch {
      toast.error("Reset failed");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-[--text-muted]">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Scope indicator for project mode */}
      {isProject && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
          <Badge variant="default" className="text-[10px]">{t("project.useProjectPrompts")}</Badge>
          <span className="text-[--text-secondary]">{t("project.useProjectPromptsDesc")}</span>
        </div>
      )}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[--border-subtle] bg-white p-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              categoryFilter === cat
                ? "bg-white text-[--text-primary] shadow-sm"
                : "text-[--text-secondary] hover:bg-[--surface] hover:text-[--text-primary]"
            }`}
          >
            {t(`categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* Preset dialog */}
      {selectedPromptKey && (
        <PresetDialog
          open={presetDialogOpen}
          onOpenChange={setPresetDialogOpen}
          promptKey={selectedPromptKey}
        />
      )}

      {/* Three-column editor — fill remaining viewport height */}
      <div className="flex flex-1 overflow-hidden rounded-2xl border border-[--border-subtle] bg-white">
        {/* Left column: Prompt list */}
        <div className="w-[200px] shrink-0 overflow-y-auto border-r border-[--border-subtle]">
          <div className="flex flex-col gap-0.5 p-2">
            {Object.entries(grouped).map(([category, prompts]) => (
              <div key={category}>
                <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-muted]">
                  {t(`categories.${category}` as Parameters<typeof t>[0])}
                </div>
                {prompts.map((prompt) => {
                  const isSelected = selectedPromptKey === prompt.key;
                  const isCustomized = customizedKeys.includes(prompt.key);
                  return (
                    <button
                      key={prompt.key}
                      onClick={() => selectPrompt(prompt.key)}
                      className={`flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200 ${
                        isSelected
                          ? "border border-primary/15 bg-primary/5"
                          : "border border-transparent hover:bg-[--surface]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm ${
                            isSelected
                              ? "text-[--text-primary] font-medium"
                              : "text-[--text-secondary]"
                          }`}
                        >
                          {t(tKey(prompt.nameKey) as Parameters<typeof t>[0])}
                        </span>
                        {isCustomized && (
                          <Badge
                            variant="default"
                            className="text-[9px] px-1 py-0"
                          >
                            {t("editor.customized")}
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-[--text-muted]">
                        {prompt.key}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Middle column: Slot list */}
        <div className="w-[170px] shrink-0 overflow-y-auto border-r border-[--border-subtle]">
          <SlotList />
        </div>

        {/* Right column: Editor + Preview */}
        <div className="flex flex-1 flex-col">
          {selectedPrompt ? (
            <>
              {/* Editor header — always visible */}
              <div className="flex items-center justify-between border-b border-[--border-subtle] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[--text-primary]">
                    {mode === "slots" && selectedSlot
                      ? (t(tKey(selectedSlot.nameKey) as Parameters<typeof t>[0]) || selectedSlot.key)
                      : t("editor.advancedMode")}
                  </span>
                  {selectedPromptKey && isDirty(selectedPromptKey) && (
                    <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                      {t("editor.modified")}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode toggle */}
                  <div className="flex rounded-lg bg-[--surface] p-0.5">
                    <button
                      onClick={() => setMode("slots")}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                        mode === "slots"
                          ? "bg-white text-[--text-primary] shadow-sm"
                          : "text-[--text-muted]"
                      }`}
                    >
                      {t("editor.slotMode")}
                    </button>
                    <button
                      onClick={() => setMode("advanced")}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                        mode === "advanced"
                          ? "bg-white text-[--text-primary] shadow-sm"
                          : "text-[--text-muted]"
                      }`}
                    >
                      {t("editor.advancedMode")}
                    </button>
                  </div>

                  {mode === "slots" && (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setPresetDialogOpen(true)}
                        disabled={!selectedPromptKey}
                      >
                        <Layers className="h-3 w-3" />
                        {t("presets.openPresets")}
                      </Button>

                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={handleReset}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t("editor.resetDefault")}
                      </Button>

                      <Button
                        size="xs"
                        onClick={handleSave}
                        disabled={
                          saving ||
                          !selectedPromptKey ||
                          !isDirty(selectedPromptKey)
                        }
                      >
                        <Save className="h-3 w-3" />
                        {t("editor.save")}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Editor body — fills remaining height, no page scroll */}
              {mode === "advanced" ? (
                <AdvancedEditor scope={scope} projectId={projectId} />
              ) : selectedSlot ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-3">
                    <textarea
                      value={currentContent}
                      onChange={(e) => {
                        if (selectedPromptKey && selectedSlotKey) {
                          setSlotContent(
                            selectedPromptKey,
                            selectedSlotKey,
                            e.target.value
                          );
                        }
                      }}
                      className="h-full w-full resize-none rounded-xl border border-[--border-subtle] bg-white px-3.5 py-3 font-mono text-[12px] leading-relaxed text-[--text-primary] outline-none transition-all duration-200 placeholder:text-[--text-muted] hover:border-[--border-hover] focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
                      placeholder={t("editor.edit")}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto border-t border-[--border-subtle]">
                    <PromptPreview />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-[--text-muted]">
                  {t("editor.slotMode")}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[--text-muted]">
              {t("editor.edit")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
