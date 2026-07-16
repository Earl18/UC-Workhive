"use client";

import { useMemo, useState } from "react";
import type { HolidayType, Holiday } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { holidayColor, formatDate } from "@/components/shared/helpers";
import { ChevronLeft, ChevronRight, CalendarDays, CalendarOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHolidayRecords } from "@/hooks/use-holidays";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOLIDAY_TYPES: HolidayType[] = [
  "Regular Holiday",
  "Special Non-Working Day",
  "Special Working Holiday",
  "Institution Holiday",
];

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function HolidaysPage() {
  const holidayQuery = useHolidayRecords();
  const holidays = holidayQuery.data?.holidays ?? [];
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toLocalDateString(today), [today]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const holidaysThisMonth = useMemo(
    () =>
      holidays
        .filter((holiday) => {
          const date = new Date(`${holiday.date}T00:00:00`);
          return date.getFullYear() === year && date.getMonth() === month;
        })
        .sort((left, right) => left.date.localeCompare(right.date)),
    [holidays, year, month],
  );

  const upcoming = useMemo(
    () => holidays.filter((holiday) => holiday.date >= todayStr).slice(0, 6),
    [holidays, todayStr],
  );

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

  if (holidayQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading holidays...</div>;
  }

  if (holidayQuery.error) {
    return <div className="p-6 text-muted-foreground">{holidayQuery.error instanceof Error ? holidayQuery.error.message : "Unable to load holidays."}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Holiday Calendar</h2>
        <p className="text-xs text-muted-foreground">
          University of Cebu - South Campus - Company and school holidays
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {MONTH_NAMES[month]} {year}
                </CardTitle>
                <CardDescription>
                  Read-only calendar - colored cells mark holidays.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={goToPrevMonth} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={goToNextMonth} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{weekday}</div>
              ))}
              {cells.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="aspect-square" />;
                const holiday = holidayByDay(day);
                const cellDate = new Date(year, month, day);
                const isToday = toLocalDateString(cellDate) === todayStr;
                const isWeekend = index % 7 === 0 || index % 7 === 6;
                return (
                  <div
                    key={`day-${day}`}
                    title={holiday?.name}
                    className={cn(
                      "relative flex aspect-square flex-col items-start justify-start rounded-lg border p-1.5 text-xs transition-colors",
                      holiday ? "border-transparent" : isToday ? "border-primary ring-1 ring-primary" : "border-border bg-card",
                    )}
                    style={holiday ? { backgroundColor: `${holidayColor(holiday.type)}18`, borderColor: `${holidayColor(holiday.type)}55` } : undefined}
                  >
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
                <div key={holiday.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
      {HOLIDAY_TYPES.map((type) => (
        <span key={type} className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: holidayColor(type) }} />
          {type}
        </span>
      ))}
    </div>
  );
}



