export const PASSWORD_RESET_COMPLETED_CHANNEL = "workhive-password-reset-completed";

export type PasswordResetCompleted = { email: string };

export const PASSWORD_RESET_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
