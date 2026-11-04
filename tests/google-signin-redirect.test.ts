import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The Google sign-in redirect URL must be derived from the current origin
 * so it works on any deployment (local, staging, production) without
 * hardcoding a domain. A stale hardcoded Vercel URL would silently send
 * production users to the wrong domain after OAuth.
 *
 * This is a source-level contract test because the project has no DOM
 * testing environment (jsdom / @testing-library are not installed).
 */
describe('Google sign-in redirect is dynamic, not hardcoded', () => {
  const loginPath = path.resolve('src/pages/auth/LoginPage.tsx');
  const login = fs.readFileSync(loginPath, 'utf8');

  it('does not contain a hardcoded ledgerly-v2.vercel.app redirect', () => {
    expect(login).not.toMatch(/ledgerly-v2\.vercel\.app/);
  });

  it('derives the redirect from window.location.origin', () => {
    expect(login).toMatch(/window\.location\.origin/);
  });

  it('redirects to the authenticated landing route /app', () => {
    // /app is the Dashboard route defined in src/App.tsx:75.
    expect(login).toMatch(/redirectTo:\s*`\$\{window\.location\.origin\}\/app`/);
  });
});