// lib/validators.ts
// ------------------------------------------------------------------
// Shared validation helpers. WordPress does final validation on the
// server; these give immediate client-side feedback.
// ------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(fields: {
  username: string;
  password: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!fields.username.trim()) errors.username = "Username is required.";
  if (!fields.password) errors.password = "Password is required.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateRegisterForm(fields: {
  username: string;
  email: string;
  password: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!fields.username.trim()) errors.username = "Username is required.";
  if (!fields.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!fields.password) {
    errors.password = "Password is required.";
  } else if (fields.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateDetailsForm(fields: {
  firstName: string;
  lastName: string;
  email: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!fields.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validatePasswordChange(fields: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!fields.currentPassword)
    errors.currentPassword = "Current password is required.";
  if (!fields.newPassword) {
    errors.newPassword = "New password is required.";
  } else if (fields.newPassword.length < 8) {
    errors.newPassword = "Password must be at least 8 characters.";
  }
  if (fields.newPassword !== fields.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateAddressForm(fields: {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  postcode: string;
  country: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!fields.firstName.trim()) errors.firstName = "First name is required.";
  if (!fields.lastName.trim()) errors.lastName = "Last name is required.";
  if (!fields.address1.trim()) errors.address1 = "Address is required.";
  if (!fields.city.trim()) errors.city = "City is required.";
  if (!fields.postcode.trim()) errors.postcode = "Postcode is required.";
  if (!fields.country.trim()) errors.country = "Country is required.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateForgotPasswordForm(fields: {
  username: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!fields.username.trim())
    errors.username = "Username or email is required.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateResetPasswordForm(fields: {
  password: string;
  confirmPassword: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!fields.password) {
    errors.password = "Password is required.";
  } else if (fields.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
