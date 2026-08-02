import api from './api'

export const chatbotApi = {
  query: (message, history = []) => api.post('/chatbot/query', { message, history }),
}
