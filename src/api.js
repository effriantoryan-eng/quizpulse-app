const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api'

export default API_BASE
