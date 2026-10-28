# Momentin — Product Description and Phased Development Plan

**Planning date:** October 8, 2026  
**Last revised:** October 28, 2026  
**Platform:** Responsive browser application; installation deferred to Phase 8  
**Status:** Confirmed decisions and proposed implementation roadmap; unresolved choices are listed in Section 12

## 1. Product vision

Momentin helps people connect daily actions with long-term goals through habits, tasks, measurable progress, reflection, and community support. Users can build their own routines, adopt community templates, record their experiences, and choose how much of their progress to share.

The experience should feel encouraging, personal, and useful even when a user's routine is interrupted. Soft pastel themes, clear planning tools, meaningful achievements, and optional social participation should support sustained use.

The initial audience is students balancing coursework, skill development, and interview preparation. The underlying product must also accommodate working professionals and people pursuing personal, creative, and fitness goals.

## 2. Problem description

People manage recurring habits, individual tasks, and long-term goals at the same time. These responsibilities are connected, but their planning needs differ. A recurring practice needs a schedule and consistency tracking. A task needs a clear outcome and possibly a deadline. A goal needs milestones and an understandable connection to the activities that support it.

When these are recorded separately, users must continually reconstruct how their daily work contributes to their goals. Completing a list of tasks may not establish a sustainable routine, while maintaining a habit streak does not necessarily mean an important deliverable is finished. Users need visibility into both consistent effort and concrete outcomes.

Planning can also become unrealistic. Users add commitments without considering the time available, competing deadlines, or changes in energy and circumstances. As unfinished work accumulates, deciding what to do next becomes another source of friction. They need a manageable view of today's priorities and a regular opportunity to adjust their plans.

Simple completion checkboxes capture only part of the experience. Users may want to record duration, quantities, measurements, photos, feedback, or reasons for difficulty. Without structured history, it is hard to understand trends or compare progress across time. Different activities also require different measurements, so a fixed dashboard cannot serve every goal.

Streaks provide motivation, but they need to respect the user's schedule. A habit planned three times a week should not be judged as a daily commitment. Missed activities, planned rest, partial completion, and temporary pauses also carry different meanings. Users need an honest history that preserves past progress and makes returning after an interruption approachable.

Starting a routine can be difficult when users must design every activity and goal from scratch. Ready-made templates can reduce that effort, while community-created templates can share useful approaches. Users need to customize adopted templates without changing the creator's original or losing control when that original is updated.

Personal progress can benefit from encouragement, accountability, and shared experience. Users may want to post updates, follow people with similar interests, join challenges, and celebrate achievements. These interactions must coexist with private reflection: a public profile should not automatically reveal journal entries, personal photos, or measurements.

Rewards and rankings introduce another challenge. Points should reflect clear actions and cannot assume that all user-created habits have equal difficulty. A useful system must explain what it rewards, prevent duplicate awards, and let users participate without competing. It should support meaningful progress rather than making point collection the primary purpose of the app.

Momentin addresses these connected needs through a unified workspace for planning, logging, measuring, reflecting, and participating in a community on the user's own terms.

## 3. Proposed solution

Momentin will combine six connected experiences:

1. **Plan:** Create goals, milestones, habits, tasks, schedules, and daily priorities.
2. **Record:** Log completion, measurements, notes, feedback, and photos.
3. **Understand:** Review charts, consistency, workload, and milestone progress.
4. **Reflect:** Maintain private journals and conduct weekly reviews.
5. **Celebrate:** Earn badges, track personal records, and unlock cosmetic rewards.
6. **Connect:** Publish templates, share progress, follow others, and join challenges.

The product should be fully useful to a private individual. Public posting, competition, and accountability groups are optional extensions.

## 4. Confirmed scope decisions

- Support Google sign-in, email/password login, and username/password login.
- **Exclude phone-number login and SMS authentication.**
- Provide verified-email account recovery and securely linked login methods.
- Allow unlimited user-created habits, tasks, and goals; attachment storage has separate practical limits.
- Include curated templates and user-created public/private templates with the initial template feature.
- Let users discover and copy public templates into their own accounts.
- Support daily habit notes, feedback, numeric measurements, and photos.
- Offer configurable progress charts and private journaling.
- Provide friends and global leaderboards, badges, and shared challenges.
- Include a social feed for activities, progress, photos, and achievements.
- Offer light, dark, and system appearance plus selectable pastel palettes.
- Preserve the full feature list below across the roadmap; phasing specifies delivery order rather than removing features.
- Build for one developer using free development tools, without a fixed launch date. Netlify is the preferred hosting provider for browser-based testing and eventual publication.
- Make every completed phase usable in a local browser with persistent data and end-to-end testing. Public availability is not required for development testing.
- Defer installation to Phase 8; the local browser experience must work before then.
- Support teenagers and adults, with a minimum product age of 13; do not allow children under 13. Age-appropriate social controls and launch-region requirements remain to be specified before external access.

## 5. Product rules to establish before implementation

### Identity and privacy

- Every account has a unique username; a display name may be non-unique.
- Username login uses a password and a verified email for recovery.
- Linking another login method requires proof of control. Matching email text alone must not merge accounts.
- Journals, check-ins, photos, and measurements start private.
- Creating a public post or template requires an explicit publishing action and preview.
- Copying a template never copies the creator's personal logs, journal entries, or attachments from check-ins.
- Blocking and visibility rules apply consistently to profiles, feeds, comments, groups, and discovery.
- Only an activity's owner can publish their personal progress. Do not provide reposting of another user's progress as a new post; this cannot prevent screenshots or copying outside the app.
- Published progress is an explicit snapshot with its own attachment access and lifecycle. Deleting its private source does not delete the post; the owner deletes the published copy separately. Account deletion and platform moderation still apply.

### Scheduling and historical accuracy

- Store the time of an event and its applicable user-local date.
- Time-zone and schedule changes must have explicit effective dates and must not silently recalculate past commitments.
- Distinguish completed, partial, missed, paused, and not-scheduled activity states; record freeze protection separately from completion.
- The primary streak is overall daily participation: fully completing at least one habit in a user-local day extends it once, even if nine other habits remain incomplete. It does not claim that all planned habits were completed.
- Full completion of the configured habit target is necessary for streak credit and completion XP. Partial effort and fallback actions remain visible in history and charts but earn neither. Target changes apply prospectively.
- Keep individual habit consistency separate from the overall streak. Unscheduled days do not break an individual scheduled streak; weekly-target habits use completed weekly targets as their individual streak unit.
- Pausing does not itself preserve a streak or generate completion credit. Pausing one habit must not cancel overall streak credit earned by completing another. How freezes interact with a day when all habits are paused or unscheduled remains open.
- Grant each user two automatic streak freezes per month. Under the newly requested overall-streak model, freeze coverage needs confirmation: recommend protecting only the overall streak after a day with zero fully completed habits, without completing or protecting missed individual habits. A freeze awards no completion XP. Rollover and rest-day behaviour remain open in Section 12.
- Lock completion, measurements, and earned XP after their applicable user-local day ends: no ordinary backdated completion or edits to prior-day progress. Same-day edits remain available. Allow later dated annotations without changing the original result or score.
- Tasks remain overdue for five full local calendar days after their due date, then become missed: an October 12 task is overdue October 13–17 and missed from October 18. Allow subsequent completion with a late marker, preserving the missed/deadline history and recording completion on the actual day without rewriting a past day's score. Each recurring occurrence retains its own history.
- Goal progress is configurable per goal and can be calculated from achieved milestones. One activity can contribute to multiple goals without generating duplicate activity XP. Supported calculation modes and milestone weighting remain to be specified.
- Later activity can advance current goal progress; it must not rewrite historical daily progress snapshots.

### Measurements and charts

- Define fields by name, numeric type, unit, and optional target direction or range.
- Keep habit participation separate from the value of an outcome measurement.
- Support time on the horizontal axis initially, with user-selected numeric metrics on the vertical axis.
- Treat missing values as missing rather than zero.
- Support metric-appropriate aggregation: sums, averages, or latest readings.
- Preserve units and field definitions historically; changing units must not relabel old values incorrectly.
- Display compatible metrics together; use separate plots for incompatible units rather than implying direct comparability.
- Offer accessible data tables alongside charts.

### Templates and publishing

- A private template is visible to its owner; a public template is discoverable and copyable.
- Adoption creates an independent editable copy with creator attribution and source-version information.
- Later edits to the original do not overwrite adopted copies.
- Unpublishing removes future public discovery; it does not delete copies already adopted by others.
- Public templates support reporting and moderation from their first release.
- Templates may contain a single activity/goal or a complete routine with multiple habits, tasks, goals, and metric definitions.
- Creators may include instructional images explicitly selected for the template. These are separate from private check-in attachments; adopted versions must retain access independently of later source edits.
- Creators manage their own template content. The admin handles reports about spam or inappropriate content, moderation, and removal; provide the admin workflow from the first public-template feature.

### Rewards and competition

- Use XP-based weekly contests with small participant groups inspired by Duolingo. Keep lifetime XP and eligible weekly XP separately traceable; exact scoring, caps, and group assignment are proposed in Section 12.
- Give each qualifying action a unique award record so retries and toggles cannot duplicate points.
- Reverse affected awards when an action is undone, according to clearly documented rules.
- Freeze challenge criteria for participants once a challenge starts.
- Proposed: cap competitively eligible XP from user-created activities to limit point farming. Do not rank users by body changes or private measurements.
- Define weekly boundaries, tie handling, eligible actions, and late-edit policies before launching rankings.
- Explain that activity is self-reported and that points do not objectively compare effort across people.
- Public posting volume and disclosure of private content must not be required for competitive success.

## 6. Phased roadmap

Every phase must produce a runnable local browser increment with real persistence and a documented end-to-end walkthrough for its implemented flows. Use multiple local test accounts to exercise privacy, templates, and later social features. Add a development-only controllable clock for day-end locking, freezes, overdue tasks, and ranking transitions. Local testing starts with Phase 1 and continues throughout; Phase 9 remains broader beta and launch validation. No public deployment or installation is required for this workflow.

The same responsive application must adapt layouts, navigation, and controls to laptop and phone screens. Device testing must support a phone on mobile data while the laptop uses a different network. Prefer a Netlify-hosted development version once a working increment is ready, with application login and server-enforced access limited to the owner/test accounts. A reachable website does not imply open registration or public access to records. This removes the need to keep the laptop running for remote testing. Continue local development and testing alongside hosted previews. Do not expose the database or development admin/clock controls. A separate introductory/marketing homepage is not required for responsive device access and is not currently committed. No deployment has been performed yet.

### Phase 0 — Product specification and interaction design

**Objective:** Resolve the behavioural rules and design the complete experience before building dependent features.

**Work:**

- Map onboarding, planning, check-ins, template adoption, journaling, charts, publishing, and social participation.
- Design the main navigation: Today, Calendar, Goals, Templates, Journal, Progress, Community, and Account.
- Define the schedule, streak, measurement, template, reward, and privacy rules above.
- Create responsive wireframes and reusable components.
- Establish pastel colour tokens, typography, contrast requirements, focus states, and reduced-motion behaviour.
- Design the data model and select the implementation stack, authentication service, storage, and deployment approach.
- Identify operational costs, especially image storage, transactional email, hosting, and backups.

**Deliverables:** Product specification, screen map, wireframes, data model, and prioritized backlog.

**Completion criteria:** Core flows and edge cases are documented; subsequent phases have reviewable acceptance criteria.

### Phase 1 — Accounts, application foundation, and personalization

**Objective:** Give each user a secure private workspace and a consistent interface.

**Features:**

- Google, email/password, and username/password authentication.
- Email verification, password reset, account linking, logout, and active-session management.
- Avatar, display name, username, bio, and interests.
- Onboarding with time zone, preferred week-start day, and units.
- Light, dark, and system appearance.
- Selectable lavender, mint, peach, rose, and sky-blue palettes.
- Accessibility preferences, reduced motion, and optional sound controls.
- Account deletion and initial data export.
- Shared navigation, error states, loading states, and responsive layouts.
- Private file-storage foundation for later photo features.

**Completion criteria:** Login and recovery work across supported methods; users cannot access another user's private records; preferences persist across sessions and devices.

### Phase 2 — Core planning and community templates

**Objective:** Make Momentin useful for planning and tracking a complete week, including community template creation and adoption.

**Features:**

- Habits with daily, selected-day, weekly-target, and every-N-days schedules.
- Checkbox, count, duration, and numeric measurement definitions.
- Tasks with priorities, deadlines, subtasks, recurrence, and estimated effort.
- Goals with milestones and linked habits/tasks.
- Categories, tags, search, filters, duplication, and archiving.
- Today dashboard, daily priorities, and weekly/monthly calendar views.
- Quick completion, undo, partial completion, fallback actions, and explicit pauses.
- Basic completion history, an overall daily streak, and separate schedule-aware habit consistency.
- Day-end progress locking with later annotations, two automatic monthly freezes with final coverage rules pending, explicit pause behaviour, and overdue-to-missed/late-completed task transitions.
- Curated habit and goal templates.
- User-created private/public templates with publishing previews.
- Community template discovery, bookmarks, ratings, and creator attribution.
- Copying templates into independent personal routines.
- Template versions, unpublishing, reporting, and basic moderation.
- Initial reminders, notification preferences, and quiet hours.

**Completion criteria:** Users can create or adopt a routine, customize it, track a full week, and review accurate history. Template copies contain no creator-private data and survive changes to the original.

### Phase 3 — Rich check-ins, journaling, and configurable progress charts

**Objective:** Capture the detail behind daily activity and make recorded progress understandable.

**Features:**

- Daily feedback, notes, optional reflection prompts, mood, energy, and effort ratings.
- Multiple photo attachments, captions, compression, upload status, and deletion.
- Structured measurements with units, optional targets, and multiple fields per activity.
- Optional charts configured by metric, chart type, date range, and aggregation.
- Line charts, bar charts, activity heatmaps, target lines, and optional moving averages.
- Private free-form journal and guided daily/weekly entries.
- Autosaved drafts, tags, search, calendar browsing, and related-activity links.
- References between journals and check-ins without duplicating source content.
- CSV measurement export and accessible chart tables.

**Completion criteria:** Entries persist reliably; edits update charts correctly; missing data and unit changes behave predictably; journal autosave and attachment privacy work as intended.

### Phase 4 — Motivation, achievements, and rewards

**Objective:** Make effort and progress visible through clear, dependable rewards.

**Features:**

- Current/longest overall streaks, individual habit consistency, completion percentages, and personal records; clearly distinguish overall participation from completion of the full daily plan.
- XP, levels, and an auditable reward history.
- Tiered badges for milestones, consistency, reflection, recovery, and completed goals.
- Locked, in-progress, and earned badge states with visible requirements and earned dates.
- Monthly challenges with stable requirements and collectible badges.
- Daily quests and monthly quest progress, with thresholds published in advance; distinguish quest points from XP.
- Cosmetic unlocks and user-defined personal rewards.
- Badge gallery and selectable profile badges.
- Optional celebration animations and sounds.
- Previewable achievement cards for export or later social posting.

**Completion criteria:** Rewards are issued once, remain consistent after edits, and match published criteria. Schedules and pauses produce correct streak outcomes. Users can disable celebrations.

### Phase 5 — Social feed, friends, and interest communities

**Objective:** Let users share progress and support each other while retaining control over personal information.

**Features:**

- Follow/unfollow, friend requests, friend removal, username search, and invite links.
- User profiles with pinned public goals, selected badges, and posts.
- Posts about activities, progress, photos, and achievements.
- Drafts, publishing previews, post editing/deletion, and audience selection.
- Following feed and discovery feed.
- Reactions, comments, mentions, and bookmarks.
- Topic communities and interest-based discovery.
- Private accountability groups with clear membership and visibility controls.
- In-app social notifications and configurable delivery preferences.
- Blocking, muting, reporting, and moderation queues.
- Explicit sharing of selected progress rather than automatic exposure of underlying logs.

**Completion criteria:** Feed visibility, blocking, group access, post deletion, and moderation behave consistently. Sharing a post never gives unintended access to a private journal or source attachment.

### Phase 6 — Shared challenges and leaderboards

**Objective:** Add optional cooperation and friendly competition on top of reliable activity and reward systems.

**Features:**

- Friends leaderboard and opt-in weekly XP leagues drawn from the global participant pool, with small groups rather than one worldwide ranking. Whether a separate worldwide table is retained remains open.
- League assignment, promotion/demotion, and small-population behaviour with transparent rules.
- Separate all-time personal achievements.
- Shared goals, group challenges, and friend streaks.
- Encouragement reactions and participant progress summaries.
- Published competitive-point rules, daily caps, week boundaries, and tie handling.
- Duplicate-award prevention, unusual-activity review, and moderation controls.
- Weekly snapshots and challenge history.
- Clear rules for joining late, leaving, pauses, and corrected activity records.
- Private participation options that do not expose personal measurements or journal content.

**Completion criteria:** Identical eligible actions produce identical scores; retries do not add points; weekly rankings close consistently; access and opt-out settings work across all views.

### Phase 7 — Reviews, insights, and planning improvements

**Objective:** Help users learn from their history and adjust their commitments.

**Features:**

- Weekly reviews and personal progress summaries.
- Planned-versus-actual effort tracking.
- Identification of repeatedly postponed tasks and goals receiving little activity.
- Trend summaries based on recorded data, with clear calculation explanations.
- Explicit rescheduling and workload-adjustment suggestions.
- Focus timer linked to tasks or habits, with pause/resume and session logging.
- Customizable dashboard layout and saved filters.
- Keyboard shortcuts and faster quick-add actions.
- Reminder snoozing and refined notification controls.

**Completion criteria:** Summaries match underlying records; suggestions do not silently change plans; focus sessions do not duplicate tracked time; dashboard preferences persist.

### Phase 8 — Offline use, integrations, and portability

**Objective:** Make everyday use resilient and make user data portable.

**Features:**

- Installable web-app experience.
- Offline check-ins and clearly indicated pending synchronization.
- Conflict handling for edits from multiple devices.
- Resolve how offline events received after day-end interact with locked progress, automatic freezes, and closed rankings before enabling offline check-ins. Do not silently bypass daily locking using a client-supplied timestamp.
- Browser notifications where supported, with in-app alternatives.
- Calendar export followed by optional calendar integrations.
- Documented data import format, validation, preview, and duplicate handling.
- Complete data export covering activities, measurements, journals, templates, and attachment references/files as appropriate.
- Sync status, retry behaviour, and clear failure messages.

**Completion criteria:** Offline activity synchronizes once without losing edits or duplicating rewards; unsupported browser capabilities have clear fallbacks; export and import preserve documented data faithfully.

### Phase 9 — Beta validation and launch readiness

**Objective:** Validate the integrated experience and prepare sustainable operation.

**Work:**

- Run a beta with target users and collect product feedback.
- Provide bug reporting, feedback submissions, and feature requests.
- Validate accessibility, responsive layouts, and all colour modes.
- Test account isolation, upload access, publishing permissions, and recovery.
- Review streak, time-zone, recurring schedule, reward, and ranking edge cases.
- Verify backup restoration, deletion behaviour, monitoring, and operational alerts.
- Establish support and moderation workflows.
- Measure storage and infrastructure costs under realistic use.
- Resolve high-impact usability problems before general availability.

**Completion criteria:** Critical flows pass acceptance checks, private data remains protected, recovery procedures are exercised, and beta feedback confirms that users can complete the main workflows without assistance.

## 7. Data model outline

| Area | Main records |
|---|---|
| Identity | User, authentication identity, session, profile, preferences |
| Planning | Goal, milestone, habit, schedule version, task, subtask, category, tag |
| Tracking | Check-in, completion state, metric definition, measurement, focus session |
| Reflection | Journal entry, prompt response, activity reference, attachment |
| Templates | Template, version, visibility, adoption, bookmark, rating |
| Motivation | Reward event, XP ledger, badge definition, badge award, personal record, freeze grant/use, daily quest, monthly quest progress |
| Social | Follow, friendship, post, comment, reaction, mention, bookmark |
| Community | Community, group membership, challenge, participation, shared streak |
| Competition | Eligible weekly XP event, scoring-rule version, ranking period, league, cohort membership, snapshot |
| Operations | Notification preference, delivery, report, moderation action, feedback |

Records should have explicit ownership, visibility where applicable, timestamps, and deletion behaviour. Derived statistics should remain traceable to their source records.

## 8. Cross-phase engineering and quality requirements

- Test access control, schedule calculations, reward idempotency, copying, publishing, and synchronization where these features are introduced.
- Build privacy, accessibility, backups, and error handling throughout development; Phase 9 validates the integrated result.
- Apply file type/size limits and private access controls to attachments.
- Never rely on front-end visibility alone to protect private data.
- Keep moderation operational from the first public-template release.
- Use server-authoritative reward and competitive calculations.
- Keep journal text and private photos out of routine analytics and logs.
- Maintain clear save states and recoverable drafts for writing workflows.
- Preserve original badge artwork and Momentin's visual identity.

## 9. Measuring usefulness

Evaluate outcomes through:

- Successful onboarding and first meaningful check-in.
- Continued weekly use and return after an interruption.
- Completion of user-selected priorities and goal milestones.
- Adoption and continued use of curated/community templates.
- Usefulness of measurement charts and weekly reviews.
- User understanding of badge and leaderboard rules.
- Healthy community participation, report handling, and notification opt-outs.
- Reliability of saving, syncing, account recovery, and data export.

These are evaluation measures, not promised outcomes. Numerical targets should be set after observing the first beta cohort. Journal content and private measurements should not be inspected to assess engagement.

## 10. Planning assumptions and boundaries

- This document defines scope and dependency order; it is not a fixed delivery-date estimate.
- Duration estimates require a selected stack, team capacity, and completed interaction designs.
- Each phase should deliver a demonstrable increment with its own acceptance checks.
- Community templates are part of the core template release, not deferred until the social feed.
- Phone-number login is excluded from the entire roadmap.
- AI coaching, direct messaging, payments, and a marketplace are not currently committed features.
- System notifications and social actions should respect user preferences and explicit participation.
- Selected stack: React with Vite and TypeScript, Node.js/Express with TypeScript, and PostgreSQL hosted on Neon. This replaces the earlier MongoDB/MERN proposal.
- Hosting: publish the React build on Netlify and adapt the Express API to Netlify Functions. Create a separate Momentin project/database on Neon; do not reuse Interview-Master data or secrets. Keep requests stateless; implement day-end reconciliation and scheduled work without relying on a permanently running Express process.
- Netlify's free plan is usage-limited; verify current credits and account plan before deployment and stay within the zero-budget constraint. Neon and attachment storage have their own limits. Choose durable private hosted attachment storage before deploying photo features.
- Store attachment metadata in PostgreSQL; authentication, email, and private object-storage integrations remain to be selected and verified. Use a local email test inbox for development; real Google sign-in needs OAuth configuration and connectivity.
- Proposed attachment budget: 250 MB per account including private photos, published snapshots, and template images; 10 MB input limit per image, resize to at most 1600 pixels on the longest edge, target roughly 200–500 KB per stored image, and at most five images per check-in or template. Show usage and reject excess uploads clearly. Count retained published/adopted assets and derivatives; sharing one physical file must not weaken independent access or deletion rules. Validate image readability and revise limits after local testing. This is a local product quota, not a promise of free hosted storage.

## 11. Duolingo inspiration and research context

The reward direction draws inspiration from documented achievement collections, personal records, shared streaks, quests, and social celebrations. Momentin will use its own rules, naming, and artwork.

- [Duolingo achievement badges](https://blog.duolingo.com/achievement-badges/)
- [Duolingo 2025 product highlights](https://blog.duolingo.com/product-highlights/)
- [Duolingo Friend Streaks](https://blog.duolingo.com/friend-streak/)
- [Duolingo Friends Quests](https://blog.duolingo.com/friends-quests/)

Research checked October 12, 2026:

- Duolingo describes weekly XP leagues and matching by similar study habits and time zones. Its public explanation does not disclose a reproducible matching algorithm. See [leagues and leaderboards](https://blog.duolingo.com/duolingo-leagues-leaderboards/).
- Daily Quests encourage progressively more substantial learning actions. Monthly Challenges shifted from XP targets to quest-based progress. See [Time Spent Learning Well](https://blog.duolingo.com/time-spent-learning-well/).
- Duolingo's 2025 highlights mention three Daily Quests and increased rewards for completing all three. See [product highlights](https://blog.duolingo.com/product-highlights/).
- Duolingo documents one overall streak that can be extended by a completed lesson in any subject. Its engineering explanation describes an equipped freeze protecting a missed practice day, not completing a specific lesson. See [cross-subject streaks](https://blog.duolingo.com/new-subjects/) and [streak protection](https://blog.duolingo.com/protecting-streaks-from-site-issues/). Momentin's two automatic monthly grants are its own proposed allocation, not a claim about Duolingo's current allowance.
- XP is earned through lessons and other learning activities, with some bonuses; weekly XP supports league competition. See [Duolingo's introductory guide](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/).

These descriptions are inspiration, not a promise that every current Duolingo account or platform has identical rules. Momentin must publish its own thresholds and eligibility rules instead of assuming Duolingo's activity scoring transfers to arbitrary habits.

Technical references for the selected setup: [React's Vite/TypeScript setup](https://react.dev/learn/build-a-react-app-from-scratch) and [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver).

## 12. Outstanding decisions and recommendations

The following are recommendations or questions, not confirmed product rules:

1. **Freeze coverage:** The overall daily streak is the requested direction. Recommend spending one freeze only when an existing overall streak faces a day with zero fully completed habits; keep the streak count unchanged, award no XP, and leave individual missed habits unchanged. Recommend two grants at the start of each local calendar month without rollover, resolving the final day of the previous month against its own allowance. Do not grant extra freezes through time-zone changes. Confirm overall protection versus the user's alternative of protecting one individual habit. Decide separately whether a completely unscheduled/all-paused day consumes a freeze or breaks the overall streak; pausing must not become unlimited protection.
2. **Weekly-target habits:** Recommend that one fully completed session (for example, one 30-minute workout toward three workouts/week) qualifies for today's overall streak. The individual weekly consistency streak advances only when the entire weekly target is met; do not apply daily freezes to unmet weekly targets. Aggregate targets without a session definition need an explicit daily qualifying unit before they can earn overall streak credit.
3. **Remaining history rules:** Daily locking with later annotations and late task completion are confirmed in Section 5. Deletion remains available for personal content and account removal; specify its effect on reward history. Define offline late-arrival policy before Phase 8. Task-only days are not yet eligible for the overall habit-based streak; confirm if tasks should also qualify.
4. **Goal calculations:** Recommend milestone percentages initially, with equal or explicit weights selected per goal. Confirm whether manual progress and metric-target modes should also ship initially; freeze historical configurations rather than retroactively recalculating old daily snapshots.
5. **Weekly boundary:** This is the exact shared start/end instant for a contest, distinct from each user's calendar display preference. Recommend a fixed time zone per cohort, Monday 00:00 to the next Monday 00:00, displayed in each participant's local time; travel must not move an existing contest's deadline.
6. **Leagues and quests:** Recommend cohorts of up to 30 real participants, initially grouped by league tier and time-zone band, later refined by recent eligible XP. Allow smaller groups during early use and labeled test accounts locally. Promotion/demotion thresholds and tie rules remain open. Recommend up to three achievable daily quests based on a user's existing schedule, one quest point per completed quest, and an initial monthly target of 30 points; monthly thresholds must be fixed before participation. These are Momentin proposals, not claims about Duolingo's current thresholds. Decide whether leagues replace the previously planned single global ranking.
7. **XP:** Recommend fixed completion awards and daily competitive caps, no partial-completion XP, no awards for creating habits, and no duplicate activity award when several goals are linked. Agree numeric awards and eligible actions before Phase 4; do not automatically grant XP for repeatedly editing targets or goals.
8. **Audience controls:** Teenagers and adults (13+) and admin report handling are confirmed. Specify age-appropriate profile, discovery, and interaction controls and intended launch countries before external access.
9. **Device access and reminders:** Different-network phone testing is required; responsive design handles screen differences independently of network access. Netlify is the preferred hosting target, with owner-only application access during development. No deployment exists yet. Recommend in-app reminders in Phase 2, with closed-app browser notifications remaining in Phase 8.
10. **Implementation and attachments:** React/TypeScript, Express, Neon PostgreSQL, and Netlify are selected. The configurable 250 MB attachment budget remains proposed; authentication and durable private attachment storage still need integration/selection. Continue using free tools and local development alongside hosted testing. See [SETUP.md](SETUP.md) for connection instructions and [Express on Netlify Functions](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/) for the hosting adapter.

## 13. Implementation status — October 28, 2026

The first foundation increment contains a responsive Today view, browser-only demo, appearance toggle, daily habit creation, partial numeric check-ins, completion/undo, an owner-key-protected Express API, a PostgreSQL migration, and Netlify configuration. The server scopes records to the configured owner, validates inputs, and rejects check-ins outside the current owner-local day. Connected records persist in Neon once configured; the demo retains only today's values locally.

This is not completion of Phase 1 or Phase 2. Real account authentication, onboarding, schedule versions, history UI, annotations, goals/tasks/templates, rewards/freezes, and uploads remain unimplemented. The owner key is a temporary private development gate. No cloud resources or deployment have been created. Database and hosting connection steps are in SETUP.md.
