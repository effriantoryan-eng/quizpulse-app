# Graph Report - .  (2026-06-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 697 nodes · 1091 edges · 65 communities (59 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0b75f118`
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

## God Nodes (most connected - your core abstractions)
1. `logRequest()` - 41 edges
2. `rateLimit()` - 22 edges
3. `ScopeError` - 20 edges
4. `getClientIp()` - 19 edges
5. `useAuth()` - 18 edges
6. `authenticateTeacher()` - 17 edges
7. `getCallerScope()` - 15 edges
8. `authenticateAdmin()` - 13 edges
9. `ROLES` - 13 edges
10. `requireRole()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `makeOnboardingHandler()` --calls--> `getTeacher()`  [INFERRED]
  tests/unit/api/signup-provisioning.test.js → api/teacher.js
- `respond()` --calls--> `logRequest()`  [EXTRACTED]
  api/auditQuery.js → api/logger.js
- `respond()` --calls--> `logRequest()`  [EXTRACTED]
  api/institutions.js → api/logger.js
- `respond()` --calls--> `logRequest()`  [EXTRACTED]
  api/joinRequests.js → api/logger.js
- `respond()` --calls--> `logRequest()`  [EXTRACTED]
  api/metrics.js → api/logger.js

## Import Cycles
- None detected.

## Communities (65 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (41): { EXCLUDE_DEMO_FRAGMENT, andExcludeDemo, isDemoClass }, {
  runSimulation,
  generateSimulatedResponses,
  pickAnswer,
  pickConfidence,
  pickResponseTimeMs,
}, { selectDemoStudents, DEMO_NAMES }, { app }, { authenticateAdmin }, classesContainer, client, { CosmosClient } (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): { app }, { authenticateTeacher, authenticateAdmin }, client, { CosmosClient }, crypto, database, { getCallerScope, requireRole, ScopeError, ROLES }, invitesContainer (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (26): { authenticateTeacher, authenticateAdmin }, jwt, authenticateAdmin(), authenticateTeacher(), extractBearer(), getJwksClient(), getSigningKey(), { JwksClient } (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (33): dependencies, @azure/msal-browser, @azure/msal-react, react, react-dom, react-router-dom, devDependencies, eslint (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (14): SWUpdateBanner(), AdminLog(), formatDate(), Onboarding(), FULL_WIDTH_ROUTES, RequireTeacher(), getOnboarded(), setOnboarded() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (24): ctx, { sendNotificationForQuiz }, webpush, { app }, client, { CosmosClient }, database, quizzesContainer (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (20): { runFuzzyMatch }, Fuse, runFuzzyMatch(), { app }, approveRequest(), { assertScope, ScopeError }, { authenticateTeacher }, _bruteForceStore (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): AuthContext, AuthProvider(), isInAppBrowser(), isIosStandalone(), Login(), App(), apiRequest, loginRequest (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (11): HintBanner(), useHint(), Analytics(), OPTION_BORDER, OPTION_COLORS, BuildQuiz(), TOPIC_COLORS, CreateQuestion() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (7): ANALYTICS_DATA, BAR_COLOURS, C, DAYS, DemoGallery(), QUIZ_QUESTIONS, useWindowWidth()

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (14): { app }, { assertScope, ScopeError }, { authenticateTeacher }, classesContainer, client, CONFIDENT_VALUES, { CosmosClient }, database (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (17): dependencies, @azure/cosmos, @azure/functions, fuse.js, jsonwebtoken, jwks-rsa, web-push, description (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (15): ALLOWED_TOPICS, ALLOWED_VISIBILITY, { app }, { assertScope, getCallerScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES }, { authenticateTeacher }, client, container, { CosmosClient } (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (12): { app }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, crypto, database, { getCallerScope, assertScope, ScopeError } (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (12): ALLOWED_RANGES, { app }, { authenticateAdmin }, buildRealTotals(), buildStubbedMetrics(), { EXCLUDE_DEMO_FRAGMENT }, { getCallerScope, requireRole, ScopeError, ROLES }, getContainers() (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (9): { app }, client, { CosmosClient }, database, { rateLimit, getClientIp }, getClientIp(), rateLimit(), _store (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (12): makeOnboardingHandler(), { app }, { authenticateTeacher }, client, { CosmosClient }, crypto, database, getTeacher() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.31
Nodes (8): { getCallerScope, assertScope, requireRole, ScopeError, ROLES, READ_ALL_ROLES, MUTATE_ALL_ROLES, PRIVILEGED_ROLES }, { getCallerScope, assertScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES, READ_ALL_ROLES }, assertScope(), getCallerScope(), MUTATE_ALL_ROLES, READ_ALL_ROLES, requireRole(), ROLES

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (10): DemoNav(), PUBLIC_NAV, showPublicNav(), I, PAGES, Sidebar(), useAuth(), Home() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (11): ALLOWED_TYPES, { app }, auditLogContainer, { authenticateAdmin }, classesContainer, client, { CosmosClient }, database (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (11): ALLOWED_ROLES, { app }, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest } (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.26
Nodes (6): InstallButton(), IosInstallBanner(), detectPlatform(), usePwaInstall(), getOrCreateDeviceId(), JoinClass()

### Community 22 - "Community 22"
Cohesion: 0.27
Nodes (7): ENCOURAGEMENTS, openDb(), queueResponse(), registerResponseSync(), CONFIDENCE_LEVELS, getOrCreateDeviceId(), TakeQuiz()

### Community 23 - "Community 23"
Cohesion: 0.22
Nodes (9): respond(), respond(), logRequest(), respond(), respond(), respond(), { app }, { logRequest } (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (10): { app }, auditLogContainer, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest } (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (10): { app }, { assertScope, ScopeError }, { authenticateTeacher }, classesContainer, client, { CosmosClient }, database, { logRequest } (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (10): { app }, client, CONFIDENCE_VALUES, container, { CosmosClient }, database, joinRequestsContainer, { logRequest } (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (10): { app }, client, { CosmosClient }, crypto, database, joinRequestsContainer, { logRequest }, { rateLimit } (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): { app }, { authenticateAdmin }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, { logRequest }, { rateLimit, getClientIp } (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (5): TITLES, useDocumentTitle(), usePageView(), AppRoutes(), getSessionId()

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (6): ALLOWED_TOPICS, BLANK_FORM, TOPIC_COLORS, VISIBILITY_COLORS, VISIBILITY_LABELS, YEAR_LEVELS

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (7): { app }, { authenticateTeacher }, client, { CosmosClient }, database, { getCallerScope, requireRole, ScopeError, ROLES }, ScopeError

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
Cohesion: 0.60
Nodes (4): apiGet(), apiPost(), jwt, mintToken()

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

## Knowledge Gaps
- **353 isolated node(s):** `{ app }`, `{ CosmosClient }`, `{ authenticateTeacher }`, `{ getCallerScope, requireRole, ScopeError, ROLES }`, `client` (+348 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logRequest()` connect `Community 23` to `Community 0`, `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 19`, `Community 20`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `rateLimit()` connect `Community 15` to `Community 0`, `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 19`, `Community 20`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `getClientIp()` connect `Community 15` to `Community 0`, `Community 1`, `Community 2`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 19`, `Community 20`, `Community 24`, `Community 25`, `Community 26`, `Community 28`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `{ app }`, `{ CosmosClient }`, `{ authenticateTeacher }` to the rest of the system?**
  _353 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05319148936170213 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0545876887340302 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0873440285204991 - nodes in this community are weakly interconnected._