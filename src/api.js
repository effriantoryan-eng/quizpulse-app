const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : 'https://quizpulse-api-b5bvbvgzdph6dyas.australiaeast-01.azurewebsites.net/api'

export default API_BASE
