"use client";

import { useMemo, useState } from "react";
import { useWorkHive, useApplicantById, useJobById } from "@/lib/store";
import {
  InterviewScore,
  ScoreCriterion,
  INTERVIEW_CRITERIA,
} from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import {
  recommendationColor,
  calcRecommendation,
  formatDate,
} from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  MessageSquare,
  Users,
  Send,
  Save,
  ArrowLeft,
  Info,
} from "lucide-react";

const SCORE_LABELS = ["Poor", "Fair", "Average", "Good", "Excellent"];

export function VideoConferencingPage() {
  const {
    selectedInterviewApplicantId,
    setView,
    saveInterviewScore,
    currentUser,
  } = useWorkHive();
  const applicant = useApplicantById(selectedInterviewApplicantId);
  const job = useJobById(applicant?.jobId ?? null);
  const { toast } = useToast();

  const [showVideo, setShowVideo] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatMsg, setChatMsg] = useState("");
  const [chat, setChat] = useState<{ from: string; msg: string }[]>([
    { from: "Maria Dela Cruz", msg: "Welcome! We'll start in a moment." },
    { from: "System", msg: "Recording started." },
  ]);

  // Score form state
  const initialCriteria: ScoreCriterion[] = useMemo(
    () =>
      INTERVIEW_CRITERIA.map((label) => ({
        key: label,
        label,
        score: applicant?.interviewScore?.criteria.find((c) => c.key === label)?.score ?? 3,
        remarks: applicant?.interviewScore?.criteria.find((c) => c.key === label)?.remarks ?? "",
      })),
    [applicant]
  );
  const [criteria, setCriteria] = useState<ScoreCriterion[]>(initialCriteria);

  if (!applicant) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setView("hr:interviews")} className="text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Interviews
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Video className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No applicant selected for video conferencing.</p>
            <Button className="mt-4" onClick={() => setView("hr:interviews")}>
              Pick from Interviews
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalScore = criteria.reduce((s, c) => s + c.score, 0) * 2; // 10 criteria * 5 * 2 = 100
  const recommendation = calcRecommendation(totalScore);

  function updateCriterion(key: string, patch: Partial<ScoreCriterion>) {
    setCriteria((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function sendChat() {
    if (!chatMsg.trim()) return;
    setChat([...chat, { from: currentUser?.name ?? "HR", msg: chatMsg.trim() }]);
    setChatMsg("");
  }

  function saveScore() {
    const score: InterviewScore = {
      applicantId: applicant!.id,
      positionApplied: job?.title ?? "—",
      department: job?.department ?? "—",
      date: new Date().toISOString().slice(0, 10),
      criteria,
      totalScore,
      recommendation,
      interviewer: currentUser?.name ?? "HR Interviewer",
    };
    saveInterviewScore(applicant!.id, score);
    toast({
      title: "Interview Score Saved",
      description: `${applicant!.name} — ${totalScore}/100 (${recommendation})`,
    });
  }

  const isFaceToFace = applicant.schedule?.platform === "Face-to-Face";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setView("hr:interviews")} className="text-primary">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-primary">Interview — {applicant.name}</h1>
            <p className="text-xs text-muted-foreground">
              {job?.title} · {job?.department}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <Switch
              checked={showVideo}
              onCheckedChange={setShowVideo}
              className="scale-90"
            />
            <span className="text-xs text-muted-foreground">Video tiles</span>
          </div>
          <Button onClick={saveScore} className="bg-green-600 hover:bg-green-700">
            <Save className="mr-1 h-4 w-4" /> Save Score
          </Button>
        </div>
      </div>

      {isFaceToFace && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            This is a <strong>Face-to-Face</strong> interview ({applicant.schedule?.location}).
            Video tiles are hidden by default — toggle them on above if needed. The Interview Report Form on the right is fully accessible during the in-person session.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Video / Meeting */}
        <div className="lg:col-span-2 space-y-4">
          {showVideo && !isFaceToFace && (
            <Card>
              <CardContent className="pt-0">
                {/* Video tiles */}
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-900 p-2">
                  <VideoTile name={applicant.name} color="#1e3a8a" camOn={true} primary />
                  <VideoTile name={currentUser?.name ?? "Interviewer"} color="#0e7490" camOn={camOn} />
                  <VideoTile name="Observer 1" color="#5b21b6" camOn={false} />
                  <VideoTile name="Observer 2" color="#b45309" camOn={false} />
                </div>

                {/* Controls */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <ControlButton active={micOn} onClick={() => setMicOn(!micOn)} activeIcon={<Mic className="h-4 w-4" />} inactiveIcon={<MicOff className="h-4 w-4" />} label="Mic" />
                  <ControlButton active={camOn} onClick={() => setCamOn(!camOn)} activeIcon={<Video className="h-4 w-4" />} inactiveIcon={<VideoOff className="h-4 w-4" />} label="Camera" />
                  <Button size="sm" variant="outline" className="h-9">
                    <ScreenShare className="h-4 w-4" />
                  </Button>
                  <Button size="sm" className="h-9 bg-red-600 hover:bg-red-700">
                    <PhoneOff className="h-4 w-4 mr-1" /> End
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Participant list + Chat */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-primary flex items-center gap-2">
                  <Users className="h-4 w-4" /> Participants (4)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <ParticipantRow name={applicant.name} role="Applicant" color="#1e3a8a" mic={true} cam={true} />
                <ParticipantRow name={currentUser?.name ?? "Interviewer"} role="Host" color="#0e7490" mic={micOn} cam={camOn} />
                <ParticipantRow name="Observer 1" role="Observer" color="#5b21b6" mic={false} cam={false} />
                <ParticipantRow name="Observer 2" role="Observer" color="#b45309" mic={false} cam={false} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-primary flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto scroll-thin space-y-2 mb-2 rounded-md bg-muted/30 p-2">
                  {chat.map((c, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-semibold text-primary">{c.from}:</span>{" "}
                      <span className="text-foreground">{c.msg}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                    placeholder="Type a message…"
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="h-8 w-8 p-0" onClick={sendChat}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: Interview Report Form */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">Interview Report Form</CardTitle>
            <CardDescription className="text-xs">
              Rate each criterion 1 (Poor) – 5 (Excellent). Total = Σ × 2, max 100.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Applicant header */}
            <div className="rounded-lg bg-muted/30 p-3 mb-3">
              <div className="flex items-center gap-2">
                <HexagonAvatar name={applicant.name} size={36} color="#1e3a8a" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{applicant.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{job?.title}</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <div><span className="text-muted-foreground">Dept:</span> <span className="font-medium">{job?.department}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{formatDate(applicant.schedule?.date ?? new Date().toISOString().slice(0, 10))}</span></div>
                <div><span className="text-muted-foreground">Interviewer:</span> <span className="font-medium">{currentUser?.name ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Platform:</span> <span className="font-medium">{applicant.schedule?.platform ?? "—"}</span></div>
              </div>
            </div>

            {/* Criteria */}
            <div className="max-h-[28rem] overflow-y-auto scroll-thin space-y-2 pr-1">
              {criteria.map((c) => (
                <div key={c.key} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-medium">{c.label}</Label>
                    <Select
                      value={String(c.score)}
                      onValueChange={(v) => updateCriterion(c.key, { score: Number(v) })}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} — {SCORE_LABELS[n - 1]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={c.remarks}
                    onChange={(e) => updateCriterion(c.key, { remarks: e.target.value })}
                    placeholder="Remarks…"
                    className="h-7 mt-1.5 text-xs"
                  />
                </div>
              ))}
            </div>

            <Separator className="my-3" />

            {/* Total + recommendation */}
            <div className="rounded-lg bg-primary/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Score</p>
              <p className="text-3xl font-bold text-primary">{totalScore}<span className="text-sm text-muted-foreground">/100</span></p>
              <div className="mt-2 flex justify-center">
                <HexagonBadge color={recommendationColor(recommendation)}>
                  {recommendation}
                </HexagonBadge>
              </div>
            </div>

            <Button onClick={saveScore} className="w-full mt-3 bg-green-600 hover:bg-green-700">
              <Save className="mr-1 h-4 w-4" /> Save Interview Score
            </Button>

            {applicant.interviewScore && (
              <p className="mt-2 text-[10px] text-center text-muted-foreground">
                A score is already on file (saved: {applicant.interviewScore.totalScore}/100). Saving will overwrite it.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VideoTile({
  name,
  color,
  camOn,
  primary,
}: {
  name: string;
  color: string;
  camOn: boolean;
  primary?: boolean;
}) {
  return (
    <div className={`relative aspect-video rounded-md flex items-center justify-center overflow-hidden ${primary ? "ring-2 ring-gold" : "ring-1 ring-white/10"}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
      <div className="relative flex flex-col items-center gap-1">
        {camOn ? (
          <HexagonAvatar name={name} color={color} size={48} />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700">
            <VideoOff className="h-5 w-5 text-zinc-400" />
          </div>
        )}
        <span className="text-xs text-zinc-300 font-medium">{name}</span>
      </div>
      {primary && (
        <span className="absolute top-1 left-1 rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold text-gold-foreground">
          APPLICANT
        </span>
      )}
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  activeIcon,
  inactiveIcon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "outline" : "default"}
      onClick={onClick}
      className={`h-9 ${!active ? "bg-red-600 hover:bg-red-700" : ""}`}
      title={label}
    >
      {active ? activeIcon : inactiveIcon}
    </Button>
  );
}

function ParticipantRow({
  name,
  role,
  color,
  mic,
  cam,
}: {
  name: string;
  role: string;
  color: string;
  mic: boolean;
  cam: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md hover:bg-muted/40 px-2 py-1">
      <div className="flex items-center gap-2">
        <HexagonAvatar name={name} color={color} size={22} />
        <div>
          <p className="text-xs font-medium">{name}</p>
          <p className="text-[10px] text-muted-foreground">{role}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {mic ? <Mic className="h-3 w-3 text-green-600" /> : <MicOff className="h-3 w-3 text-red-600" />}
        {cam ? <Video className="h-3 w-3 text-green-600" /> : <VideoOff className="h-3 w-3 text-red-600" />}
      </div>
    </div>
  );
}
