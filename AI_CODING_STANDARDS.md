# AI and Developer Coding Standards: Strict ESLint Type-Checking

This document outlines the strict ESLint and TypeScript rules that **both Developers and AI Assistants** must follow when contributing to the `examarchive-v3` codebase.

## 1. Strict Vercel Build Environment
Vercel is configured to run `npm run build` (via `next build`) on every deployment. During this build process, Next.js automatically runs ESLint across the entire codebase. 

**Crucially, this includes test files (e.g., inside `__tests__` directories).** Any ESLint error or TypeScript type error will result in a failed Vercel deployment.

## 2. No `any` Types (`@typescript-eslint/no-explicit-any`)
The use of the `any` type is strictly forbidden. The ESLint rule `@typescript-eslint/no-explicit-any` will flag any usage of `any` and cause the build to fail.

### For AI Assistants:
When generating, refactoring, or writing test code, **never** use the `any` type as a shortcut. Instead, use the following patterns:
- If the type is unknown, use `unknown` and perform type narrowing.
- When mocking modules or functions in Jest, use `jest.Mock` or `jest.SpyInstance`.
- If you need to type a mocked built-in object (e.g., `console.log`), use `typeof console.log`.
- Define specific interfaces or types for your objects and data structures.

**Bad Example (Will break build):**
```typescript
let originalConsoleLog: any;
originalConsoleLog = console.log;
```

**Good Example:**
```typescript
let originalConsoleLog: typeof console.log;
originalConsoleLog = console.log;
```

## 3. General TypeScript Best Practices
- **Strict Null Checks:** Always handle `null` and `undefined` properly.
- **Explicit Return Types:** Where possible, define explicit return types for functions, especially API routes and complex hooks.
- **Suppressing Errors:** If an ESLint error must be bypassed due to an unavoidable library limitation, use a specific disable comment (e.g., `// eslint-disable-next-line @typescript-eslint/no-explicit-any`) along with a comment explaining *why* it is necessary. Use this sparingly.

By following these strict type-checking rules, we ensure robust, bug-free, and successful Vercel deployments.
