/**
 * Pagination Utils Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  createPaginationResult,
  createCursorPaginationResult,
} from '@/utils/pagination';

describe('Pagination Utils', () => {
  describe('parsePaginationParams', () => {
    it('should use default values when no params provided', () => {
      const result = parsePaginationParams({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('created_at');
      expect(result.sortOrder).toBe('desc');
    });

    it('should parse provided params', () => {
      const result = parsePaginationParams({
        page: 3,
        limit: 50,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
      expect(result.sortBy).toBe('name');
      expect(result.sortOrder).toBe('asc');
    });

    it('should enforce minimum page', () => {
      const result = parsePaginationParams({ page: 0 });
      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit', () => {
      const result = parsePaginationParams({ limit: 200 });
      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit', () => {
      const result = parsePaginationParams({ limit: 0 });
      expect(result.limit).toBe(1);
    });
  });

  describe('createPaginationResult', () => {
    it('should create pagination result with correct metadata', () => {
      const items = [1, 2, 3, 4, 5];
      const result = createPaginationResult(items, 50, { page: 2, limit: 5, sortBy: 'id', sortOrder: 'asc' });

      expect(result.data).toEqual(items);
      expect(result.total).toBe(50);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(10);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);
    });

    it('should handle first page', () => {
      const items = [1, 2, 3];
      const result = createPaginationResult(items, 10, { page: 1, limit: 3, sortBy: 'id', sortOrder: 'asc' });

      expect(result.hasPreviousPage).toBe(false);
      expect(result.hasNextPage).toBe(true);
    });

    it('should handle last page', () => {
      const items = [1];
      const result = createPaginationResult(items, 10, { page: 4, limit: 3, sortBy: 'id', sortOrder: 'asc' });

      expect(result.hasPreviousPage).toBe(true);
      expect(result.hasNextPage).toBe(false);
    });

    it('should handle single page', () => {
      const items = [1, 2, 3];
      const result = createPaginationResult(items, 3, { page: 1, limit: 10, sortBy: 'id', sortOrder: 'asc' });

      expect(result.totalPages).toBe(1);
      expect(result.hasPreviousPage).toBe(false);
      expect(result.hasNextPage).toBe(false);
    });

    it('should handle empty results', () => {
      const result = createPaginationResult([], 0, { page: 1, limit: 10, sortBy: 'id', sortOrder: 'asc' });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('createCursorPaginationResult', () => {
    it('should create cursor pagination result', () => {
      const items = [
        { id: '3', name: 'C' },
        { id: '4', name: 'D' },
        { id: '5', name: 'E' },
      ];
      const result = createCursorPaginationResult(items, 3, 'id');

      expect(result.data).toEqual(items);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('5');
    });

    it('should handle last page', () => {
      const items = [
        { id: '8', name: 'H' },
        { id: '9', name: 'I' },
      ];
      const result = createCursorPaginationResult(items, 3, 'id');

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should handle empty results', () => {
      const result = createCursorPaginationResult([], 10, 'id');

      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });
  });
});
