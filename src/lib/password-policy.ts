export const PASSWORD_REQUIREMENTS_MESSAGE = "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.";

export function validatePasswordRequirements(password: string) {
  const value = password.trim();
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}
