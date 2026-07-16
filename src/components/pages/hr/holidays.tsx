"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Holiday, HolidayType } from "@/lib/types";
import { holidayColor, formatDate } from "@/components/shared/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Mail, ChevronLeft, ChevronRight, CalendarDays, CalendarOff, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffHolidayRecords } from "@/hooks/use-holidays";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const HOLIDAY_TYPES: HolidayType[] = ["Regular Holiday", "Special Non-Working Day", "Special Working Holiday", "Institution Holiday"];
const MIN_PICKER_YEAR = 2025;

type HolidayFormState = {
  name: string;
  date: string;
  type: HolidayType;
};

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultForm(year: number, month: number): HolidayFormState {
  return {
    name: "",
    date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    type: "Institution Holiday",
  };
}

export function HolidaysPage() {
  const holidayQuery = useStaffHolidayRecords();
  const holidays = holidayQuery.data?.holidays ?? [];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toLocalDateString(today), [today]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayFormState>(() => buildDefaultForm(today.getFullYear(), today.getMonth()));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const holidaysThisMonth = useMemo(
    () => holidays.filter((holiday) => {
      const date = new Date(`${holiday.date}T00:00:00`);
      return date.getFullYear() === year && date.getMonth() === month;
    }),
    [holidays, year, month],
  );
  const upcoming = useMemo(() => holidays.filter((holiday) => holiday.date >= todayStr).slice(0, 6), [holidays, todayStr]);

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; date: string; type: HolidayType }) => {
      const response = await fetch("/api/hr/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to add holiday.");
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-holidays"] }),
        queryClient.invalidateQueries({ queryKey: ["holidays"] }),
      ]);
      setOpen(false);
      toast({ title: "Holiday added", description: "The holiday is now visible to employees too." });
    },
    onError: (error) => toast({ title: "Unable to add holiday", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; date: string; type: HolidayType }) => {
      const response = await fetch("/api/hr/holidays", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to update holiday.");
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-holidays"] }),
        queryClient.invalidateQueries({ queryKey: ["holidays"] }),
      ]);
      setOpen(false);
      toast({ title: "Holiday updated", description: "The updated holiday is reflected in the employee calendar." });
    },
    onError: (error) => toast({ title: "Unable to update holiday", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hr/holidays?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to delete holiday.");
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-holidays"] }),
        queryClient.invalidateQueries({ queryKey: ["holidays"] }),
      ]);
      setDeleteId(null);
      toast({ title: "Holiday deleted", description: "The holiday was removed from both HR and employee views." });
    },
    onError: (error) => toast({ title: "Unable to delete holiday", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function resetForm() {
    setEditing(null);
    setForm(buildDefaultForm(year, month));
  }

  function handleDialogChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !busy) {
      resetForm();
    }
  }

  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
      return;
    }
    setMonth((value) => value - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
      return;
    }
    setMonth((value) => value + 1);
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const holidayByDay = (day: number): Holiday | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return holidaysThisMonth.find((holiday) => holiday.date === dateStr);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(buildDefaultForm(year, month));
    setOpen(true);
  };

  const openEdit = (holiday: Holiday) => {
    setEditing(holiday);
    setForm({ name: holiday.name, date: holiday.date, type: holiday.type });
    const date = new Date(`${holiday.date}T00:00:00`);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim() || !form.date) {
      toast({ title: "Missing fields", description: "Holiday name and date are required.", variant: "destructive" });
      return;
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, name: form.name.trim(), date: form.date, type: form.type });
      return;
    }

    createMutation.mutate({ name: form.name.trim(), date: form.date, type: form.type });
  };

  if (holidayQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading holidays...</div>;
  }

  if (holidayQuery.error) {
    return <div className="p-6 text-muted-foreground">{holidayQuery.error instanceof Error ? holidayQuery.error.message : "Unable to load holidays."}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Holiday Calendar</h2>
            <p className="text-xs text-muted-foreground">University of Cebu - South Campus - Company and school holidays</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <p><strong>Automated Email Reminder:</strong> The "Upcoming Holiday Reminder" template triggers before each holiday and sends a branded notice to employees.</p>
          </div>
        </div>
        <Button onClick={openAdd} className="shrink-0"><Plus className="h-4 w-4" /> Add / Customize Holiday</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" />{MONTH_NAMES[month]} {year}</CardTitle>
                <CardDescription>Real saved holiday records shared with the employee calendar.</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={goToPrevMonth} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={goToNextMonth} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((weekday) => <div key={weekday} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{weekday}</div>)}
              {cells.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="aspect-square" />;
                const holiday = holidayByDay(day);
                const cellDate = new Date(year, month, day);
                const isToday = toLocalDateString(cellDate) === todayStr;
                const isWeekend = index % 7 === 0 || index % 7 === 6;
                return (
                  <div key={`day-${day}`} title={holiday?.name} className={cn("relative flex aspect-square flex-col items-start justify-start rounded-lg border p-1.5 text-xs transition-colors", holiday ? "border-transparent" : isToday ? "border-primary ring-1 ring-primary" : "border-border bg-card")} style={holiday ? { backgroundColor: `${holidayColor(holiday.type)}18`, borderColor: `${holidayColor(holiday.type)}55` } : undefined}>
                    <span className={cn("font-semibold", isToday && !holiday && "text-primary", isWeekend && !holiday && "text-muted-foreground")} style={holiday ? { color: holidayColor(holiday.type) } : undefined}>{day}</span>
                    {holiday && <span className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight" style={{ color: holidayColor(holiday.type) }}>{holiday.name}</span>}
                    {holiday && <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: holidayColor(holiday.type) }} />}
                  </div>
                );
              })}
            </div>
            <Legend />
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming Holidays</CardTitle>
            <CardDescription>Next 6 upcoming dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming holidays.</p> : upcoming.map((holiday) => {
              const color = holidayColor(holiday.type);
              const date = new Date(`${holiday.date}T00:00:00`);
              return (
                <div key={holiday.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md text-white" style={{ backgroundColor: color }}>
                      <span className="text-[9px] uppercase leading-none">{date.toLocaleDateString("en-US", { month: "short" })}</span>
                      <span className="text-base font-bold leading-none">{date.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(holiday.date)}</p>
                      <Badge variant="outline" className="mt-1" style={{ color, borderColor: color }}>{holiday.type}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(holiday)} disabled={busy}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDeleteId(holiday.id)} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarOff className="h-4 w-4 text-primary" /> All Scheduled Holidays</CardTitle>
          <CardDescription>Complete list of declared holidays in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => {
                  const color = holidayColor(holiday.type);
                  const date = new Date(`${holiday.date}T00:00:00`);
                  return (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{formatDate(holiday.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{date.toLocaleDateString("en-US", { weekday: "long" })}</TableCell>
                      <TableCell>{holiday.name}</TableCell>
                      <TableCell><Badge variant="outline" style={{ color, borderColor: color }}><span className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{holiday.type}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(holiday)} disabled={busy} aria-label={`Edit ${holiday.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteId(holiday.id)} disabled={busy} aria-label={`Delete ${holiday.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
            <DialogDescription>Add or update a holiday entry used by the HR and employee calendar views. New custom entries are saved as institution holidays by default.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Holiday Name</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. UC South Campus Foundation Day" disabled={busy} />
            </div>
            <HolidayDateField value={form.date} onChange={(value) => setForm((current) => ({ ...current, date: value }))} disabled={busy} />
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as HolidayType }))} disabled={busy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLIDAY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !form.name.trim() || !form.date}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save Changes" : "Add Holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this holiday?</AlertDialogTitle>
            <AlertDialogDescription>This action removes the holiday from both HR and employee calendar views.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700" disabled={busy}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HolidayDateField({ value, onChange, disabled = false }: { value?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const parsedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const isValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
  const [displayMonth, setDisplayMonth] = useState<Date>(isValidDate ? parsedDate : new Date());
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - MIN_PICKER_YEAR + 4 }, (_, index) => currentYear + 3 - index);
  }, []);

  useEffect(() => {
    if (isValidDate && parsedDate) {
      setDisplayMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
    }
  }, [isValidDate, parsedDate?.getFullYear(), parsedDate?.getMonth()]);

  const activeMonthLabel = MONTH_NAMES[displayMonth.getMonth()];
  const activeYear = displayMonth.getFullYear();

  function moveMonth(direction: -1 | 1) {
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function selectMonth(monthIndex: number) {
    setDisplayMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setMonthOpen(false);
  }

  function selectYear(nextYear: number) {
    setDisplayMonth((current) => new Date(nextYear, current.getMonth(), 1));
    setYearOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label>Date</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background",
              !isValidDate && "text-muted-foreground",
            )}
          >
            <span>{isValidDate && parsedDate ? format(parsedDate, "MMMM d, yyyy") : "Select date"}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-auto overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
          <div className="border-b border-border/60 px-3 pb-3 pt-4">
            <div className="relative flex items-center justify-center px-8">
              <Button type="button" variant="ghost" size="icon" className="absolute left-0 size-8 rounded-lg" onClick={() => moveMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center gap-2.5">
                <Popover open={monthOpen} onOpenChange={setMonthOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[6.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium" disabled={disabled}>
                      <span>{activeMonthLabel}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid gap-1">
                        {MONTH_NAMES.map((monthName, index) => (
                          <Button key={monthName} type="button" variant={index === displayMonth.getMonth() ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectMonth(index)}>
                            {monthName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover open={yearOpen} onOpenChange={setYearOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[5.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium" disabled={disabled}>
                      <span>{activeYear}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-72 w-28 overflow-y-auto p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="grid gap-1">
                      {years.map((entryYear) => (
                        <Button key={entryYear} type="button" variant={entryYear === activeYear ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectYear(entryYear)}>
                          {entryYear}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 size-8 rounded-lg" onClick={() => moveMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Calendar
            mode="single"
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            selected={isValidDate ? parsedDate : undefined}
            onSelect={(selectedDate) => {
              if (!selectedDate) {
                return;
              }
              onChange(format(selectedDate, "yyyy-MM-dd"));
            }}
            hideNavigation
            className="flex justify-center px-4 pb-4 pt-4"
            classNames={{
              root: "mx-auto w-fit",
              months: "w-fit",
              month: "w-fit gap-3",
              month_caption: "hidden",
              table: "w-full table-fixed border-collapse",
              weekdays: "grid grid-cols-7",
              week: "mt-2 grid grid-cols-7",
              weekday: "text-center text-[0.8rem] font-normal text-muted-foreground",
              day: "relative p-0 text-center",
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
      {HOLIDAY_TYPES.map((type) => (
        <span key={type} className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: holidayColor(type) }} />{type}</span>
      ))}
    </div>
  );
}



