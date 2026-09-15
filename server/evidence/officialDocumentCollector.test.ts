import { describe, expect, it } from 'vitest'
import { validateOfficialSourceUrl } from './officialDocumentCollector.js'

describe('official document source validation', () => {
  it('accepts public HTTPS URLs', () => {
    expect(validateOfficialSourceUrl('https://learn.microsoft.com/azure/').hostname).toBe('learn.microsoft.com')
  })

  it.each([
    'http://example.com',
    'https://localhost/metadata',
    'https://127.0.0.1/internal',
    'https://10.0.0.1/internal',
    'https://169.254.169.254/metadata',
    'https://[::1]/internal',
    'https://[::]/internal',
    'https://[fc00::1]/internal',
    'https://[fe80::1]/internal',
    'https://[::ffff:127.0.0.1]/internal',
    'https://192.0.2.1/internal',
    'https://user:password@example.com/',
    'https://example.com:8443/',
  ])('rejects unsafe source %s', source => {
    expect(() => validateOfficialSourceUrl(source)).toThrow()
  })
})