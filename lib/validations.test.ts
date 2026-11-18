import { z } from 'zod';

import * as validationModule from './validations';
import * as validationIndex from './validations/index';

describe('form validation schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid login input', () => {
      const result = validationModule.loginSchema.safeParse({
        username: 'tester',
        password: 'secret12',
        captcha: 'a1b2',
      });
      expect(result.success).toBe(true);
    });

    it('rejects short username and captcha', () => {
      const result = validationModule.loginSchema.safeParse({
        username: 'ab',
        password: 'secret12',
        captcha: 'a1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    const valid = {
      username: 'tester',
      password: 'StrongPass1!',
      confirmPassword: 'StrongPass1!',
      email: 'tester@example.com',
      name: '测试用户',
      csrfToken: 'token',
    };

    it('accepts matching strong passwords', () => {
      expect(validationModule.registerSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects mismatched confirm password', () => {
      expect(validationModule.registerSchema.safeParse({
        ...valid,
        confirmPassword: 'Different1!',
      }).success).toBe(false);
    });

    it('rejects weak password', () => {
      expect(validationModule.registerSchema.safeParse({
        ...valid,
        password: 'weakpass',
        confirmPassword: 'weakpass',
      }).success).toBe(false);
    });
  });

  describe('customer and task schemas', () => {
    it('validates customer phone and optional fields', () => {
      expect(validationModule.customerSchema.safeParse({
        name: '张三',
        phone: '13800138000',
        memberNo: 'M001',
        csrfToken: 'token',
      }).success).toBe(true);

      expect(validationModule.customerSchema.safeParse({
        name: '张',
        phone: '123',
        memberNo: '',
        csrfToken: 'token',
      }).success).toBe(false);
    });

    it('validates task date and time formats', () => {
      expect(validationModule.taskSchema.safeParse({
        content: '巡检',
        date: '2026-11-18',
        time: '09:30',
        assignedTo: 'tester',
        csrfToken: 'token',
      }).success).toBe(true);

      expect(validationModule.taskSchema.safeParse({
        content: '',
        date: '2026/11/18',
        time: '9:30',
        assignedTo: '',
        csrfToken: 'token',
      }).success).toBe(false);
    });
  });

  describe('userQuerySchema defaults', () => {
    it('applies defaults and validates sortOrder', () => {
      const parsed = validationModule.userQuerySchema.parse({});
      expect(parsed).toEqual({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(validationModule.userQuerySchema.safeParse({ sortOrder: 'invalid' }).success).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    it('formats issues from both validation modules', () => {
      const result = validationModule.loginSchema.safeParse({ username: 'ab', password: 'x', captcha: 'x' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(validationModule.formatValidationErrors(result.error).username).toBeDefined();
        expect(validationIndex.formatValidationErrors(result.error).username).toBeDefined();
      }
    });
  });

  describe('validateInput', () => {
    it('returns success for both implementations', async () => {
      await expect(validationModule.validateInput(validationModule.loginSchema, {
        username: 'tester', password: 'secret12', captcha: 'a1b2',
      })).resolves.toMatchObject({ success: true });

      await expect(validationIndex.validateInput(z.string(), 'value')).resolves.toEqual({
        success: true,
        data: 'value',
      });
    });

    it('returns Zod errors for both implementations', async () => {
      const first = await validationModule.validateInput(z.string(), 123);
      expect(first.success).toBe(false);
      expect(first.errors).toBeInstanceOf(z.ZodError);

      const second = await validationIndex.validateInput(z.number(), 'bad');
      expect(second.success).toBe(false);
      expect(second.errors).toBeInstanceOf(z.ZodError);
    });

    it('rethrows non-Zod errors', async () => {
      const badSchema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('boom')),
      } as unknown as z.ZodSchema<unknown>;

      await expect(validationModule.validateInput(badSchema, {})).rejects.toThrow('boom');
      await expect(validationIndex.validateInput(badSchema, {})).rejects.toThrow('boom');
    });
  });

  describe('basic schemas', () => {
    it('parse primitive values', () => {
      expect(validationIndex.basicStringSchema.parse('text')).toBe('text');
      expect(validationIndex.basicNumberSchema.parse(1)).toBe(1);
      expect(validationIndex.basicBooleanSchema.parse(false)).toBe(false);
    });
  });
});
