"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FilterOption = {
  value: string;
  label: string;
};

export function FilterSelect({
  label,
  icon,
  value,
  onValueChange,
  options,
  triggerClassName,
  labelClassName,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  triggerClassName?: string;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "Select";

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className={cn("text-xs text-muted-foreground", labelClassName)}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-10 w-full justify-between rounded-md border bg-transparent px-3 text-sm font-normal shadow-xs hover:bg-transparent",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function SearchableFilterSelect({
  label,
  icon,
  value,
  onValueChange,
  options,
  searchPlaceholder,
  emptyLabel,
  triggerClassName,
  labelClassName,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  searchPlaceholder: string;
  emptyLabel: string;
  triggerClassName?: string;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "Select";

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className={cn("text-xs text-muted-foreground", labelClassName)}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-10 w-full justify-between rounded-md border bg-transparent px-3 text-sm font-normal shadow-xs hover:bg-transparent",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
