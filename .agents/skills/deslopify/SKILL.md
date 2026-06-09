---
name: deslopify
description: Use when the user asks to deslopify, clean up AI slop, remove generated-looking code, or improve suspicious TypeScript/JavaScript code quality in a scoped file or folder.
---

# Deslopify Fix

## Core Definition

AI slop is not "code written by AI".

AI slop is locally provable code, architecture, workflow, or test mass that looks plausible but increases the cost of review, change, extension, correctness, security, or ownership.

Treat code as slop only when at least one of these is locally provable:

- It passes a narrow current scenario while making future scenarios harder.
- It hides a domain invariant behind loose types, casts, booleans, wrappers, fallbacks, or scattered conditionals.
- It duplicates behavior, contracts, mappings, or state derivation instead of creating or using the owning source of truth.
- It adds abstraction without owning a boundary, policy, lifecycle, dependency direction, or domain concept.
- It weakens TypeScript from a contract language into a suggestion language.
- It shifts verification burden from code/tests/types to human reviewers.
- It makes broken data, impossible state, unsafe input, or failed effects look intentionally valid.
- It optimizes for generated-code completion instead of human-maintained evolution.

Do not label code as slop merely because of formatting, personal style, unfamiliar patterns, small imperfections, or lack of comments.

## Primary Goal

Fix root causes, not symptoms.

Prefer deletion, stronger ownership, clearer domain modeling, stricter TypeScript contracts, smaller public APIs, and moving logic to the correct boundary over local patching.

This is a greenfield project. Compatibility wrappers, legacy import preservation, migration branches, and old behavior protection are suspicious by default unless the scoped code proves they are still required.

## Mandatory Pre-Fix Reflection

Before each fix, ask each question to a separate sub-agent and wait for answers.

Question 1 to root-cause sub-agent:

> Are we solving the root of the problem rather than consequences?
> Possible answers: yes, no.
> Include one sentence explaining the root cause.

Question 2 to higher-scope sub-agent:

> Is there a better or higher-level fix, even if it requires broader and riskier changes?
> Possible answers: yes, no.
> Include the best rejected higher-level option if answer is no.

Question 3 to architecture sub-agent:

> Are the planned fixes aligned with the relevant arch-* skills and current ownership boundaries?
> Possible answers: yes, no.
> Include the owning layer/component/module.

Iterate on the solution until the answers are exactly:

1. Yes, solving the root of the problem.
2. No, there is no better solution.
3. Yes, aligned with arch-* skills.

For TypeScript work, these answers must explicitly account for:

- Runtime trust boundaries.
- Domain vs DTO/API shape.
- Type narrowing/exhaustiveness.
- Failure representation.
- Import/dependency direction.
- Test behavior vs implementation coupling.

## Slop Triage Questions

Before editing, inspect the scoped files and answer internally:

1. What invariant is this code trying to protect?
2. Who owns that invariant: domain, feature, adapter, component, hook, route, test fixture, or external boundary?
3. Is the current code encoding the invariant directly, or through scattered conditionals/fallbacks/casts?
4. Which future change would become harder because of this code?
5. Which reviewer burden is being created: understanding, security reasoning, type reasoning, test setup, or dependency tracing?
6. Can the problem be solved by deleting code?
7. Can the problem be solved by moving code to the owner instead of abstracting around it?
8. Can TypeScript prove the invariant after the fix?
9. Is runtime validation placed only at untrusted boundaries?
10. Are tests proving behavior, or just protecting generated structure?

## Fix Priority Order

Prefer fixes in this order:

1. Delete dead, duplicate, pass-through, generated-looking, or speculative code.
2. Move logic to the owning domain/feature/boundary.
3. Replace stringly/boolean state with explicit domain types or discriminated unions.
4. Replace unsafe types/casts with precise types, `unknown` at boundaries, validation, or narrowing.
5. Collapse wrappers that do not own a contract.
6. Extract shared behavior only when duplication is real and current.
7. Split mixed responsibilities by ownership, not by arbitrary file size.
8. Strengthen tests around behavior and critical transitions.
9. Add tooling/config checks only after code shape is corrected.
10. Keep comments only when they explain non-obvious domain constraints or tradeoffs.

## AI Slop Signatures

Look especially for generated-code fingerprints:

- Plausible but ownerless helper names: `manager`, `service`, `utils`, `helpers`, `processor`, `handler`, `resolver`, `normalizer`, `safe*`.
- New abstraction introduced to avoid editing the real owner.
- Wide, generic APIs used by one caller.
- Mass conditional branches for states not present in the app.
- Defensive `?.`, `??`, empty arrays, no-op callbacks, and default objects after values are already guaranteed.
- Catch/log/continue paths that hide failure from the caller.
- Tests that mirror implementation instead of behavior.
- Types that are weaker than the runtime data.
- DTOs leaking through UI/domain layers.
- Repeated projection logic between hooks, ViewModels, selectors, stories, and tests.
- Long generated-looking comments that restate code.
- Exhaustive mappings where key and value are identical.
- Barrels/reexports/shims kept only because generated code created them.
- New fixture factories used only once.
- "Flexible" config objects that encode one current behavior.
- Broad generic components/hooks with only one real variant.
- Ad hoc normalization/sanitization inside trusted internal calls.
- Lint disables, `as any`, `as unknown as`, `as never`, non-null assertions, or optional fields added to silence the compiler.
- A passing happy-path test suite with no test for the state/failure/permission/data-boundary that the code claims to handle.

## TypeScript-Specific Criteria

### Type Contract Erosion

Fix when TypeScript contracts are weakened instead of clarified.

Bad signs:

- `any`, explicit or leaked through assignment, return, generic position, callback, test mock, JSON parsing, third-party API, or fixture.
- `unknown` immediately cast to a concrete type without validation or narrowing.
- `as unknown as T`, `as never`, broad `as T`, non-null assertions, or `satisfies` used to silence mismatch rather than preserve exactness.
- Optional properties added because one caller/test builds incomplete data.
- `Partial<T>`, `DeepPartial<T>`, `Record<string, unknown>`, `object`, `{}`, `Function`, `Promise<any>`, or `Array<any>` where a domain shape is known.
- Type aliases that rename the same shape without adding domain meaning.
- Interface inheritance used only to reuse fields while blurring domain boundaries.
- Generic parameters that do not constrain behavior or preserve a relation between inputs and outputs.
- Union members with overlapping optional fields that require fragile `'in'` checks or truthiness checks.
- Function overloads hiding unrelated modes instead of separate functions or a discriminated parameter.
- Public APIs accepting strings where the domain has a closed set.

Preferred fixes:

- Use precise domain types.
- Use `unknown` only at external boundaries, then validate/narrow.
- Use discriminated unions for state, async result, command variants, permission variants, and mutually exclusive data.
- Use `never` exhaustiveness for closed unions when adding a new variant should break compilation.
- Use branded/opaque types only when they protect real cross-boundary invariants.
- Use `readonly` and immutable data where mutation is not part of the contract.
- Preserve DTO/domain separation with explicit mapping at the boundary.

### Runtime Boundary Confusion

Fix when trusted and untrusted data are treated the same.

Bad signs:

- API/localStorage/query params/env/file/message/URL/JSON data typed as trusted domain data without decoding.
- Validation repeated deep inside trusted feature code instead of at the boundary.
- UI components parsing transport DTOs.
- Domain functions checking for impossible malformed values.
- Error fallback that turns invalid external data into empty valid product state.
- Security-sensitive values logged or passed through generic debug helpers.
- Client-side validation treated as sufficient for server-side trust.

Preferred fixes:

- Decode/validate at the first trusted boundary.
- Convert DTOs into domain types once.
- Reject invalid data explicitly instead of silently normalizing it unless product requirements define normalization.
- Keep sanitization/output encoding at the sink that requires it.
- Keep authorization/business-rule decisions in the owner, not in UI shells or adapters.

### Async And Failure Modeling

Fix when failure is erased or lifecycle ownership is unclear.

Bad signs:

- `Promise<boolean>`, `Promise<void>`, or `unknown` errors where callers need failure information.
- Catch blocks that log and continue.
- Fire-and-forget promises without explicit ownership.
- Retrying/debouncing/sleeping/mounted flags used to mask unclear state ownership.
- Multiple loading/error booleans that can represent impossible combinations.
- Derived async state stored separately and synchronized by effects.
- Cancellation/stale-result guards copied across hooks/services instead of owned by the async boundary.

Preferred fixes:

- Model async state as a discriminated union.
- Return explicit domain errors or typed result objects when callers must branch.
- Throw only across boundaries where exception semantics are intentional.
- Own cancellation, retry, and stale-result logic in the adapter/hook that owns the effect.
- Keep pure projection separate from IO.

### React/Frontend TypeScript

Fix when component code mixes presentation, domain decisions, IO, and projection.

Bad signs:

- Components manually recreate design-system primitives.
- Components fetch, normalize, authorize, translate, project, and render in one file.
- Boolean visual modes that actually encode domain state.
- Props forwarding/spreading through multiple layers.
- Component props wider than current behavior.
- Hook returns raw transport data plus many derived booleans.
- Context values recreated broadly and rerender unrelated surfaces.
- Story-only variants or debug controls leaking into production props.
- Tests asserting hook internals, effect calls, or mock call order instead of visible behavior/state transitions.

Preferred fixes:

- Put IO in the owner hook/adapter.
- Put projection in a pure function/ViewModel.
- Put domain decisions in the feature/domain layer.
- Keep components as composition/rendering units.
- Use design-system variant contracts instead of ad hoc visual booleans.
- Avoid changing visual presentation unless explicitly requested.

Guardrail:
When the best fix changes user-facing visual presentation, stop and notify the user before editing. Component visuals may come from Figma.

## Criteria By Area

### Architecture

Fix when:

- A file/component/hook/model has multiple responsibilities: orchestration, projection, IO, validation, rendering, analytics, navigation, permissions, or persistence.
- Domain decisions live in routes, UI components, adapters, test fixtures, or generic utilities.
- Feature code reaches around its boundary to import runtime concretes, sibling feature internals, route details, or app-level state.
- Boolean modes or string states encode several concepts and force scattered conditionals.
- Manager/service/helper/utils modules collect unrelated behavior and become implicit architecture.
- A module exists because generated code needed a place to put logic, not because the domain owns a concept.
- A dependency arrow points from stable/domain code toward volatile/runtime/UI code.
- A public API exposes implementation details of its current storage, transport, framework, or rendering.

Preferred fixes:

- Move decisions to the owner.
- Split by reason to change.
- Make dependencies point inward.
- Replace cross-feature imports with explicit contracts.
- Delete generic aggregation modules.
- Make illegal states unrepresentable.

### Duplication

Fix when:

- Behavior is repeated across source, tests, stories, adapters, wrappers, queries, selectors, or utilities.
- Constants, translation keys, route params, fixture shapes, mock builders, analytics payloads, or capability checks repeat with different names.
- Hook and ViewModel derive the same state.
- Story/test fixture duplicates production projection.
- Error mapping/loading branching/normalization/security checks repeat.
- Near-identical tests assert setup differences instead of behavior differences.
- Generated code created multiple local helpers instead of reusing the owning module.
- Duplicate schema/type definitions drift between runtime validators and TypeScript types.

Preferred fixes:

- Use one source of truth.
- Extract only real current behavior, not hypothetical reuse.
- Put shared code where ownership is clear.
- Delete duplicate tests and keep behavior-focused cases.
- Generate types from schema or derive schema/type from a single authoritative source when the project already supports that pattern.

### Wrappers

Fix when:

- A module/hook/component/adapter/repository only forwards to another API.
- A wrapper only renames props, returns another hook result, or spreads values through.
- Reexport barrels exist only to preserve old import paths in a greenfield app.
- Adapter methods mirror DTOs exactly and add no domain contract.
- `safe*`, `normalize*`, `resolve*`, `get*`, or `build*` hides the real API name without adding validation, policy, lifecycle, or ownership.
- A wrapper catches errors only to return fake success/empty values.
- A wrapper exists only because generated code could not locate the existing abstraction.

Preferred fixes:

- Inline and delete.
- Keep wrappers only when they define a boundary: validation, mapping, policy, lifecycle, permission, instrumentation, dependency inversion, or stable domain contract.
- Rename the real owner instead of creating a shadow API.

### Bloat

Fix when:

- Hand-written code has generated-looking mass.
- Manual registries duplicate a source of truth.
- Production includes demo/debug/test/fixture/story/playground artifacts.
- Prop drilling, object spreading ladders, or config maps obscure direct composition.
- Exhaustive mappings repeat enum/object keys and values without transformation.
- Giant fixtures contain mostly irrelevant fields.
- Local abstractions support hypothetical variants.
- Comments explain every line but not the domain tradeoff.
- New files mostly move code sideways without reducing ownership complexity.
- The implementation is much more general than current requirements.

Preferred fixes:

- Delete.
- Inline.
- Use direct composition.
- Make fixtures minimal.
- Generate registries from source of truth only if the project already has a generation workflow.
- Keep abstractions proportional to current behavior.

### Dead Paths

Fix when:

- Validators, schemas, adapters, feature flags, compatibility branches, enum members, variants, or fallback values are obsolete.
- Tests are the last consumer of removed functionality.
- Optional parameters/default callbacks are never omitted.
- Branches cover impossible platform/auth/sync/locale/config states.
- Code supports deleted migrations, old app behavior, old API versions, or removed native/web behavior.
- Translation keys, stories, fixtures, or mock factories are unused.
- Build/config exceptions exist for files that should no longer exist.

Preferred fixes:

- Delete production code and tests together.
- Do not keep tests that protect removed functionality from reappearing.
- Do not add compatibility unless current product/runtime requires it.

### Defensive Code

Fix when:

- Broad try/catch, fallback, logging, null guards, `safe*` wrappers, no-op callbacks, empty arrays, default objects, optional chaining, or `??` hide unclear ownership.
- Values are guarded after the type/domain contract already guarantees them.
- Invalid data is silently normalized to valid-looking state.
- Failures are swallowed where the caller needs failed state or an explicit effect.
- Validation is duplicated inside trusted internal calls instead of external boundaries.
- Catch blocks log sensitive data or leak implementation details.
- Retrying/timeouts/debouncing/mounted flags mask unclear lifecycle ownership.

Preferred fixes:

- Trust internal contracts.
- Validate external input once.
- Fail explicitly.
- Model absent/failure states in types.
- Remove fake fallbacks.
- Place lifecycle logic in the owner.

### Tests

Fix when:

- Tests couple to private structure instead of behavior.
- Fake harnesses, mock setup, timers, repositories, navigation objects, or event buses are larger than the behavior under test.
- Assertions restate mocked inputs, call order, object identity, config values, constants, default values, or translation key names.
- Wrapper tests only prove forwarding.
- Snapshot/story matrices are the only proof of conditional logic or failure paths.
- Tests force production code to expose internals.
- Tests preserve removed behavior, migration paths, or speculative variants.
- Tests use incomplete data and force production types to become optional.
- Tests assert generated file shape instead of owned contract.

Preferred fixes:

- Test public behavior and domain transitions.
- Prefer pure function/model tests for projection and state transitions.
- Use minimal fixtures.
- Test one representative path per behavior difference.
- Delete tests for deleted paths.
- Use integration-style tests only at owned boundaries.
- Add negative/failure tests when the code claims to handle invalid input, authorization, IO failure, parsing, or async cancellation.

### Type And Build

Fix when:

- Broad disables, `as any`, `@ts-ignore`, `@ts-expect-error` without a narrow reason, sleeps/timeouts, path mutation, non-null assertions, ambient declarations, or config exceptions hide wrong code.
- Type aliases rename the same shape without domain meaning.
- Promise/result types erase failure information into `boolean`, `void`, or `unknown`.
- Optional fields exist only for incomplete test data.
- Module aliases hide wrong imports or boundary violations.
- Dependency arrays are mutated to silence lint instead of fixing ownership.
- `skipLibCheck`, broad `include`, or build exclusions are used to hide local project type errors.
- Generated-looking code adds overloads/generics/index signatures where exact types are available.

Preferred fixes:

- Correct the type contract.
- Remove broad escape hatches.
- Use narrow, documented local exceptions only when the external library is wrong and the boundary is isolated.
- Use typed linting when project configuration supports it.
- Keep build config simple and honest.

### Security

Fix when:

- Untrusted input reaches command execution, file paths, SQL/NoSQL queries, HTML/DOM sinks, redirects, logs, storage, auth decisions, or external API calls without explicit validation/encoding/authorization.
- Secrets, tokens, personal data, or credentials are hardcoded, logged, exposed in errors, included in fixtures, or copied into generated examples.
- Authorization is checked only in UI/client code.
- User-controlled strings are used to construct paths, URLs, commands, regular expressions, queries, or dynamic code.
- `eval`, dynamic `Function`, unsafe deserialization, `innerHTML`, `document.write`, or dynamic import paths appear without a proven safe boundary.
- Error handling reveals sensitive information or hides security-relevant failures.
- Dependencies are added for trivial code or from untrusted/unmaintained packages.
- Security wrappers return success on failure.

Preferred fixes:

- Validate at trusted server/boundary.
- Use allowlists for closed sets.
- Use parameterized APIs.
- Keep authorization server-side or in the authoritative boundary.
- Remove secrets and replace with configured secret access.
- Avoid new dependencies for trivial helpers.
- Make security failure explicit and test it.

### Performance

Fix when:

- Data, callbacks, styles, selectors, regexes, dates, maps, lists, or expensive computations are recreated on hot render paths without input changes.
- Filtering/sorting/searching happens inside render when source/query did not change.
- State stores derived values and effects synchronize them.
- Context/provider values rerender unrelated surfaces.
- Extra wrappers/layers cause repeated computation with no user-visible value.
- Memoization defends against unstable architecture instead of moving computation to the owner.
- Generated code repeatedly scans arrays/maps where a single projection/source-of-truth index is simpler.

Preferred fixes:

- Move derivation to the owner.
- Compute once at the boundary or selector.
- Remove redundant state.
- Memoize only stable, meaningful expensive work.
- Split providers by ownership only when broad rerenders are real.

### Design

Fix when:

- Component folder structure is non-conventional compared to the golden sample: `components/ds/components/IconButton`.
- Product components recreate DS atoms, icon buttons, text treatments, spacing, or state colors.
- Visual variants are ad hoc booleans/classes instead of DS variant contracts.
- Component files mix DS primitives, feature orchestration, screen layout, data mapping, and IO.
- Style constants are duplicated across component, story, and test fixtures.
- Story/playground layout hides real mobile/web/long-text/accessibility behavior.
- Generated code adds visual props not present in the design-system contract.

Guardrail:
When the best solution affects user-facing visual presentation, stop and notify the user before editing.

## TypeScript Fix Patterns

Use these as preferred transformations.

### Replace Boolean Modes

Before:

```ts
type Props = {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  data?: Item[];
};
```

After:

```ts
type ItemsState =
  | { kind: 'loading' }
  | { kind: 'error'; error: ItemsError }
  | { kind: 'empty' }
  | { kind: 'ready'; items: readonly Item[] };
```

### Replace Unsafe Boundary Cast

Before:

```ts
const user = JSON.parse(raw) as User;
```

After:

```ts
const parsed: unknown = JSON.parse(raw);
const user = parseUser(parsed);
```

`parseUser` belongs at the boundary, not inside trusted domain code.

### Replace Optional Lies

Before:

```ts
type Lesson = {
  id?: string;
  title?: string;
};
```

After:

```ts
type Lesson = {
  id: LessonId;
  title: string;
};
```

Use separate input/build types only if incomplete data is a real boundary contract.

### Replace Stringly State

Before:

```ts
function handleStatus(status: string) {}
```

After:

```ts
type LessonStatus = 'new' | 'inProgress' | 'completed';

function handleStatus(status: LessonStatus) {}
```

For richer states, prefer discriminated unions.

### Replace Generic Helper Slop

Before:

```ts
function processData<T>(data: T[], options?: ProcessOptions): T[] {
  return data.filter(Boolean);
}
```

After:

```ts
function visibleLessons(lessons: readonly Lesson[]): readonly Lesson[] {
  return lessons.filter((lesson) => lesson.isVisible);
}
```

Use domain names when the behavior is domain behavior.

### Replace Wrapper Forwarding

Before:

```ts
export function useLessonsViewModel() {
  return useLessons();
}
```

After:

- Inline `useLessons()` at callers, or
- Make `useLessonsViewModel()` own projection/lifecycle if that is the real boundary.

### Replace Swallowed Failure

Before:

```ts
try {
  await saveLesson(input);
  return true;
} catch {
  return false;
}
```

After:

```ts
type SaveLessonResult =
  | { kind: 'saved'; lesson: Lesson }
  | { kind: 'failed'; error: SaveLessonError };
```

Only throw if callers are expected to handle exceptions at the boundary.

## Validation Requirements

After each fix, run the strongest locally available validation that is relevant and practical:

- TypeScript typecheck.
- Lint, especially typed linting when configured.
- Unit tests for changed behavior.
- Integration/component tests for changed boundaries.
- Security/static checks when touching input, auth, filesystem, command execution, DOM sinks, dependency loading, or secrets.
- Build if the change affects public exports, imports, config, route structure, or package boundaries.

Do not add validation commands that are not available in the repo.
Do not claim validation passed unless it actually ran and passed.
If validation cannot run, report why.

## Memory

CRITICAL RULE:
After each fix, append one sentence to `.agents/skills/deslopify/MEMORY.md` with the result.

`MEMORY.md` must be updated even when it is already dirty.
Its dirty/uncommitted state must never block staging or committing the requested non-memory work.
Do not ever commit `.agents/skills/deslopify/MEMORY.md` changes.
Leave the git status dirty for that file.

The memory sentence format:

```md
- YYYY-MM-DD: Deslopified <scope> by <main root-cause fix>; validation: <result>.
```

## Reporting After Fix

Report:

1. What was done?
2. Why was it a problem?
3. Which solutions were considered?
   - The accepted solution must be first.
   - Include rejected options and why they were weaker.
4. TypeScript contract impact:
   - Which types became stricter?
   - Which casts/optionals/fallbacks/wrappers were removed?
   - Which boundary owns validation now?
5. Architecture impact:
   - Which owner now owns the behavior?
   - Which dependency direction or responsibility improved?
6. Validation results:
   - Commands run.
   - Pass/fail result.
   - Any validation not run and why.
7. Memory update:
   - Confirm `.agents/skills/deslopify/MEMORY.md` was appended.
   - Confirm it was not committed.

## Stop Conditions

Stop and notify the user when:

- The best fix changes user-facing visual design.
- The fix requires product/domain decisions not provable from scoped code.
- The fix requires deleting behavior that may still be product-required but cannot be proven dead.
- The fix changes security, privacy, billing, authentication, authorization, analytics semantics, or data retention in a way that needs explicit product approval.
- The repository has contradictory architecture conventions and no local owner can be inferred.

When stopping, still provide:

- The root problem.
- The safest locally provable partial fix, if any.
- The decision needed from the user.
