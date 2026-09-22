/**
 * @file
 * Unit tests for validation and string utility functions.
 */

import * as assert from 'assert';
import {
  isValidKebabCase,
  sanitizeKebabCase,
  toTitleCase,
  validateFeatureNameInput,
} from '../../src/utils/validators';

describe('Validators Unit Tests', () => {
  describe('isValidKebabCase', () => {
    it('should validate standard kebab-case names', () => {
      assert.strictEqual(isValidKebabCase('auth-flow'), true);
      assert.strictEqual(isValidKebabCase('payment-service-v2'), true);
      assert.strictEqual(isValidKebabCase('user123'), true);
      assert.strictEqual(isValidKebabCase('api-v1-gateway'), true);
    });

    it('should reject invalid names', () => {
      assert.strictEqual(isValidKebabCase(''), false);
      assert.strictEqual(isValidKebabCase('AuthFlow'), false);
      assert.strictEqual(isValidKebabCase('auth_flow'), false);
      assert.strictEqual(isValidKebabCase('-leading-hyphen'), false);
      assert.strictEqual(isValidKebabCase('trailing-hyphen-'), false);
      assert.strictEqual(isValidKebabCase('double--hyphen'), false);
      assert.strictEqual(isValidKebabCase('spaces in name'), false);
      assert.strictEqual(isValidKebabCase('special!chars'), false);
    });
  });

  describe('validateFeatureNameInput', () => {
    it('should return undefined for valid inputs', () => {
      assert.strictEqual(validateFeatureNameInput('checkout-cart'), undefined);
      assert.strictEqual(validateFeatureNameInput('user-login'), undefined);
    });

    it('should return meaningful error messages for invalid inputs', () => {
      assert.ok(validateFeatureNameInput(''));
      assert.ok(validateFeatureNameInput('Checkout'));
      assert.ok(validateFeatureNameInput('-cart'));
      assert.ok(validateFeatureNameInput('cart-'));
      assert.ok(validateFeatureNameInput('user--auth'));
      assert.ok(validateFeatureNameInput('cart item'));
    });
  });

  describe('toTitleCase', () => {
    it('should convert kebab-case strings to Title Case', () => {
      assert.strictEqual(toTitleCase('auth-flow'), 'Auth Flow');
      assert.strictEqual(toTitleCase('user-profile-editor'), 'User Profile Editor');
      assert.strictEqual(toTitleCase('checkout'), 'Checkout');
    });

    it('should handle empty input gracefully', () => {
      assert.strictEqual(toTitleCase(''), '');
    });
  });

  describe('sanitizeKebabCase', () => {
    it('should sanitize raw input into valid kebab-case', () => {
      assert.strictEqual(sanitizeKebabCase('User Auth Flow!'), 'user-auth-flow');
      assert.strictEqual(sanitizeKebabCase('  Payment Gateway v2  '), 'payment-gateway-v2');
      assert.strictEqual(sanitizeKebabCase('Multiple___Under__Scores'), 'multiple-under-scores');
    });
  });
});
