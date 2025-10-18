// src/utils/validators.ts
/**
 * Utility functions for data validation.
 */

/**
 * Checks if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks if a value is a valid email address.
 */
export function isValidEmail(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    // Simple email regex for demonstration purposes
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Checks if a value is a positive integer.
 */
export function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}