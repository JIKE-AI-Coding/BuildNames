import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock environment variables
const mockOpenAIApiKey = 'sk-test-key'
const mockBaseUrl = 'https://api.openai.com/v1'
const mockModel = 'gpt-4o-mini'

vi.stubEnv('OPENAI_API_KEY', mockOpenAIApiKey)
vi.stubEnv('OPENAI_BASE_URL', mockBaseUrl)
vi.stubEnv('OPENAI_MODEL', mockModel)

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('/api/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Input Validation', () => {
    it('should return 400 when productIdea is empty', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '',
          targetUsers: '独立开发者',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('产品想法不能为空')
    })

    it('should return 400 when targetUsers is empty', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '一个帮助程序员管理时间的工具',
          targetUsers: '',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('目标用户不能为空')
    })

    it('should return 400 when productPositioning is empty', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '一个帮助程序员管理时间的工具',
          targetUsers: '独立开发者',
          productPositioning: '',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('产品定位不能为空')
    })

    it('should return 400 when productIdea exceeds 500 characters', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: 'a'.repeat(501),
          targetUsers: '独立开发者',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('产品想法不能超过500字符')
    })
  })

  describe('OpenAI API Integration', () => {
    it('should return 500 when OpenAI API Key is not set', async () => {
      vi.stubEnv('OPENAI_API_KEY', '')

      const { POST } = await import('./route')

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '一个帮助程序员管理时间的工具',
          targetUsers: '独立开发者',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('服务器配置错误：OpenAI API Key 未设置')

      vi.stubEnv('OPENAI_API_KEY', mockOpenAIApiKey)
    })

    it('should successfully generate names with valid input', async () => {
      const { POST } = await import('./route')

      const mockAIResponse = {
        choices: [
          {
            message: {
              content: 'TimeKeeper\nFlowState\nDevTimer\nFocusFlow\nCodeClock\nTaskPilot\nMinuteMind\nSwiftTrack\nWorkPulse\nPlanRush',
            },
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAIResponse,
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '一个帮助程序员管理时间的工具',
          targetUsers: '独立开发者',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.names).toHaveLength(10)
      expect(data.data.names).toContain('TimeKeeper')
      expect(data.data.names).toContain('FlowState')
    })

    it('should return 500 when OpenAI API returns error', async () => {
      const { POST } = await import('./route')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '一个帮助程序员管理时间的工具',
          targetUsers: '独立开发者',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('AI 服务暂时不可用，请稍后重试')
    })

    it('should return 500 when AI response content is empty', async () => {
      const { POST } = await import('./route')

      const mockAIResponse = {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAIResponse,
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '一个帮助程序员管理时间的工具',
          targetUsers: '独立开发者',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('AI 返回内容为空')
    })

    it('should handle AI response with extra whitespace and empty lines', async () => {
      const { POST } = await import('./route')

      const mockAIResponse = {
        choices: [
          {
            message: {
              content: '  TimeKeeper  \n\nFlowState\n  \nDevTimer\n',
            },
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAIResponse,
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIdea: '一个帮助程序员管理时间的工具',
          targetUsers: '独立开发者',
          productPositioning: '极简工具',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.names).toHaveLength(3)
      expect(data.data.names).toContain('TimeKeeper')
      expect(data.data.names).toContain('FlowState')
      expect(data.data.names).toContain('DevTimer')
    })
  })
})
