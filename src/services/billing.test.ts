import { describe, expect, it, vi } from 'vitest';
import { normalizeProviderApiKeyPresent } from '../lib/billing';
import { fetchBillingState, startTrialOnce } from './billing';
import type { BillingState } from '../lib/billing';

/**
 * These tests exercise the normalization boundary between the Edge Function
 * and the frontend. The server returns a boolean; the service layer must
 * never pass an untrusted cast straight into the context. Missing or malformed
 * values must fail closed (false), which is the safe default: no API key.
 */

describe('normalizeProviderApiKeyPresent', () => {
  it('returns true only for the literal boolean true', () => {
    expect(normalizeProviderApiKeyPresent(true)).toBe(true);
  });

  it('fails closed for undefined (field absent)', () => {
    expect(normalizeProviderApiKeyPresent(undefined)).toBe(false);
  });

  it('fails closed for null', () => {
    expect(normalizeProviderApiKeyPresent(null)).toBe(false);
  });

  it('fails closed for a string "true" (not the boolean)', () => {
    // A JSON-misformatted server must not be able to coerce a string to truthy.
    expect(normalizeProviderApiKeyPresent('true')).toBe(false);
  });

  it('fails closed for the number 1', () => {
    expect(normalizeProviderApiKeyPresent(1)).toBe(false);
  });

  it('fails closed for the number 0', () => {
    expect(normalizeProviderApiKeyPresent(0)).toBe(false);
  });

  it('fails closed for an empty string', () => {
    expect(normalizeProviderApiKeyPresent('')).toBe(false);
  });
});

describe('normalizeBillingState (via fetchBillingState / startTrialOnce)', () => {
  it('normalizes a well-formed read response with providerApiKeyPresent true', async () => {
    vi.resetModules();
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, providerApiKeyPresent: true, trial: null },
      error: null,
    });
    vi.doMock('../lib/supabase', () => ({
      supabase: { functions: { invoke } },
      isSupabaseConfigured: true,
      getSupabaseConfigurationIssue: () => null,
    }));
    vi.doMock('../lib/errors', () => ({ userFacingError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));
    const mod = await import('./billing');
    const result = await mod.fetchBillingState();
    expect(result.providerApiKeyPresent).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.trial).toBeNull();
  });

  it('normalizes a read response where providerApiKeyPresent is absent', async () => {
    vi.resetModules();
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, trial: null },
      error: null,
    });
    vi.doMock('../lib/supabase', () => ({
      supabase: { functions: { invoke } },
      isSupabaseConfigured: true,
      getSupabaseConfigurationIssue: () => null,
    }));
    vi.doMock('../lib/errors', () => ({ userFacingError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));
    const mod = await import('./billing');
    const result = await mod.fetchBillingState();
    expect(result.providerApiKeyPresent).toBe(false);
  });

  it('normalizes a start-trial response with providerApiKeyPresent false', async () => {
    vi.resetModules();
    const invoke = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        providerApiKeyPresent: false,
        trial: {
          userId: 'u1',
          entitlement: 'trialing',
          trialStart: '2026-10-31T00:00:00.000Z',
          trialEnd: '2999-01-01T00:00:00.000Z',
          created: true,
        },
      },
      error: null,
    });
    vi.doMock('../lib/supabase', () => ({
      supabase: { functions: { invoke } },
      isSupabaseConfigured: true,
      getSupabaseConfigurationIssue: () => null,
    }));
    vi.doMock('../lib/errors', () => ({ userFacingError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));
    const mod = await import('./billing');
    const result = await mod.startTrialOnce();
    expect(result.providerApiKeyPresent).toBe(false);
    expect(result.trial?.entitlement).toBe('trialing');
    expect(result.trial?.created).toBe(true);
  });

  it('throws when the server reports an error', async () => {
    vi.resetModules();
    const invoke = vi.fn().mockResolvedValue({
      data: { error: 'Unable to start the trial. Please try again.' },
      error: null,
    });
    vi.doMock('../lib/supabase', () => ({
      supabase: { functions: { invoke } },
      isSupabaseConfigured: true,
      getSupabaseConfigurationIssue: () => null,
    }));
    vi.doMock('../lib/errors', () => ({ userFacingError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));
    const mod = await import('./billing');
    await expect(mod.startTrialOnce()).rejects.toThrow(/Unable to start the trial/);
  });
});

describe('BillingState contract', () => {
  // The context reads providerApiKeyPresent as a boolean. The normalized
  // service output must always satisfy that contract, even for malformed
  // server payloads.
  it('normalized state always has a boolean providerApiKeyPresent', async () => {
    const rawPayloads: Array<Record<string, unknown>> = [
      { ok: true, providerApiKeyPresent: true, trial: null },
      { ok: true, providerApiKeyPresent: false, trial: null },
      { ok: true, trial: null },
      { ok: true, providerApiKeyPresent: 'yes', trial: null },
      { ok: true, providerApiKeyPresent: 1, trial: null },
    ];
    for (const raw of rawPayloads) {
      const state: BillingState = {
        ok: raw.ok === true,
        providerApiKeyPresent: normalizeProviderApiKeyPresent(raw.providerApiKeyPresent),
        trial: (raw.trial as BillingState['trial']) ?? null,
      };
      expect(typeof state.providerApiKeyPresent).toBe('boolean');
    }
  });
});