import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock environment variables
const mockGithubToken = 'ghp_test_token'
vi.stubEnv('GITHUB_TOKEN', mockGithubToken)

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper to create whoiscx response for all TLDs - available
const createAllTldsAvailableResponse = () => ({
  ok: true,
  json: async () => ({ status: 1, is_available: 1, domain: '' }),
})

// Helper to create whoiscx response for all TLDs - taken
const createAllTldsTakenResponse = () => ({
  ok: true,
  json: async () => ({ status: 1, is_available: 0, domain: '' }),
})

describe('/api/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Input Validation', () => {
    it('should return 400 when names is empty', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: [] }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('名字列表不能为空')
    })

    it('should return 400 when names is not an array', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: 'TimeKeeper' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('名字列表不能为空')
    })

    it('should return 400 when names exceeds 20', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names: Array(21)
            .fill(null)
            .map((_, i) => `name${i}`),
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('一次验证最多20个名字')
    })
  })

  describe('GitHub Verification', () => {
    it('should return githubAvailable=true when repo does not exist', async () => {
      const { POST } = await import('./route')

      // Mock: 1 GitHub + 5 DNS calls for 1 name
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ total_count: 0 }),
        })
        .mockResolvedValue(createAllTldsAvailableResponse())

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['UniqueName123'] }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.results[0].githubAvailable).toBe(true)
    })

    it('should return githubAvailable=false when repo exists', async () => {
      const { POST } = await import('./route')

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ total_count: 1 }),
        })
        .mockResolvedValue(createAllTldsAvailableResponse())

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['react'] }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.results[0].githubAvailable).toBe(false)
    })

    it('should include GITHUB_TOKEN in request headers', async () => {
      const { POST } = await import('./route')

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ total_count: 0 }),
        })
        .mockResolvedValue(createAllTldsAvailableResponse())

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['TestName'] }),
      })

      await POST(request)

      // First fetch is GitHub API call (1 GitHub + 5 DNS = 6 total)
      expect(mockFetch).toHaveBeenCalledTimes(6)
      const githubCall = mockFetch.mock.calls[0]
      expect(githubCall[1].headers.Authorization).toBe(`Bearer ${mockGithubToken}`)
    })
  })

  describe('Domain Verification', () => {
    it('should return all TLDs as available when NXDOMAIN', async () => {
      const { POST } = await import('./route')

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ total_count: 0 }),
        })
        .mockResolvedValue(createAllTldsAvailableResponse())

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['uniquetestname'] }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results[0].domains.com).toBe(true)
      expect(data.data.results[0].domains.io).toBe(true)
      expect(data.data.results[0].domains.app).toBe(true)
      expect(data.data.results[0].domains.dev).toBe(true)
      expect(data.data.results[0].domains.ai).toBe(true)
    })

    it('should return all TLDs as unavailable when has A records', async () => {
      const { POST } = await import('./route')

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ total_count: 0 }),
        })
        .mockResolvedValue(createAllTldsTakenResponse())

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['google'] }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results[0].domains.com).toBe(false)
      expect(data.data.results[0].domains.io).toBe(false)
      expect(data.data.results[0].domains.app).toBe(false)
      expect(data.data.results[0].domains.dev).toBe(false)
      expect(data.data.results[0].domains.ai).toBe(false)
    })

    it('should assume domain available when DNS API fails', async () => {
      const { POST } = await import('./route')

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ total_count: 0 }),
        })
        .mockResolvedValue({
          ok: false,
          status: 500,
        })

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['sometestname'] }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // On DNS API failure, all TLDs are assumed available
      expect(data.data.results[0].domains.com).toBe(true)
      expect(data.data.results[0].domains.io).toBe(true)
    })
  })

  describe('Batch Processing', () => {
    it('should process multiple names in parallel', async () => {
      const { POST } = await import('./route')

      // All fetches return available
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ total_count: 0, Status: 3 }),
      })

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names: ['NameOne', 'NameTwo', 'NameThree'],
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.results).toHaveLength(3)
    })
  })

  describe('Error Handling', () => {
    it('should return 500 when GitHub API returns non-ok response', async () => {
      const { POST } = await import('./route')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      })

      const request = new Request('http://localhost:3000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['somename'] }),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still succeed overall, marking GitHub as unavailable
      expect(response.status).toBe(200)
      expect(data.data.results[0].githubAvailable).toBe(false)
    })
  })
})
