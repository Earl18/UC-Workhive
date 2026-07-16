"use client";

import { useMemo, useState } from "react";
import { useWorkHive } from "@/lib/store";
import {
  JobPosting,
  JobType,
  DEPARTMENTS,
  APPLICANT_REQUIREMENT_KEYS,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Briefcase, Users, Calendar, X, FileText } from "lucide-react";
import { formatDate } from "@/components/shared/helpers";

export function JobPostingsPage() {
  const { jobPostings, applicants, addJobPosting, updateJobPosting } = useWorkHive();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    department: DEPARTMENTS[0] as string,
    positionType: "Full-Time" as JobType,
    description: "",
    deadline: "",
  });
  const [selectedReqs, setSelectedReqs] = useState<string[]>([]);

  const sorted = useMemo(() => {
    return [...jobPostings].sort((a, b) => b.postedDate.localeCompare(a.postedDate));
  }, [jobPostings]);

  function toggleReq(key: string) {
    setSelectedReqs((r) => (r.includes(key) ? r.filter((k) => k !== key) : [...r, key]));
  }

  function submit() {
    if (!form.title || !form.deadline) {
      toast({ title: "Missing fields", description: "Title and deadline are required.", variant: "destructive" });
      return;
    }
    const newJob: JobPosting = {
      id: `job-${Date.now()}`,
      title: form.title,
      department: form.department,
      positionType: form.positionType,
      description: form.description,
      requirements: selectedReqs,
      deadline: form.deadline,
      postedDate: new Date().toISOString().slice(0, 10),
      status: "Active",
      applicantCount: 0,
    };
    addJobPosting(newJob);
    toast({ title: "Job Posting Created", description: newJob.title });
    setOpen(false);
    setForm({ title: "", department: DEPARTMENTS[0], positionType: "Full-Time", description: "", deadline: "" });
    setSelectedReqs([]);
  }

  function toggleStatus(j: JobPosting) {
    const next = j.status === "Active" ? "Closed" : "Active";
    updateJobPosting(j.id, { status: next });
    toast({ title: `Posting ${next}`, description: j.title });
  }

  const activeCount = jobPostings.filter((j) => j.status === "Active").length;
  const closedCount = jobPostings.length - activeCount;
  const totalApplicants = applicants.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Job Postings</h1>
          <p className="text-sm text-muted-foreground">Recruitment pipeline · UC South Campus</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary">
          <Plus className="mr-2 h-4 w-4" /> Create Posting
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Postings</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Closed Postings</p>
                <p className="text-2xl font-bold">{closedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gold/40">
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Applicants</p>
                <p className="text-2xl font-bold">{totalApplicants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Postings table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-primary">All Job Postings</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[28rem] overflow-auto scroll-thin rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Applicants</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((j) => {
                  const liveCount = applicants.filter((a) => a.jobId === j.id).length;
                  return (
                    <TableRow key={j.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{j.title}</p>
                        <p className="text-xs text-muted-foreground">Posted {formatDate(j.postedDate)}</p>
                      </TableCell>
                      <TableCell className="text-xs">{j.department}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{j.positionType}</Badge></TableCell>
                      <TableCell className="text-right text-sm font-semibold text-primary">{liveCount}</TableCell>
                      <TableCell className="text-xs">
                        <Calendar className="inline h-3 w-3 mr-1 text-muted-foreground" />
                        {formatDate(j.deadline)}
                      </TableCell>
                      <TableCell>
                        {j.status === "Active" ? (
                          <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Closed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => toggleStatus(j)}
                        >
                          {j.status === "Active" ? "Close" : "Reopen"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(92vw,48rem)] max-h-[90vh] overflow-y-auto scroll-thin sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2">
              <Plus className="h-5 w-5" /> Create Job Posting
            </DialogTitle>
            <DialogDescription>Fill out the details to publish a new job opening.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., College Instructor — Computer Studies"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Position Type</Label>
                <Select value={form.positionType} onValueChange={(v) => setForm({ ...form, positionType: v as JobType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-Time">Full-Time</SelectItem>
                    <SelectItem value="Part-Time">Part-Time</SelectItem>
                    <SelectItem value="Contractual">Contractual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Application Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Role summary, responsibilities, qualifications…"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Requirements Checklist</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() =>
                    setSelectedReqs(selectedReqs.length === APPLICANT_REQUIREMENT_KEYS.length ? [] : [...APPLICANT_REQUIREMENT_KEYS])
                  }
                >
                  {selectedReqs.length === APPLICANT_REQUIREMENT_KEYS.length ? "Clear all" : "Select all"}
                </Button>
              </div>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
                {APPLICANT_REQUIREMENT_KEYS.map((key) => (
                  <label key={key} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedReqs.includes(key)}
                      onCheckedChange={() => toggleReq(key)}
                      className="mt-0.5"
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{selectedReqs.length} of {APPLICANT_REQUIREMENT_KEYS.length} selected</p>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto bg-primary" onClick={submit}>
              <FileText className="mr-1 h-4 w-4" /> Publish Posting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

