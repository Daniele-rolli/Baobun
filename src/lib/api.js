const API_URL = import.meta.env.VITE_API_URL || ''

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const apiFetch = async (path, { method = 'GET', body, json = false, signal } = {}) => {
  const headers = {}
  let payload = body
  if (json && body !== undefined && body !== null) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: payload,
    signal,
  })

  if (!res.ok) {
    let code = 'internal'
    let message = 'Something went wrong.'
    try {
      const data = await res.json()
      if (data?.error?.code) code = data.error.code
      if (data?.error?.message) message = data.error.message
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code, message)
  }

  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}
