# Graph Report - quizpulse - PWA  (2026-08-23)

## Corpus Check
- 241 files · ~140,281 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1355 nodes · 2240 edges · 114 communities (105 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `35712c42`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 112|Community 112]]

## God Nodes (most connected - your core abstractions)
1. `logRequest()` - 61 edges
2. `useAuth()` - 34 edges
3. `rateLimit()` - 32 edges
4. `getClientIp()` - 26 edges
5. `authenticateTeacher()` - 25 edges
6. `ScopeError` - 21 edges
7. `getCallerScope()` - 16 edges
8. `authenticateAdmin()` - 14 edges
9. `ROLES` - 14 edges
10. `requireRole()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `makeOnboardingHandler()` --calls--> `getTeacher()`  [INFERRED]
  tests/unit/api/signup-provisioning.test.js → api/teacher.js
- `buildPageViewPayload()` --calls--> `getTabSessionId()`  [INFERRED]
  tests/unit/usePageView.test.js → src/hooks/usePageView.js
- `onAppInstalled()` --calls--> `sendPageViewBeacon()`  [INFERRED]
  tests/unit/usePageView.test.js → src/hooks/usePageView.js
- `buildPageViewPayload()` --calls--> `getSessionId()`  [INFERRED]
  tests/unit/usePageView.test.js → src/session.js
- `respond()` --calls--> `logRequest()`  [EXTRACTED]
  api/analytics.js → api/logger.js

## Import Cycles
- None detected.

## Communities (114 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.19
Nodes (14): { EXCLUDE_DEMO_FRAGMENT, andExcludeDemo, isDemoClass }, {
  runSimulation,
  generateSimulatedResponses,
  pickAnswer,
  pickDistractor,
  pickConfidence,
  pickResponseTimeMs,
}, { selectDemoStudents, DEMO_NAMES }, andExcludeDemo(), isDemoClass(), crypto, generateSimulatedResponses(), getContainers() (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (16): { app }, { assertStepUp, StepUpError }, { authenticateAdmin }, classesContainer, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES } (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (15): { app }, { authenticateTeacher }, client, { CosmosClient }, database, { FEATURE_FIRST_RUN }, { logRequest }, questionsContainer (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (37): dependencies, @azure/msal-browser, @azure/msal-react, qrcode-generator, react, react-dom, react-router-dom, devDependencies (+29 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (15): SWUpdateBanner(), TITLES, useDocumentTitle(), usePageView(), usePwaInstallTracking(), AdminLog(), formatDate(), Onboarding() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (18): ctx, { sendNotificationForQuiz }, webpush, { app }, { authenticateTeacher }, classesContainer, client, { CosmosClient } (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (20): { runFuzzyMatch }, Fuse, runFuzzyMatch(), { app }, approveRequest(), { assertScope, ScopeError }, { authenticateTeacher }, _bruteForceStore (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (12): Home(), isInAppBrowser(), isIosStandalone(), Login(), App(), apiRequest, loginRequest, msalConfig (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (9): HintBanner(), matchTopics(), useHint(), Analytics(), OPTION_BORDER, OPTION_COLORS, CreateQuestion(), QuizHistory() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (18): FOUR_CELL, QUESTION_STYLES, useStagedPending(), useWindowWidth(), ANALYTICS_DATA, BAR_COLOURS, C, DAYS (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (16): { app }, { assertScope, ScopeError }, { authenticateTeacher }, buildQuestionBreakdown(), classesContainer, client, CONFIDENT_VALUES, { CosmosClient } (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (20): dependencies, @azure/cosmos, @azure/functions, fuse.js, jsonwebtoken, jwks-rsa, mammoth, pdfkit (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (14): ALLOWED_TOPICS, ALLOWED_VISIBILITY, { app }, { assertScope, getCallerScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES }, { authenticateTeacher }, client, container, { CosmosClient } (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (19): { app }, { authenticateTeacher }, { CLASS_NAME_MAX, CLASSES_PER_TEACHER, ClassLimitError, generateJoinCode, createRealClass }, classesContainer, client, { CosmosClient }, crypto, database (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (16): { app }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, database, { EXCLUDE_DEMO_FRAGMENT }, joinRequestsContainer (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (14): { app }, { assertScope, ScopeError }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, database, { logRequest } (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (18): { app }, { authenticateTeacher }, classesContainer, client, { computeEligibleIntros }, { CosmosClient }, crypto, database (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (15): { app }, { authenticateTeacher }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { getCallerScope, assertScope, requireRole, ScopeError, ROLES, READ_ALL_ROLES, MUTATE_ALL_ROLES, PRIVILEGED_ROLES }, { getCallerScope, assertScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES, READ_ALL_ROLES } (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (12): ALLOWED_EVENT_TYPES, { app }, buildPageViewDoc(), { classifyPage }, { CosmosClient }, { rateLimit, getClientIp }, { buildPageViewDoc }, { ALLOWED_PREFIXES, classifyPage } (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (12): ALLOWED_TYPES, { app }, auditLogContainer, { authenticateAdmin }, classesContainer, client, { CosmosClient }, database (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (11): ALLOWED_ROLES, { app }, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest } (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (27): buildRealMetrics(), round2(), { computeRangeQuizStats }, { resolveApprovedDeviceIds }, {
  ALLOWED_RANGES,
  getRangeStart,
  aggregateTraffic,
  computeFunnelRates,
}, { app }, { authenticateAdmin }, computeFunnel() (+19 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (14): ALLOWED_RANGES, { app }, { authenticateAdmin }, buildRealTotals(), buildStubbedMetrics(), { computeRangeQuizStats }, { EXCLUDE_DEMO_FRAGMENT }, { getCallerScope, requireRole, ScopeError, ROLES } (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.23
Nodes (8): { buildRollup, CORRECT_WEIGHT }, { TOPIC_TAGS }, { TOPIC_TAGS, isValidTopicTag }, buildRollup(), CORRECT_WEIGHT, { CosmosClient }, { TOPIC_TAGS }, TOPIC_TAGS

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (13): { getApprovedJoinRequest }, { andExcludeDemo }, { app }, client, { CosmosClient }, database, { getApprovedJoinRequest }, joinRequestsContainer (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.24
Nodes (9): FeatureIntroCard(), hasShownIntroThisSession(), ProfileNudge(), pickIntro(), PromoSlot(), StarterSeedCta(), FEATURE_INTRO_CONTENT, BuildQuiz() (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (5): ProfileWizardSteps(), REGISTRATION_OPTIONS, SUBJECTS, YEAR_LEVELS, OnboardingProfile()

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (10): { app }, auditLogContainer, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest } (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): { app }, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest }, { rateLimit, getClientIp } (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (8): buildPageViewPayload(), getTabSessionId(), isStudentRoute(), sendPageViewBeacon(), getSessionId(), buildPageViewPayload(), isStudentRoute(), onAppInstalled()

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (10): AiBadge(), ALLOWED_TOPICS, BLANK_FORM, QuestionBank(), TOPIC_COLORS, VISIBILITY_COLORS, VISIBILITY_LABELS, YEAR_LEVELS (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (13): { app }, { authenticateAdmin }, classesContainer, client, { CosmosClient }, database, { EXCLUDE_DEMO_FRAGMENT }, { getCallerScope, requireRole, ScopeError, ROLES } (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.36
Nodes (7): authHeaders(), createClassAsA(), createQuestionAsA(), createQuizAsA(), jwt, mintToken(), ownerHeaders()

### Community 34 - "Community 34"
Cohesion: 0.47
Nodes (4): adminHeaders(), authHeaders(), jwt, mintToken()

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (5): deletePendingResponse(), flushPendingResponses(), getAllPendingResponses(), getApiBase(), openOfflineDb()

### Community 36 - "Community 36"
Cohesion: 0.50
Nodes (3): apiRequest(), jwt, mintToken()

### Community 37 - "Community 37"
Cohesion: 0.50
Nodes (3): CONFIDENCE_VALUES, makeHandler(), validateAnswers()

### Community 38 - "Community 38"
Cohesion: 0.53
Nodes (5): apiGet(), apiPost(), apiPut(), jwt, mintToken()

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (3): apiRequest(), jwt, mintToken()

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (3): fs, path, SRC

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (3): apiRequest(), jwt, mintToken()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): authHeaders(), jwt, mintToken()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): authHeaders(), jwt, mintToken()

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (3): authHeaders(), jwt, mintToken()

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (12): { app }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, database, { getCallerScope, assertScope, ScopeError }, { logRequest } (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.26
Nodes (8): I, NAV, CLASS_SCOPED_TABS, SubNav(), activeHub(), activeTab(), HUBS, matches()

### Community 67 - "Community 67"
Cohesion: 0.08
Nodes (30): { authenticateTeacher, authenticateAdmin }, jwt, authenticateAdmin(), authenticateTeacher(), extractBearer(), getJwksClient(), getSigningKey(), { JwksClient } (+22 more)

### Community 68 - "Community 68"
Cohesion: 0.29
Nodes (6): { app }, client, { CosmosClient }, database, quizzesContainer, { sendNotificationForQuiz }

### Community 69 - "Community 69"
Cohesion: 0.11
Nodes (16): { app }, { authenticateTeacher }, client, CONFIDENT_VALUES, { CosmosClient }, database, { EXCLUDE_DEMO_FRAGMENT }, { isValidTopicTag } (+8 more)

### Community 70 - "Community 70"
Cohesion: 0.50
Nodes (3): authHeaders(), jwt, mintToken()

### Community 71 - "Community 71"
Cohesion: 0.60
Nodes (4): authHeaders(), createQuestionAsA(), jwt, mintToken()

### Community 72 - "Community 72"
Cohesion: 0.15
Nodes (12): AERO_CITATIONS, APST_DEFAULTS, APST_DESCRIPTORS, AnnualLogPanel(), DOMAINS, Evidence(), ExportPanel(), fieldStyle (+4 more)

### Community 73 - "Community 73"
Cohesion: 0.13
Nodes (14): { andExcludeDemo }, { app }, { APST_DEFAULTS, domainCoverage }, { authenticateTeacher }, { buildAnnualLogPdf }, { calculateHours, validateDateRange }, client, { CosmosClient } (+6 more)

### Community 74 - "Community 74"
Cohesion: 0.20
Nodes (12): { generate, extractKeyTerms, InsufficientContentError }, { seededRng, seededShuffle, hashString }, capitalize(), extractKeyTerms(), generate(), InsufficientContentError, { seededRng, seededShuffle }, STOPWORDS (+4 more)

### Community 77 - "Community 77"
Cohesion: 0.14
Nodes (13): loadQuizAnalytics(), { app }, { authenticateTeacher }, { buildActivityPdf }, { calculateHours, containsUnpersonalisedMarker }, client, { CosmosClient }, database (+5 more)

### Community 78 - "Community 78"
Cohesion: 0.11
Nodes (18): { app }, { authenticateTeacher, authenticateAdmin }, client, { CosmosClient }, crypto, database, { getCallerScope, requireRole, ScopeError, ROLES }, invitesContainer (+10 more)

### Community 79 - "Community 79"
Cohesion: 0.11
Nodes (19): respond(), logRequest(), respond(), { app }, client, CONFIDENCE_VALUES, container, { CosmosClient } (+11 more)

### Community 80 - "Community 80"
Cohesion: 0.07
Nodes (38): ClassJoinQR(), InstallButton(), IosInstallBanner(), QRCode(), CONFIDENCE_LABELS, confidenceTrend(), tallyConfidence(), tallySummaryText() (+30 more)

### Community 81 - "Community 81"
Cohesion: 0.31
Nodes (9): { buildActivityPdf, buildAnnualLogPdf }, AERO_CITATIONS, buildActivityPdf(), buildAnnualLogPdf(), collect(), footerText(), PDFDocument, renderFooter() (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.20
Nodes (11): { calculateHours, containsUnpersonalisedMarker, validateDateRange }, { domainCoverage }, APST_DEFAULTS, APST_DESCRIPTORS, descriptorById, domainCoverage(), DOMAINS, calculateHours() (+3 more)

### Community 83 - "Community 83"
Cohesion: 0.43
Nodes (5): authHeaders(), createQuestionAsA(), createSentQuizAsA(), jwt, mintToken()

### Community 84 - "Community 84"
Cohesion: 0.18
Nodes (13): { runFirstRun, firstRunDemoClassId, firstRunQuizId }, crypto, DEMO_NAMES, selectDemoStudents(), { deterministicId }, firstRunDemoClassId(), firstRunQuizId(), getOrCreateDemoClass() (+5 more)

### Community 85 - "Community 85"
Cohesion: 0.08
Nodes (25): { app }, { authenticateTeacher }, { chunkPages, chunkText, chunkPreview }, client, { CosmosClient }, { countCreatedToday }, crypto, database (+17 more)

### Community 86 - "Community 86"
Cohesion: 0.09
Nodes (26): { generateDraft, selectChunks, INPUT_CHAR_CAP, MissingProviderKeyError }, { buildSystemPrompt, buildUserPrompt }, { QUESTION_STYLES, isValidQuestionStyle, stylePromptLine }, { buildSystemPrompt, buildUserPrompt }, generate(), requiredEnv, { buildSystemPrompt, buildUserPrompt }, generate() (+18 more)

### Community 87 - "Community 87"
Cohesion: 0.09
Nodes (20): { app }, { authenticateTeacher }, { checkAndIncrQuota, checkAndIncrRegenQuota }, client, { CosmosClient }, database, draftsContainer, { generateDraft, MissingProviderKeyError } (+12 more)

### Community 88 - "Community 88"
Cohesion: 0.16
Nodes (9): { computeEligibleIntros }, FEATURE_INTRO_KEYS, isValidIntroKey(), CANDIDATE_KEYS, computeEligibleIntros(), { EXCLUDE_DEMO_FRAGMENT }, { FEATURE_APST_EXPORT, FEATURE_AI_GENERATION }, { FEATURE_INTRO_KEYS } (+1 more)

### Community 89 - "Community 89"
Cohesion: 0.13
Nodes (14): GettingStartedChecklist(), STEP_LABELS, STEP_ROUTES, buildAlsoWaitingCards(), monthGrid(), quizzesOnDay(), sameDay(), startOfWeek() (+6 more)

### Community 90 - "Community 90"
Cohesion: 0.39
Nodes (5): { countCreatedToday, checkAndIncrRegenQuota, todayDateKey }, checkAndIncrQuota(), checkAndIncrRegenQuota(), countCreatedToday(), todayDateKey()

### Community 91 - "Community 91"
Cohesion: 0.32
Nodes (5): { validateDraftQuestions }, { isValidTopicTag }, validateDraftQuestions(), validateQuestionShape(), isValidTopicTag()

### Community 92 - "Community 92"
Cohesion: 0.25
Nodes (3): JSZip, jwt, PDFDocument

### Community 93 - "Community 93"
Cohesion: 0.14
Nodes (14): DemoNav(), PUBLIC_NAV, showPublicNav(), Sidebar(), AuthContext, AuthProvider(), useAuth(), RequireAuth() (+6 more)

### Community 94 - "Community 94"
Cohesion: 0.43
Nodes (6): authHeaders(), buildPdf(), createDraft(), jwt, PDFDocument, uploadSource()

### Community 95 - "Community 95"
Cohesion: 0.33
Nodes (3): TOPIC_TAGS, Population(), REFERENCE_DOTS

### Community 97 - "Community 97"
Cohesion: 0.43
Nodes (6): cloneIdForQuiz(), crypto, deterministicId(), questionIdForDraft(), quizIdForDraft(), resolveSourceRefLabel()

### Community 98 - "Community 98"
Cohesion: 0.38
Nodes (3): monthGrid(), startOfWeek(), weekDays()

### Community 99 - "Community 99"
Cohesion: 0.13
Nodes (14): { app }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, database, { FEATURE_FIRST_RUN }, { getTeacher } (+6 more)

### Community 101 - "Community 101"
Cohesion: 0.29
Nodes (5): addApprovedClass(), getApprovedClasses(), getPendingClasses(), reconcileApprovals(), removePendingClass()

### Community 102 - "Community 102"
Cohesion: 0.31
Nodes (7): { computeGettingStarted, computeGettingStartedSteps, isReleased, GETTING_STARTED_STEPS }, computeGettingStarted(), computeGettingStartedSteps(), countPositive(), { EXCLUDE_DEMO_FRAGMENT }, GETTING_STARTED_STEPS, isReleased()

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (3): AI_QUESTION, capturedHandlers, context

### Community 104 - "Community 104"
Cohesion: 0.60
Nodes (4): authHeaders(), jwt, mintToken(), post()

### Community 107 - "Community 107"
Cohesion: 0.67
Nodes (3): authHeaders(), createQuestion(), jwt

### Community 108 - "Community 108"
Cohesion: 0.18
Nodes (10): { app }, client, { CosmosClient }, crypto, database, joinRequestsContainer, { logRequest }, { rateLimit } (+2 more)

### Community 112 - "Community 112"
Cohesion: 0.36
Nodes (6): { validateProfile, isProfileComplete, PROFILE_FIELDS }, isProfileComplete(), PROFILE_FIELDS, REGISTRATION_STATUSES, SUBJECTS, validateProfile()

## Knowledge Gaps
- **610 isolated node(s):** `{ app }`, `{ CosmosClient }`, `{ authenticateTeacher }`, `{ getCallerScope, requireRole, ScopeError, ROLES }`, `client` (+605 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logRequest()` connect `Community 79` to `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 27`, `Community 28`, `Community 32`, `Community 65`, `Community 67`, `Community 69`, `Community 73`, `Community 77`, `Community 78`, `Community 85`, `Community 87`, `Community 99`, `Community 108`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `rateLimit()` connect `Community 15` to `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 27`, `Community 28`, `Community 32`, `Community 65`, `Community 67`, `Community 69`, `Community 73`, `Community 77`, `Community 78`, `Community 79`, `Community 85`, `Community 87`, `Community 99`, `Community 108`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `getClientIp()` connect `Community 15` to `Community 1`, `Community 2`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 22`, `Community 24`, `Community 27`, `Community 28`, `Community 32`, `Community 67`, `Community 69`, `Community 78`, `Community 79`, `Community 85`, `Community 87`, `Community 99`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `{ app }`, `{ CosmosClient }`, `{ authenticateTeacher }` to the rest of the system?**
  _610 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1323529411764706 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._