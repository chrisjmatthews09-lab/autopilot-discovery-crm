// Sprint-9 remediation — mergeContacts + undoMerge must commit atomically.
// Before the fix, the merge did five sequential updateDoc() calls; a failure
// partway through stranded interviews on a soft-deleted source with no undo
// record. These tests verify every mutation now rides in one batchWrite, and
// that a batch failure surfaces without side effects.

import { describe, it, expect, beforeEach, vi } from 'vitest';

let idCounter = 0;
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    collection: () => ({ __mock: 'coll' }),
    doc: () => ({ id: `gen-${++idCounter}` }),
    serverTimestamp: () => '__SERVER_TS__',
  };
});

vi.mock('../../config/firebase.js', () => ({
  db: { __mock: 'db' },
  auth: { currentUser: { uid: 'test-uid' } },
}));

const batchWriteMock = vi.fn(async () => {});
const getDocMock = vi.fn(async () => null);
const updateDocMock = vi.fn(async () => {});
const createDocMock = vi.fn(async (collection, data) => ({ id: 'created', ...data }));
const listDocsMock = vi.fn(async () => []);
const genIdMock = vi.fn(() => 'merge-new');

vi.mock('../firestore.js', () => ({
  batchWrite: (...args) => batchWriteMock(...args),
  getDoc: (...args) => getDocMock(...args),
  updateDoc: (...args) => updateDocMock(...args),
  createDoc: (...args) => createDocMock(...args),
  listDocs: (...args) => listDocsMock(...args),
  genId: (...args) => genIdMock(...args),
}));

const { mergeContacts, undoMerge } = await import('../merges.js');

beforeEach(() => {
  idCounter = 0;
  batchWriteMock.mockReset();
  batchWriteMock.mockResolvedValue(undefined);
  getDocMock.mockReset();
  updateDocMock.mockReset();
  createDocMock.mockReset();
  listDocsMock.mockReset();
  listDocsMock.mockResolvedValue([]);
  genIdMock.mockClear();
  genIdMock.mockReturnValue('merge-new');
});

describe('mergeContacts — atomicity', () => {
  const source = { id: 'p-src', firstName: 'Dan', email: 'd@x.com' };
  const target = { id: 'p-tgt', firstName: 'Daniel', mergedFromContactIds: [] };

  function wireHappyPath({ interviews = [], interactions = [] } = {}) {
    getDocMock.mockImplementation(async (coll, id) => {
      if (coll === 'people' && id === 'p-src') return source;
      if (coll === 'people' && id === 'p-tgt') return target;
      return null;
    });
    listDocsMock.mockImplementation(async (coll, filters) => {
      if (coll === 'interviews' && filters?.length) return interviews;
      if (coll === 'interviews') return interviews; // the full-scan fallback
      if (coll === 'interactions') return interactions;
      return [];
    });
  }

  it('writes every mutation through a single batchWrite', async () => {
    wireHappyPath({
      interviews: [
        { id: 'iv-1', linkedType: 'person', linkedContactId: 'p-src' },
      ],
      interactions: [
        { id: 'it-1', entity_type: 'person', entity_id: 'p-src' },
      ],
    });

    const result = await mergeContacts({ sourceId: 'p-src', targetId: 'p-tgt', kind: 'person' });

    expect(batchWriteMock).toHaveBeenCalledTimes(1);
    expect(updateDocMock).not.toHaveBeenCalled();
    expect(createDocMock).not.toHaveBeenCalled();

    const ops = batchWriteMock.mock.calls[0][0];
    const collections = ops.map((op) => `${op.collection}:${op.type}`);
    // Expected ops: interview update, interaction update, target update,
    // source soft-delete, merges record set.
    expect(collections).toContain('interviews:update');
    expect(collections).toContain('interactions:update');
    expect(collections).toContain('people:update'); // target
    expect(collections).toContain('merges:set');

    expect(result.mergeId).toBe('merge-new');
  });

  it('rejects without side effects when the batch commit fails', async () => {
    wireHappyPath({ interviews: [], interactions: [] });
    batchWriteMock.mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(
      mergeContacts({ sourceId: 'p-src', targetId: 'p-tgt', kind: 'person' }),
    ).rejects.toThrow('quota exceeded');

    // Nothing outside the batch got written.
    expect(updateDocMock).not.toHaveBeenCalled();
    expect(createDocMock).not.toHaveBeenCalled();
  });
});

describe('undoMerge — atomicity', () => {
  const mergeRecord = {
    id: 'm-1',
    kind: 'person',
    sourceId: 'p-src',
    targetId: 'p-tgt',
    status: 'applied',
    snapshot: {
      source: { id: 'p-src' },
      interviews: [{ id: 'iv-1', linkedType: 'person', linkedContactId: 'p-src', dedupResolution: null }],
      interactions: [{ id: 'it-1', entity_type: 'person', entity_id: 'p-src' }],
      prevTarget: { mergedFromContactIds: [] },
    },
  };

  it('reverses every mutation through a single batchWrite', async () => {
    getDocMock.mockImplementation(async (coll, id) => {
      if (coll === 'merges' && id === 'm-1') return mergeRecord;
      if (coll === 'people' && id === 'p-tgt') return { id: 'p-tgt', enrichmentHistory: [] };
      return null;
    });

    const result = await undoMerge('m-1');

    expect(result.ok).toBe(true);
    expect(batchWriteMock).toHaveBeenCalledTimes(1);
    expect(updateDocMock).not.toHaveBeenCalled();

    const ops = batchWriteMock.mock.calls[0][0];
    const collections = ops.map((op) => `${op.collection}:${op.type}`);
    expect(collections).toContain('interviews:update');
    expect(collections).toContain('interactions:update');
    expect(collections).toContain('people:update'); // both source restore and target clear
    expect(collections).toContain('merges:update'); // status flip to undone
  });

  it('rejects without side effects when the batch commit fails', async () => {
    getDocMock.mockImplementation(async (coll, id) => {
      if (coll === 'merges' && id === 'm-1') return mergeRecord;
      if (coll === 'people' && id === 'p-tgt') return { id: 'p-tgt', enrichmentHistory: [] };
      return null;
    });
    batchWriteMock.mockRejectedValueOnce(new Error('offline'));

    await expect(undoMerge('m-1')).rejects.toThrow('offline');
    expect(updateDocMock).not.toHaveBeenCalled();
  });
});
