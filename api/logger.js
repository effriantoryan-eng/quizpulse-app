// Structured request logger for Azure Functions.
// Logs flow to Application Insights automatically when
// APPLICATIONINSIGHTS_CONNECTION_STRING is set in Function App config.

/**
 * Logs a completed request in a consistent structured format.
 * @param {object} context   - Azure Functions context object
 * @param {object} fields    - Fields to log
 */
function logRequest(context, { endpoint, method, status, durationMs, teacherId }) {
  const entry = {
    endpoint,
    method,
    status,
    durationMs,
    ...(teacherId && { teacherId }),
  }

  if (status >= 500) {
    context.error('request', JSON.stringify(entry))
  } else if (status >= 400) {
    context.warn('request', JSON.stringify(entry))
  } else {
    context.log('request', JSON.stringify(entry))
  }
}

module.exports = { logRequest }
