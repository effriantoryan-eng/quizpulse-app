const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : 'https://quizpulse-app-api-av5z18.azurewebsites.net/api'

export default API_BASE
