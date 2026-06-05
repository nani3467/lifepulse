import axios from 'axios'

const api = axios.create({
  baseURL: 'https://lifepulse-2.onrender.com/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000,
})

// Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lp_access_token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Auto refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true

      try {
        const refreshToken =
          localStorage.getItem('lp_refresh_token')

        if (!refreshToken) {
          throw new Error('No refresh token found')
        }

        const response = await axios.post(
          'https://lifepulse-2.onrender.com/api/auth/refresh',
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          }
        )

        const accessToken = response.data.access_token

        localStorage.setItem(
          'lp_access_token',
          accessToken
        )

        originalRequest.headers.Authorization =
          `Bearer ${accessToken}`

        return api(originalRequest)
      } catch (err) {
        localStorage.removeItem('lp_access_token')
        localStorage.removeItem('lp_refresh_token')
        localStorage.removeItem('lp_user')

        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api