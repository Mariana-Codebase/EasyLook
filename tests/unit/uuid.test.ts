import { EASYLOOK_NAMESPACE, uuidV5 } from '../../src/lib/uuid';

describe('uuidV5', () => {
  it('matches the RFC test vector for python.org in the DNS namespace', () => {
    // Same value as Python's uuid.uuid5(uuid.NAMESPACE_DNS, 'python.org').
    expect(uuidV5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });

  it('is stable for seed identifiers', () => {
    expect(uuidV5('store:Atelier Norte', EASYLOOK_NAMESPACE)).toBe('41bc4853-8615-5cd0-b00d-aea313f4ddad');
    expect(uuidV5('a')).not.toBe(uuidV5('b'));
  });
});
