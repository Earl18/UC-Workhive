"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Info,
  KeyRound,
  Mail,
  MailOpen,
  Monitor,
  Plus,
  RefreshCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAdminEmailTemplates } from "@/hooks/use-feature-toggles";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { renderWorkHiveEmailHtml } from "@/lib/email-layout";
import type { CoreEmailTemplateType, EmailTemplate, EmailTemplateType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PLACEHOLDER_FIELDS, type EmailPlaceholder, type PlaceholderSource } from "@/lib/email-placeholder-fields";

const CORE_TEMPLATE_ORDER: CoreEmailTemplateType[] = [
  "Leave Approved",
  "Leave Rejected",
  "Job Application Received",
  "Interview Invitation",
  "Interview Rescheduled",
  "Overtime Approved",
  "Overtime Rejected",
  "Upcoming Holiday Reminder",
  "Welcome Email",
  "Password Reset",
];

const CORE_ICON_MAP: Record<CoreEmailTemplateType, LucideIcon> = {
  "Leave Approved": CheckCircle2,
  "Leave Rejected": XCircle,
  "Job Application Received": Briefcase,
  "Interview Invitation": CalendarClock,
  "Interview Rescheduled": RefreshCcw,
  "Overtime Approved": CheckCircle2,
  "Overtime Rejected": XCircle,
  "Upcoming Holiday Reminder": BellRing,
  "Welcome Email": Sparkles,
  "Password Reset": KeyRound,
};

function iconForTemplate(type: string): LucideIcon {
  return (CORE_ICON_MAP as Partial<Record<string, LucideIcon>>)[type] ?? Mail;
}

function TemplateIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "Leave Approved":
    case "Overtime Approved":
      return <CheckCircle2 className={className} />;
    case "Leave Rejected":
    case "Overtime Rejected":
      return <XCircle className={className} />;
    case "Job Application Received":
      return <Briefcase className={className} />;
    case "Interview Invitation":
      return <CalendarClock className={className} />;
    case "Interview Rescheduled":
      return <RefreshCcw className={className} />;
    case "Upcoming Holiday Reminder":
      return <BellRing className={className} />;
    case "Welcome Email":
      return <Sparkles className={className} />;
    case "Password Reset":
      return <KeyRound className={className} />;
    default:
      return <Mail className={className} />;
  }
}

type DraftEditorProps = {
  template: EmailTemplate;
  placeholders: EmailPlaceholder[];
  onAddPlaceholder: (label: string, source: PlaceholderSource, field: string) => Promise<void>;
  isAddingPlaceholder: boolean;
  mode: "edit" | "create";
  onSaved: (type: string, subject: string, body: string) => Promise<void>;
  onCancelCreate?: () => void;
  onDelete?: (type: string) => Promise<void>;
  isSaving: boolean;
  isDeleting: boolean;
};

function DraftEditor({
  template,
  placeholders,
  onAddPlaceholder,
  isAddingPlaceholder,
  mode,
  onSaved,
  onCancelCreate,
  onDelete,
  isSaving,
  isDeleting,
}: DraftEditorProps) {
  const { toast } = useToast();
  const [type, setType] = useState(template.type);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [dirty, setDirty] = useState(mode === "create");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newSource, setNewSource] = useState<PlaceholderSource>("employee");
  const [newField, setNewField] = useState<string>(PLACEHOLDER_FIELDS.employee[0]);

  const handleFieldChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setDirty(true);
  };

  const handleSave = async () => {
    const nextType = type.trim();
    const nextSubject = subject.trim();
    const nextBody = body.trim();

    if (!nextType || !nextSubject || !nextBody) {
      toast({
        title: "Missing details",
        description: "Template name, subject, and body are required.",
        variant: "destructive",
      });
      return;
    }

    await onSaved(nextType, nextSubject, nextBody);
    setDirty(false);
    toast({
      title: mode === "create" ? "Template added" : "Template saved",
      description:
        mode === "create"
          ? `${nextType} has been stored in the database.`
          : `${template.type} template has been updated.`,
    });
  };

  const handleReset = () => {
    setType(template.type);
    setSubject(template.subject);
    setBody(template.body);
    setDirty(mode === "create");
  };

  const insertPlaceholder = (token: string) => {
    const el = bodyRef.current;
    if (!el) {
      handleFieldChange(setBody)(body + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    handleFieldChange(setBody)(next);
    requestAnimationFrame(() => {
      el.focus();
      const position = start + token.length;
      el.setSelectionRange(position, position);
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    await onDelete(template.type);
  };

  const subjectCharCount = subject.length;
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const typeCharCount = type.trim().length;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="border-b border-border bg-muted/30 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Template Editor</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {mode === "create"
                  ? "Create a new stored email template in the database."
                  : "Edit the stored subject line and body content for this template."}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1.5 border-primary/30 bg-primary/5 text-primary">
            {mode === "create" ? <Plus className="h-3.5 w-3.5" /> : <TemplateIcon type={template.type} className="h-3.5 w-3.5" />}
            {mode === "create" ? "New template" : template.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-4 p-5">
        {mode === "create" ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Template Name</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {typeCharCount} {typeCharCount === 1 ? "character" : "characters"}
                </span>
              </div>
              <Input
                value={type}
                onChange={(e) => handleFieldChange(setType)(e.target.value)}
                placeholder="Orientation Reminder"
              />
            </div>

            <Separator />
          </>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Subject Line</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {subjectCharCount} {subjectCharCount === 1 ? "character" : "characters"}
            </span>
          </div>
          <Input
            value={subject}
            onChange={(e) => handleFieldChange(setSubject)(e.target.value)}
            placeholder="Email subject..."
            maxLength={200}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Body</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Available placeholders - click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((placeholder) => (
                <button
                  key={placeholder.token}
                  type="button"
                  onClick={() => insertPlaceholder(placeholder.token)}
                  title={`${placeholder.source}.${placeholder.field}`}
                  className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[11px] text-primary transition-colors hover:border-primary/40 hover:bg-primary/10 active:scale-95"
                >
                  {placeholder.token}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div className="min-w-[140px] flex-1 space-y-1">
                <Label className="text-[11px]">New placeholder</Label>
                <Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Department Name" maxLength={60} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Source</Label>
                <select aria-label="Placeholder source" value={newSource} onChange={(event) => {
                  const source = event.target.value as PlaceholderSource;
                  setNewSource(source);
                  setNewField(PLACEHOLDER_FIELDS[source][0]);
                }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                  {Object.keys(PLACEHOLDER_FIELDS).map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Field</Label>
                <select aria-label="Placeholder field" value={newField} onChange={(event) => setNewField(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                  {PLACEHOLDER_FIELDS[newSource].map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={!newLabel.trim() || isAddingPlaceholder} onClick={async () => {
                try {
                  await onAddPlaceholder(newLabel.trim(), newSource, newField);
                  setNewLabel("");
                } catch { /* Mutation displays the error. */ }
              }}><Plus className="h-3.5 w-3.5" /> Add</Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Database fields use the matching record when this template is rendered. Event fields are supplied by the action sending the email.</p>
          </div>

          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => handleFieldChange(setBody)(e.target.value)}
            rows={12}
            className="font-mono text-xs"
            placeholder="Email body..."
          />
          <p className="text-[11px] text-muted-foreground">Separate paragraphs with a blank line. The email renderer resolves placeholders from matching records and event values.</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
          {dirty ? (
            <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
              Unsaved changes
            </Badge>
          ) : (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              <Check className="h-3 w-3" /> Saved
            </Badge>
          )}
          <div className="flex items-center gap-2">
            {mode === "create" ? (
              <Button variant="outline" onClick={onCancelCreate} disabled={isSaving}>
                <ChevronLeft className="h-4 w-4" />
                Cancel
              </Button>
            ) : null}
            {mode === "edit" && onDelete ? (
              <Button
                variant="outline"
                onClick={() => void handleDelete()}
                disabled={isDeleting || isSaving}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
            {mode === "edit" ? (
              <Button variant="outline" onClick={handleReset} disabled={!dirty || isSaving || isDeleting}>
                <RefreshCcw className="h-4 w-4" />
                Revert
              </Button>
            ) : null}
            <Button onClick={() => void handleSave()} disabled={!dirty || isSaving || isDeleting}>
              <Save className="h-4 w-4" />
              {isSaving ? (mode === "create" ? "Adding..." : "Saving...") : mode === "create" ? "Add Template" : "Save Template"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useAdminEmailTemplates();
  const [selectedType, setSelectedType] = useState<EmailTemplateType>(CORE_TEMPLATE_ORDER[0]);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [editorMode, setEditorMode] = useState<"edit" | "create">("edit");

  const { data: systemSettingsData } = useSystemSettings();
  const settings = systemSettingsData?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const campusAddress = settings?.campusAddress ?? "Sanciangko St., Cebu City, 6000 Cebu, Philippines";
  const hrEmail = settings?.hrEmail ?? "hr.south@uc.edu.ph";
  const contactNumber = settings?.contactNumber ?? "(032) 412-1234";

  const emailTemplates = data?.emailTemplates ?? [];
  const placeholders = data?.placeholders ?? [];

  const addPlaceholderMutation = useMutation({
    mutationFn: async ({ label, source, field }: { label: string; source: PlaceholderSource; field: string }) => {
      const response = await fetch("/api/admin/email-placeholders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, source, field }) });
      const payload = (await response.json()) as { placeholder?: EmailPlaceholder; error?: string };
      if (!response.ok || !payload.placeholder) throw new Error(payload.error ?? "Unable to add placeholder.");
      return payload.placeholder;
    },
    onSuccess: (placeholder) => {
      queryClient.setQueryData<{ emailTemplates: EmailTemplate[]; placeholders: EmailPlaceholder[] } | undefined>(["admin-email-templates"], (existing) => existing ? { ...existing, placeholders: [...existing.placeholders, placeholder] } : existing);
      toast({ title: "Placeholder added", description: `${placeholder.token} can now be used in any template.` });
    },
    onError: (mutationError) => toast({ title: "Unable to add placeholder", description: mutationError instanceof Error ? mutationError.message : "Please try again.", variant: "destructive" }),
  });

  const orderedTemplates = useMemo(() => {
    const coreTemplates = CORE_TEMPLATE_ORDER
      .map((type) => emailTemplates.find((template) => template.type === type))
      .filter((template): template is EmailTemplate => Boolean(template));

    const customTemplates = emailTemplates
      .filter((template) => !CORE_TEMPLATE_ORDER.includes(template.type as CoreEmailTemplateType))
      .sort((a, b) => a.type.localeCompare(b.type));

    return [...coreTemplates, ...customTemplates];
  }, [emailTemplates]);

  const current = useMemo(() => {
    return orderedTemplates.find((template) => template.type === selectedType) ?? orderedTemplates[0];
  }, [orderedTemplates, selectedType]);

  const createDraft = useMemo<EmailTemplate>(
    () => ({
      type: "",
      subject: "",
      body: "Dear [Employee Name],\n\n",
    }),
    [],
  );

  const activeTemplate = editorMode === "create" ? createDraft : current;

  const saveMutation = useMutation({
    mutationFn: async ({ type, subject, body }: { type: EmailTemplateType; subject: string; body: string }) => {
      const response = await fetch(`/api/admin/email-templates/${encodeURIComponent(type)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const payload = (await response.json()) as { template?: EmailTemplate; error?: string };
      if (!response.ok || !payload.template) {
        throw new Error(payload.error ?? "Unable to save email template.");
      }
      return payload.template;
    },
    onSuccess: (template) => {
      queryClient.setQueryData<{ emailTemplates: EmailTemplate[]; placeholders: EmailPlaceholder[] } | undefined>(["admin-email-templates"], (existing) => ({
        placeholders: existing?.placeholders ?? [],
        emailTemplates: existing?.emailTemplates
          ? existing.emailTemplates.map((entry) => (entry.type === template.type ? template : entry))
          : [template],
      }));
      void queryClient.invalidateQueries({ queryKey: ["admin-email-templates"], refetchType: "inactive" });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to save template",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ type, subject, body }: { type: string; subject: string; body: string }) => {
      const response = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject, body }),
      });
      const payload = (await response.json()) as { template?: EmailTemplate; error?: string };
      if (!response.ok || !payload.template) {
        throw new Error(payload.error ?? "Unable to add email template.");
      }
      return payload.template;
    },
    onSuccess: (template) => {
      queryClient.setQueryData<{ emailTemplates: EmailTemplate[]; placeholders: EmailPlaceholder[] } | undefined>(["admin-email-templates"], (existing) => ({
        placeholders: existing?.placeholders ?? [],
        emailTemplates: existing?.emailTemplates ? [...existing.emailTemplates, template] : [template],
      }));
      void queryClient.invalidateQueries({ queryKey: ["admin-email-templates"], refetchType: "inactive" });
      setSelectedType(template.type);
      setEditorMode("edit");
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to add template",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (type: string) => {
      const response = await fetch(`/api/admin/email-templates/${encodeURIComponent(type)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete email template.");
      }
      return type;
    },
    onSuccess: (type) => {
      const remainingTemplates = orderedTemplates.filter((entry) => entry.type !== type);
      queryClient.setQueryData<{ emailTemplates: EmailTemplate[]; placeholders: EmailPlaceholder[] } | undefined>(["admin-email-templates"], (existing) => ({
        placeholders: existing?.placeholders ?? [],
        emailTemplates: (existing?.emailTemplates ?? []).filter((entry) => entry.type !== type),
      }));
      setSelectedType(remainingTemplates[0]?.type ?? "");
      setEditorMode("edit");
      void queryClient.invalidateQueries({ queryKey: ["admin-email-templates"], refetchType: "inactive" });
      toast({ title: "Template deleted", description: `${type} has been removed from the database.` });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to delete template",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaved = async (type: string, subject: string, body: string) => {
    if (editorMode === "create") {
      await createMutation.mutateAsync({ type, subject, body });
      return;
    }

    if (!current) {
      return;
    }

    await saveMutation.mutateAsync({ type: current.type, subject, body });
  };

  const previewMaxWidth = previewMode === "desktop" ? "max-w-2xl" : "max-w-[320px]";

  if (isLoading && !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading email templates...</div>;
  }

  if (error && !data) {
    return <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load email templates."}</div>;
  }

  if (!activeTemplate) {
    return <div className="p-6 text-sm text-muted-foreground">No email templates found.</div>;
  }
  const previewHtml = renderWorkHiveEmailHtml({
    type: activeTemplate.type || "New Template",
    subject: activeTemplate.subject || "- no subject -",
    body: activeTemplate.body,
    settings: { organizationName, campusAddress, contactNumber, hrEmail },
    logoUrl: "/workhive-logo.png",
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
            <Mail className="h-3 w-3" />
            Branded Communications
          </Badge>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
            <p className="text-sm text-muted-foreground">Edit the email templates sent by WorkHive actions. Custom templates can be connected to new workflows.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setEditorMode("create")}>
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MailOpen className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Stored</p>
              <p className="text-sm font-semibold text-foreground">{orderedTemplates.length} templates</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-primary" />
              Templates
            </CardTitle>
            <CardDescription className="text-[11px]">Select a stored template to edit</CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {orderedTemplates.map((template) => {
                const isActive = editorMode === "edit" && template.type === current?.type;
                const Icon = iconForTemplate(template.type);
                return (
                  <button
                    key={template.type}
                    type="button"
                    onClick={() => {
                      setSelectedType(template.type);
                      setEditorMode("edit");
                    }}
                    className={cn(
                      "group relative flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors lg:w-full",
                      isActive ? "bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {isActive ? <span className="absolute left-0 top-1/2 hidden h-[60%] w-1 -translate-y-1/2 rounded-r bg-primary lg:block" aria-hidden /> : null}
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-background",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="whitespace-nowrap font-medium leading-tight lg:whitespace-normal">{template.type}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <DraftEditor
          key={`${editorMode}-${activeTemplate.type || "new"}`}
          template={activeTemplate}
          placeholders={placeholders}
          onAddPlaceholder={(label, source, field) => addPlaceholderMutation.mutateAsync({ label, source, field }).then(() => undefined)}
          isAddingPlaceholder={addPlaceholderMutation.isPending}
          mode={editorMode}
          onSaved={handleSaved}
          onCancelCreate={() => setEditorMode("edit")}
          onDelete={editorMode === "edit" ? async (type) => { await deleteMutation.mutateAsync(type); } : undefined}
          isSaving={saveMutation.isPending || createMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />

        <Card className="flex h-full flex-col">
          <CardHeader className="border-b border-border bg-muted/30 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MailOpen className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Live Preview</CardTitle>
                  <CardDescription className="text-[11px]">Preview of the stored email layout and content</CardDescription>
                </div>
              </div>
              <div className="flex items-center rounded-md border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode("desktop")}
                  className={cn(
                    "flex h-7 w-8 items-center justify-center rounded transition-colors",
                    previewMode === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("mobile")}
                  className={cn(
                    "flex h-7 w-8 items-center justify-center rounded transition-colors",
                    previewMode === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            <div className="flex justify-center">
              <div className={cn("w-full transition-all duration-300", previewMaxWidth)}>
                <iframe
                  title="Email template preview"
                  sandbox=""
                  srcDoc={previewHtml}
                  className="h-[36rem] w-full rounded-lg border border-border bg-white shadow-sm"
                />
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-muted-foreground">This editor preview keeps placeholder tokens visible. Outgoing emails replace them with the applicant, employee, or event values.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Stored template behavior</p>
          <p className="text-xs text-muted-foreground">Templates and placeholder definitions are stored in the database. Add a placeholder by choosing its source and field, then use it in any template.</p>
        </div>
      </div>
    </div>
  );
}
