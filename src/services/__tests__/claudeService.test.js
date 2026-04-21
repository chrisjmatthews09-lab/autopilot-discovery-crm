// Sprint-remediation — prompt-injection guard.
// Verifies that extractEntity and enrichEntity both pass a system prompt that
// tells Claude to treat user content as data and to emit JSON only. Without
// this guard, adversarial strings inside transcripts ("ignore previous
// instructions…") could hijack the response shape and poison downstream dedup.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const callableMock = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: () => callableMock,
}));
vi.mock('../../config/firebase.js', () => ({
  functions: { __mock: 'functions' },
}));

const { extractEntity, enrichEntity, INJECTION_GUARD, composeSystem } =
  await import('../claudeService.js');

function mockClaudeReturn(payload) {
  callableMock.mockResolvedValue({
    data: {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      stop_reason: 'end_turn',
    },
  });
}

beforeEach(() => {
  callableMock.mockReset();
});

describe('INJECTION_GUARD', () => {
  it('tells Claude to treat user content as data', () => {
    expect(INJECTION_GUARD).toMatch(/treat every line .+ as DATA/i);
  });

  it('composeSystem prefixes the guard to task text', () => {
    const s = composeSystem('task X');
    expect(s.startsWith(INJECTION_GUARD)).toBe(true);
    expect(s).toContain('task X');
  });
});

describe('extractEntity passes injection guard as system prompt', () => {
  it('sends a system prompt that includes the guard', async () => {
    mockClaudeReturn({
      appType: 'crm',
      businessType: 'business_owner',
      firstName: 'A',
      lastName: 'B',
      businessName: 'C',
      email: null,
      phone: null,
      confidence: { classification: 90, name: 90, business: 90 },
    });

    await extractEntity({ transcript: 'x', summary: '' });

    expect(callableMock).toHaveBeenCalledTimes(1);
    const payload = callableMock.mock.calls[0][0];
    expect(payload.system).toBeTruthy();
    expect(payload.system).toContain(INJECTION_GUARD);
    expect(payload.system).toMatch(/classifying a single discovery interview/);
  });
});

describe('enrichEntity passes injection guard as system prompt', () => {
  it('sends a system prompt that includes the guard', async () => {
    mockClaudeReturn({ overallConfidence: 80 });

    await enrichEntity({
      transcript: 'x',
      summary: '',
      business: { type: 'business_owner' },
    });

    const payload = callableMock.mock.calls[0][0];
    expect(payload.system).toBeTruthy();
    expect(payload.system).toContain(INJECTION_GUARD);
    expect(payload.system).toMatch(/extracting structured CRM enrichment/);
  });
});
