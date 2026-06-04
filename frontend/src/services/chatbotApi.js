import api from './api'

export const chatbotApi = {
  query: (message) => api.post('/chatbot/query', { message }),
}
