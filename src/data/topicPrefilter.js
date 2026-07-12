// Matches a teacher's profile (subjects, yearLevels) against the preset TOPIC_TAGS list for the
// v4.2.0 SendQuiz dropdown prefilter. Pure function, extracted for unit testing.
function matchTopics(subjects, yearLevels, tags) {
  if (!subjects?.length || !yearLevels?.length) return []
  return tags.filter(
    (t) => yearLevels.some((y) => t.startsWith(`Year ${y} `)) && subjects.some((s) => t.endsWith(` ${s}`))
  )
}

export default matchTopics
