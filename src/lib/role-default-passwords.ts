import type { SystemSettingsRecord } from "@/lib/admin-types";
import type { Role } from "@/lib/types";

export const DEFAULT_ROLE_PASSWORDS: Record<Role, string> = {
  employee: "Employee@123",
  hr: "HR@123",
  admin: "Admin@123",
};

export const PASSWORD_REQUIREMENTS_MESSAGE = "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.";

export function getDefaultPasswordForRole(settings: Pick<SystemSettingsRecord, "employeeDefaultPassword" | "hrDefaultPassword" | "adminDefaultPassword">, role: Role) {
  if (role === "admin") {
    return settings.adminDefaultPassword;
  }

  if (role === "hr") {
    return settings.hrDefaultPassword;
  }

  return settings.employeeDefaultPassword;
}

export function getPasswordFieldForRole(role: Role) {
  if (role === "admin") {
    return "adminDefaultPassword" as const;
  }

  if (role === "hr") {
    return "hrDefaultPassword" as const;
  }

  return "employeeDefaultPassword" as const;
}

export function getPasswordVersionFieldForRole(role: Role) {
  if (role === "admin") {
    return "adminPasswordVersion" as const;
  }

  if (role === "hr") {
    return "hrPasswordVersion" as const;
  }

  return "employeePasswordVersion" as const;
}

export function validatePasswordRequirements(password: string) {
  const value = password.trim();
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}