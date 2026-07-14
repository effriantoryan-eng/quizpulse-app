# Graph Report - quizpulse - PWA  (2026-07-15)

## Corpus Check
- 164 files · ~95,945 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 925 nodes · 1466 edges · 77 communities (68 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4680caba`
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

## God Nodes (most connected - your core abstractions)
1. `logRequest()` - 47 edges
2. `rateLimit()` - 25 edges
3. `getClientIp()` - 21 edges
4. `ScopeError` - 21 edges
5. `authenticateTeacher()` - 19 edges
6. `useAuth()` - 18 edges
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

## Communities (77 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.19
Nodes (10): { EXCLUDE_DEMO_FRAGMENT, andExcludeDemo, isDemoClass }, {
  runSimulation,
  generateSimulatedResponses,
  pickAnswer,
  pickConfidence,
  pickResponseTimeMs,
}, { selectDemoStudents, DEMO_NAMES }, crypto, DEMO_NAMES, selectDemoStudents(), andExcludeDemo(), isDemoClass() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): { app }, { authenticateTeacher, authenticateAdmin }, client, { CosmosClient }, crypto, database, { getCallerScope, requireRole, ScopeError, ROLES }, invitesContainer (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (28): { authenticateTeacher, authenticateAdmin }, jwt, authenticateAdmin(), authenticateTeacher(), extractBearer(), getJwksClient(), getSigningKey(), { JwksClient } (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (36): dependencies, @azure/msal-browser, @azure/msal-react, react, react-dom, react-router-dom, devDependencies, cross-env (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (14): SWUpdateBanner(), TITLES, useDocumentTitle(), usePageView(), usePwaInstallTracking(), AppRoutes(), FULL_WIDTH_ROUTES, getOrCreateDeviceId() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (15): { app }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, database, ensureVapid(), { logRequest } (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (22): { runFuzzyMatch }, Fuse, runFuzzyMatch(), { app }, approveRequest(), { assertScope, ScopeError }, { authenticateTeacher }, _bruteForceStore (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (16): InstallButton(), IosInstallBanner(), detectPlatform(), usePwaInstall(), Home(), isInAppBrowser(), isIosStandalone(), Login() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (9): HintBanner(), useHint(), Analytics(), FOUR_CELL, OPTION_BORDER, OPTION_COLORS, TOPIC_COLORS, CreateQuestion() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (11): ANALYTICS_DATA, BAR_COLOURS, C, DAYS, DEMO_REFERENCE_DOTS, DemoGallery(), FOURCELL_COLORS, FOURCELL_DATA (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (33): { app }, { assertScope, ScopeError }, { authenticateTeacher }, buildQuestionBreakdown(), classesContainer, client, CONFIDENT_VALUES, { CosmosClient } (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (17): dependencies, @azure/cosmos, @azure/functions, fuse.js, jsonwebtoken, jwks-rsa, web-push, description (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (14): ALLOWED_TOPICS, ALLOWED_VISIBILITY, { app }, { assertScope, getCallerScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES }, { authenticateTeacher }, client, container, { CosmosClient } (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (19): { app }, { authenticateTeacher }, { CLASS_NAME_MAX, CLASSES_PER_TEACHER, ClassLimitError, generateJoinCode, createRealClass }, classesContainer, client, { CosmosClient }, crypto, database (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (15): ALLOWED_RANGES, { app }, { authenticateAdmin }, buildRealMetrics(), buildRealTotals(), buildStubbedMetrics(), { computeRangeQuizStats }, { EXCLUDE_DEMO_FRAGMENT } (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (38): { app }, { assertScope, ScopeError }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, database, { logRequest } (+30 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (31): { computeEligibleIntros }, { validateProfile, isProfileComplete, PROFILE_FIELDS }, { app }, { authenticateTeacher }, classesContainer, client, { computeEligibleIntros }, { CosmosClient } (+23 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (15): { app }, { authenticateTeacher }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { getCallerScope, assertScope, requireRole, ScopeError, ROLES, READ_ALL_ROLES, MUTATE_ALL_ROLES, PRIVILEGED_ROLES }, { getCallerScope, assertScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES, READ_ALL_ROLES } (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (10): DemoNav(), PUBLIC_NAV, showPublicNav(), Sidebar(), AuthContext, AuthProvider(), useAuth(), RequireAuth() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (11): ALLOWED_TYPES, { app }, auditLogContainer, { authenticateAdmin }, classesContainer, client, { CosmosClient }, database (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (10): ALLOWED_ROLES, { app }, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest } (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (25): { computeRangeQuizStats }, { resolveApprovedDeviceIds }, {
  ALLOWED_RANGES,
  getRangeStart,
  aggregateTraffic,
  computeFunnelRates,
}, { app }, { authenticateAdmin }, computeFunnel(), { computeRangeQuizStats }, { getCallerScope, requireRole, ScopeError, ROLES } (+17 more)

### Community 22 - "Community 22"
Cohesion: 0.24
Nodes (7): ENCOURAGEMENTS, openDb(), queueResponse(), registerResponseSync(), CONFIDENCE_LEVELS, getOrCreateDeviceId(), TakeQuiz()

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (25): { app }, { authenticateTeacher }, client, CONFIDENT_VALUES, { CosmosClient }, database, { EXCLUDE_DEMO_FRAGMENT }, { isValidTopicTag } (+17 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (10): { app }, auditLogContainer, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest } (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (10): FeatureIntroCard(), hasShownIntroThisSession(), ProfileNudge(), PromoSlot(), FEATURE_INTRO_CONTENT, BuildQuiz(), card, demoPill (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (9): ProfileWizardSteps(), REGISTRATION_OPTIONS, SUBJECTS, YEAR_LEVELS, Onboarding(), OnboardingProfile(), RequireTeacher(), getOnboarded() (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (19): logRequest(), respond(), respond(), respond(), respond(), { app }, client, { CosmosClient } (+11 more)

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
Cohesion: 0.18
Nodes (7): ALLOWED_TOPICS, BLANK_FORM, QuestionBank(), TOPIC_COLORS, VISIBILITY_COLORS, VISIBILITY_LABELS, YEAR_LEVELS

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (12): { app }, { authenticateAdmin }, classesContainer, client, { CosmosClient }, database, { EXCLUDE_DEMO_FRAGMENT }, { getCallerScope, requireRole, ScopeError, ROLES } (+4 more)

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
Cohesion: 0.29
Nodes (7): I, NAV, SubNav(), activeHub(), activeTab(), HUBS, matches()

### Community 67 - "Community 67"
Cohesion: 0.25
Nodes (5): matchTopics(), TOPIC_TAGS, Population(), REFERENCE_DOTS, SendQuiz()

### Community 68 - "Community 68"
Cohesion: 0.29
Nodes (6): { app }, client, { CosmosClient }, database, quizzesContainer, { sendNotificationForQuiz }

### Community 69 - "Community 69"
Cohesion: 0.43
Nodes (6): crypto, generateSimulatedResponses(), getContainers(), pickResponseTimeMs(), runSimulation(), uniformInt()

### Community 70 - "Community 70"
Cohesion: 0.50
Nodes (3): authHeaders(), jwt, mintToken()

### Community 71 - "Community 71"
Cohesion: 0.60
Nodes (4): authHeaders(), createQuestionAsA(), jwt, mintToken()

### Community 72 - "Community 72"
Cohesion: 0.50
Nodes (3): ctx, { sendNotificationForQuiz }, webpush

## Knowledge Gaps
- **443 isolated node(s):** `{ app }`, `{ CosmosClient }`, `{ authenticateTeacher }`, `{ getCallerScope, requireRole, ScopeError, ROLES }`, `client` (+438 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logRequest()` connect `Community 27` to `Community 32`, `Community 1`, `Community 2`, `Community 65`, `Community 5`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 24`, `Community 28`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `rateLimit()` connect `Community 15` to `Community 32`, `Community 1`, `Community 2`, `Community 65`, `Community 5`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 24`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `getClientIp()` connect `Community 15` to `Community 32`, `Community 1`, `Community 2`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 19`, `Community 20`, `Community 23`, `Community 24`, `Community 28`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `{ app }`, `{ CosmosClient }`, `{ authenticateTeacher }` to the rest of the system?**
  _443 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0545876887340302 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08095238095238096 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._