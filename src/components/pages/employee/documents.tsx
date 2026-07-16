"use client";

import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentRecord, type Employee } from "@/lib/types";
import {
  EMPLOYEE_DOCUMENT_ACCEPT,
  EMPLOYEE_DOCUMENT_MAX_BYTES,
  EMPLOYEE_DOCUMENT_MAX_MB,
} from "@/lib/employee-document-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  ExternalLink,
  FileCheck,
  FilePlus2,
  FileText,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { formatDate } from "@/components/shared/helpers";
import { useToast } from "@/hooks/use-toast";

const DOC_TYPES: DocumentRecord["type"][] = [
  "Diploma",
  "Certificate",
  "PRC License",
  "Training Certificate",
  "COE",
  "Clearance",
  "Other",
];

const TYPE_ICON: Record<DocumentRecord["type"], React.ReactNode> = {
  Diploma: <FileText className="h-5 w-5" />,
  Certificate: <FileCheck className="h-5 w-5" />,
  "PRC License": <FileCheck className="h-5 w-5" />,
  "Training Certificate": <FileText className="h-5 w-5" />,
  COE: <FileText className="h-5 w-5" />,
  Clearance: <FileText className="h-5 w-5" />,
  Other: <FileText className="h-5 w-5" />,
};

type EmployeeProfile = Employee & { birthDate?: string };
type EmployeeProfileResponse = {
  employee?: EmployeeProfile;
  error?: string;
};

function isValidDocumentType(value: string): value is DocumentRecord["type"] {
  return DOC_TYPES.includes(value as DocumentRecord["type"]);
}

function documentStatusClass(status: DocumentRecord["status"]) {
  if (status === "Verified") {
    return "border-green-500/40 text-green-600 dark:text-green-400";
  }
  if (status === "Rejected") {
    return "border-red-500/40 text-red-600 dark:text-red-400";
  }
  return "border-amber-500/40 text-amber-600 dark:text-amber-400";
}

async function readProfileResponse(response: Response) {
  const payload = (await response.json()) as EmployeeProfileResponse;
  if (!response.ok || !payload.employee) {
    throw new Error(payload.error ?? "Unable to load your employee record.");
  }
  return payload.employee;
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) {
    return null;
  }

  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function getEmployeeStorageFolder(employee: EmployeeProfile) {
  return `${employee.firstName} ${employee.middleName} ${employee.lastName}`.replace(/\s+/g, " ").trim();
}

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentRecord["type"] | "">("");
  const [customLabel, setCustomLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["employee-profile"],
    queryFn: async () => {
      const response = await fetch("/api/employee/profile", { cache: "no-store" });
      return readProfileResponse(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadType || !selectedFile) {
        throw new Error("Please select a document type and file.");
      }

      const formData = new FormData();
      formData.set("type", uploadType);
      if (uploadType === "Other") {
        formData.set("customLabel", customLabel.trim());
      }
      formData.set("file", selectedFile);

      const response = await fetch("/api/employee/profile/documents", {
        method: "POST",
        body: formData,
      });
      return readProfileResponse(response);
    },
    onSuccess: (updatedEmployee) => {
      queryClient.setQueryData(["employee-profile"], updatedEmployee);
      setUploadOpen(false);
      setUploadType("");
      setCustomLabel("");
      setSelectedFile(null);
      toast({
        title: "Document uploaded",
        description: "Your document was uploaded to Supabase and is now pending HR verification.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to upload document",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await fetch(`/api/employee/profile/documents/${docId}`, {
        method: "DELETE",
      });
      return readProfileResponse(response);
    },
    onSuccess: (updatedEmployee) => {
      queryClient.setQueryData(["employee-profile"], updatedEmployee);
      toast({
        title: "Document removed",
        description: "The document was removed from your record.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to remove document",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (profileQuery.isLoading) {
    return (
      <div className="p-6 text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading your employee documents...
      </div>
    );
  }

  if (profileQuery.error) {
    return (
      <div className="p-6 text-muted-foreground">
        {profileQuery.error instanceof Error ? profileQuery.error.message : "No employee record found."}
      </div>
    );
  }

  const employee = profileQuery.data ?? null;
  if (!employee) {
    return <div className="p-6 text-muted-foreground">No employee record found.</div>;
  }

  const documents = employee.documents;
  const filtered = documents.filter(
    (document) =>
      (search === "" ||
        document.fileName.toLowerCase().includes(search.toLowerCase()) ||
        (document.label ?? document.type).toLowerCase().includes(search.toLowerCase())) &&
      (typeFilter === "all" || document.type === typeFilter) &&
      (statusFilter === "all" || document.status === statusFilter),
  );

  const verifiedCount = documents.filter((document) => document.status === "Verified").length;
  const pendingCount = documents.filter((document) => document.status === "Pending").length;
  const canUpload = Boolean(uploadType && selectedFile && (uploadType !== "Other" || customLabel.trim()));
  const storageFolder = getEmployeeStorageFolder(employee);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
      toast({
        title: "File too large",
        description: `Each document must be ${EMPLOYEE_DOCUMENT_MAX_MB} MB or smaller.`,
        variant: "destructive",
      });
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleOpenDocument = async (doc: DocumentRecord) => {
    if (!doc.storagePath) {
      toast({
        title: "Document unavailable",
        description: "This document does not have a stored Supabase file yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      setOpeningDocId(doc.id);
      const response = await fetch(`/api/employee/profile/documents/${doc.id}/file`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to open this document.");
      }

      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "Unable to open document",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setOpeningDocId(null);
    }
  };

  return (
    <>
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Documents & Certificates</h2>
            <p className="text-xs text-muted-foreground">
              Diplomas, licenses, certificates, and other credentials on file.
            </p>
          </div>
          <Button variant="outline" onClick={() => setUploadOpen(true)} disabled={uploadMutation.isPending || removeMutation.isPending}>
            {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload document
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatBox label="Total Documents" value={documents.length} icon={<FileText className="h-4 w-4" />} />
          <StatBox label="Verified" value={verifiedCount} icon={<FileCheck className="h-4 w-4" />} accent="#16a34a" />
          <StatBox label="Pending Review" value={pendingCount} icon={<Clock className="h-4 w-4" />} accent="#ca8a04" />
        </div>


        <Card className="min-h-[clamp(28rem,calc(100dvh-23rem),48rem)] border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">My Documents</CardTitle>
            <CardDescription>Filter and browse your uploaded documents.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-[clamp(22rem,calc(100dvh-30rem),42rem)] flex-col gap-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative w-full flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by file name or type..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" />
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger size="sm" className="w-full lg:w-[160px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {DOC_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger size="sm" className="w-full lg:w-[140px]">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="Verified">Verified</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
                <FilePlus2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">No documents match your filters.</p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-primary">{TYPE_ICON[doc.type]}</span>
                            <div className="min-w-0">
                              <p className="truncate">{doc.fileName}</p>
                              {doc.sizeBytes ? <p className="text-xs text-muted-foreground">{formatFileSize(doc.sizeBytes)}</p> : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{doc.label ?? doc.type}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(doc.uploadDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={documentStatusClass(doc.status)}>{doc.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDocument(doc)}
                              disabled={!doc.storagePath || openingDocId === doc.id || removeMutation.isPending || uploadMutation.isPending}
                            >
                              {openingDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(doc.id)} disabled={removeMutation.isPending || uploadMutation.isPending}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
</div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="w-[min(92vw,34rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Select the document type, choose the file, and upload it to your real employee record.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Document Type</label>
              <Select value={uploadType} onValueChange={(value) => {
                if (!isValidDocumentType(value)) {
                  return;
                }
                setUploadType(value);
                if (value !== "Other") {
                  setCustomLabel("");
                }
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {uploadType === "Other" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Document Name</label>
                <Input placeholder="Enter the document name" value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Choose File</label>
              <Input type="file" accept={EMPLOYEE_DOCUMENT_ACCEPT} onChange={handleFileChange} />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>Allowed files: PDF, JPG, JPEG, PNG.</p>
              <p>Maximum file size: {EMPLOYEE_DOCUMENT_MAX_MB} MB per document.</p>
              <p>Linked employee: {employee.firstName} {employee.lastName}</p>
              <p>Storage folder: {storageFolder} / employee-documents</p>
              {selectedFile ? <p className="truncate">Selected: {selectedFile.name}</p> : null}
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setUploadOpen(false)} disabled={uploadMutation.isPending}>Cancel</Button>
            <Button className="w-full sm:w-auto" onClick={() => uploadMutation.mutate()} disabled={!canUpload || uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatBox({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: string }) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: accent ? `${accent}1a` : "var(--primary-10, rgba(30,58,138,0.1))", color: accent ?? "var(--primary)" }}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}








