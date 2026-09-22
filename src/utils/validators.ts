/**
 * @file
 * Validation and sanitization utilities for feature names and paths.
 */

/**
 * Regular expression validating strict kebab-case naming.
 * Examples: 'auth-service', 'user-login-v2', 'payment-gateway'
 */
export const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Checks if a given string adheres to kebab-case convention.
 *
 * @param name
 *   The name string to test.
 *
 * @return
 *   True if valid kebab-case; otherwise false.
 */
export function isValidKebabCase(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 64) {
    return false;
  }
  return KEBAB_CASE_REGEX.test(trimmed);
}

/**
 * Validates user input in VS Code input box for new feature creation.
 *
 * @param input
 *   The input string from the user.
 *
 * @return
 *   Validation error message, or undefined if the input is valid.
 */
export function validateFeatureNameInput(input: string): string | undefined {
  if (!input || input.trim().length === 0) {
    return 'Feature name cannot be empty.';
  }

  const trimmed = input.trim();

  if (trimmed.length > 64) {
    return 'Feature name is too long (maximum 64 characters).';
  }

  if (trimmed !== trimmed.toLowerCase()) {
    return 'Feature name must be all lowercase (e.g. "auth-service").';
  }

  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return 'Feature name must not start or end with a hyphen.';
  }

  if (trimmed.includes('--')) {
    return 'Feature name must not contain consecutive hyphens.';
  }

  if (!KEBAB_CASE_REGEX.test(trimmed)) {
    return 'Feature name must contain only lowercase alphanumeric characters and hyphens (e.g. "payment-gateway", "user-auth").';
  }

  return undefined;
}

/**
 * Converts a kebab-case string to Title Case.
 * Example: 'user-auth-flow' -> 'User Auth Flow'
 *
 * @param kebab
 *   The kebab-case string.
 *
 * @return
 *   Title-cased string.
 */
export function toTitleCase(kebab: string): string {
  if (!kebab) {
    return '';
  }
  return kebab
    .split('-')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Sanitizes arbitrary text into valid kebab-case.
 *
 * @param input
 *   Raw string to sanitize.
 *
 * @return
 *   Sanitized kebab-case string.
 */
export function sanitizeKebabCase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
