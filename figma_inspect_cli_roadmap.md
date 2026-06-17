# Roadmap доработок `figma-inspect-cli`

## P0 — Lock stability

Статус: сделано для текущего component set export.

### Задачи

- Игнорировать timestamp-only drift при verify.
- Сохранять старые timestamps при export, если tree fingerprint не поменялся.
- Не перезапрашивать assets при timestamp-only drift.
- Добавить тесты.

### Acceptance criteria

- `npm run check` проходит.
- `npm run build` проходит.
- `component-set.lock.yaml` не меняется при повторном export, если Figma tree не поменялся, но `updatedAt` поменялся.
- Verify не падает на metadata-only timestamps.

## P1 — Component by URL wrapper

Статус: сделано как универсальный URL foundation.

Цель: сделать рабочий UX “импорт компонента по ссылке”.

### CLI/API

Добавлена CLI опция:

```bash
figma-inspect --export-component-set --url "<figma-url>" --output-dir ... --variables ...
```

Также URL работает как node ref для inspect:

```bash
figma-inspect --inspect-file-node --url "<figma-url>"
figma-inspect --inspect-component-set --url "<figma-url>"
figma-inspect --inspect-component-set-properties --url "<figma-url>"
```

### Done

- Добавлен parser Figma URL:
   - file key из `/design/<fileKey>/...` или `/file/<fileKey>/...`;
   - node id из `node-id=3971-6465`, нормализовать в `3971:6465`.
- Для component-set команд URL превращается в typed node ref, затем проверяется, что node — `COMPONENT_SET`.
- `--export-component-set --url` резолвит published component set через team registry.
- При export по URL пишется `import-notes.md`.
- Добавлены unit tests на URL variants, CLI parsing, run wrapper, resolver error for non-`COMPONENT_SET`.
- Обновлены `src/cli/usage.ts`, parse/run tests, live-test skill.

### Acceptance criteria

- Команда работает по Figma URL без ручного копирования fileKey/nodeId.
- Ошибка понятная, если ссылка ведет на обычный FRAME/INSTANCE, а не component set.
- `npm run check` + `npm run build` проходят.

## P1.5 — Node contract by URL

Статус: сделано.

Цель: экспортировать не только published component sets, но и конкретные Figma nodes по ссылке: в первую очередь `FRAME` экранов/верстки и standalone `COMPONENT`.

Это следующий слой поверх P1: URL уже превращается в canonical `fileKey/nodeId`, поэтому P1.5 должен добавить node-type-specific contract generation и lock для non-component-set nodes.

### CLI/API

Добавить отдельную команду, чтобы не смешивать semantics с component set export:

```bash
figma-inspect --export-node-contract --url "<figma-url>" --output-dir ... --variables ...
```

Опционально разрешить ручной source без URL для live/debug сценариев:

```bash
figma-inspect --export-node-contract --file-key <key> --node-id <id> --output-dir ... --variables ...
```

### Supported node types

MVP:

- `FRAME` — screen/layout contract.
- `COMPONENT` — standalone component contract without variants.

Later:

- `INSTANCE` — только если появится понятная semantics: export resolved instance tree vs reference to source component.
- `SECTION`, `GROUP`, `CANVAS` — не поддерживать до явного use case.

### Artifact names

Файлы должны использовать node type в namespace:

```text
Settings.frame.meta.yaml
Settings.frame.geometry.yaml
Settings.frame.visuals.yaml
Settings.frame.structure.dsl
Settings.frame.lock.yaml

Icon.component.meta.yaml
Icon.component.geometry.yaml
Icon.component.visuals.yaml
Icon.component.structure.dsl
Icon.component.lock.yaml
```

Для `COMPONENT_SET` остается текущая команда и текущие имена:

```text
TextInput.component-set.meta.yaml
TextInput.component-set.geometry.yaml
TextInput.component-set.visuals.yaml
TextInput.component-set.structure.dsl
TextInput.component-set.lock.yaml
```

### Lock for non-component-set nodes

Lock нужен сразу, даже для `FRAME`/`COMPONENT`, чтобы verify мог отличать свежий импорт от stale design source.

Предлагаемый v1 для node lock:

```yaml
version: 1
kind: frame                  # frame | component
source:
  fileKey: ...
  nodeId: ...
  nodeType: FRAME
  name: Settings
  sourceUrl: ...
fingerprints:
  tree: ...                  # current raw-tree fingerprint, same principle as component set
  contracts: ...
  assets: ...
dependencies:
  componentSets:
    - key: ...
      fileKey: ...
      nodeId: ...
      name: ...
  components:
    - key: ...
      fileKey: ...
      nodeId: ...
      name: ...
```

Notes:

- `updatedAt` may be unavailable for arbitrary file nodes via Figma node API, so freshness should rely on tree/contract fingerprints first.
- If dependency metadata provides timestamps later, add them under dependency entries, not as a required field for the root node lock.
- Lock is not LLM prompt material; model handoff should reference meta/geometry/visuals/structure only.

### Contract semantics

`FRAME`:

- Treat root frame as screen/layout contract, not as variant component.
- Preserve layer hierarchy, layout mode, sizing, constraints, spacing, fills/strokes/effects, text placeholders, visibility.
- Collect nested `INSTANCE` usage as dependencies.
- In `structure.dsl`, represent screen tree and mark component/instance boundaries.
- Do not invent props/variant axes for frames.

`COMPONENT`:

- Treat as single-state component contract.
- Support component properties if present, but no variant axis matrix unless parent is `COMPONENT_SET`.
- Collect nested dependencies same as frame.

### Tasks for agent

1. Add node target type helpers:
   - map Figma node type to artifact namespace: `FRAME -> frame`, `COMPONENT -> component`;
   - reject unsupported node types with clear errors.
2. Add `--export-node-contract` to parse/run/usage.
3. Load node tree by URL or `fileKey/nodeId`.
4. Build node contracts:
   - reuse slim-node / token resolution where sensible;
   - avoid forcing component-set prop/variant model onto frames.
5. Build dependency extraction for nested components/component sets.
6. Write node artifacts and node lock.
7. Add verify support for node locks:
   - current `--verify-component-contract` can stay component-set-only;
   - either add `--verify-node-contract` or rename later to generic `--verify-contract`.
8. Update live-test skill and fixtures.

### Acceptance criteria

- Пример screen URL экспортируется как `*.frame.{meta,geometry,visuals}.yaml`, `*.frame.structure.dsl`, `*.frame.lock.yaml`.
- Standalone `COMPONENT` URL экспортируется как `*.component.*`.
- Lock создается для `FRAME` и `COMPONENT`.
- Verify для node lock ловит real tree drift.
- Unsupported node types fail with clear message.
- Existing `--export-component-set` behavior stays intact.
- `npm run check` + `npm run build` проходят.

## P2 — Lock v2 и contract surface fingerprint

Цель: отделить фактические изменения визуального/структурного контракта от metadata drift для всех lock kinds: `component-set`, `component`, `frame`.

### Предлагаемый lock v2

```yaml
version: 2
kind: component-set          # component-set | component | frame
source:
  fileKey: ...
  nodeId: ...
  nodeType: COMPONENT_SET
  sourceUrl: ...
  componentSetKey: ...       # only for component-set
  componentSetUpdatedAt: ... # only when available
variants:                   # only for component-set
  - key: ...
    nodeId: ...
    name: ...
    updatedAt: ...
fingerprints:
  tree: ...                  # raw-tree compatibility; optional later
  contractSurface: ...       # normalized visual/layout/structure surface
  contracts: ...
  assets: ...
approval:
  status: unverified         # unverified | verified | deprecated
  verifiedAt: null
  verifiedBy: null
  baselineRevision: null
drift:
  lastCheckedAt: ...
  metadataChanged: false
  sourceChanged: false
  structureChanged: false
  visualsChanged: false
```

### Surface fingerprint allowlist

Include:

- node type;
- name where it defines semantic structure;
- component/instance identity;
- variant axes and variant names;
- layout mode, sizing mode, constraints;
- dimensions relevant to contract;
- padding, gaps, radius;
- fills/strokes/effects/opacity/blend mode;
- text style and text content placeholders;
- visible/hidden layer state;
- bound variables and resolved token refs;
- children order.

Exclude or normalize:

- timestamps;
- editor metadata;
- absolute page position when not part of component layout;
- plugin data that is not used by contracts;
- volatile REST response ordering;
- internal ids that do not represent source identity.

### Tasks for agent

1. Add `fingerprintContractSurface(raw, variables, teamComponents?)`.
2. Add tests with fixture where only `updated_at` changes.
3. Add tests where absolute canvas position changes but layout contract does not.
4. Add tests where padding/fill/text/children order changes and fingerprint changes.
5. Add migration reader for lock v1/v2.
6. Keep writer on v2 only after repo adoption is ready.

### Acceptance criteria

- False positives from timestamp/canvas-position metadata are gone.
- Real layout/visual/structure changes are detected.
- Backward compatibility with lock v1 read is preserved.

## P3 — Verified manifest and bulk registry

Цель: управлять 250+ компонентами без ручного запуска CLI по одному.

### Interim manifest before lock v2

```yaml
components:
  TextInput:
    figma:
      kind: component-set
      componentSetKey: ...
      fileKey: ...
      nodeId: ...
    implementation:
      path: components/ds/TextInput
      storybookGroup: ds-text-input
      mode: structural
    status:
      imported: true
      verified: true
      owner: design-system
nodes:
  SettingsScreen:
    figma:
      kind: frame
      fileKey: ...
      nodeId: ...
      url: ...
    implementation:
      path: app/settings
      mode: screen
    status:
      imported: true
      verified: false
      owner: product
```

### Commands

```bash
figma-inspect --export-component-registry --output tools/design-import/components.generated.yaml
figma-inspect --verify-component-contract --contract-dir artifacts/figma-components --json
figma-inspect --export-component-set-batch --manifest tools/design-import/components.yaml
figma-inspect --export-node-contract-batch --manifest tools/design-import/nodes.yaml
```

### Acceptance criteria

- Можно получить список published DS component sets.
- Можно batch-verify все component-set/component/frame lock-файлы.
- Можно отфильтровать verified/unverified/changed components.

## P4 — Model handoff generator

Цель: давать LLM минимальный deterministic prompt package.

### Generated handoff

```text
artifacts/figma-components/<Name>/handoff.md
artifacts/figma-components/<Name>/implementation-plan.md
```

Содержимое:

- component summary;
- props/variant axes;
- node kind: component-set/component/frame;
- structural vs asset-backed recommendation;
- token gaps;
- assets to copy;
- known unsupported Figma features;
- paths to DSL/YAML files;
- explicit forbidden actions: do not hardcode tokens, do not add story-only props, do not use lock as design prompt.

### Acceptance criteria

- LLM prompt no longer needs raw JSON.
- Handoff file is deterministic and diff-friendly.

## P5 — Storybook matrix generator

Цель: сделать screenshot baseline из Storybook matrix, без LLM-галлюцинаций.

### Inputs

- `components.yaml`;
- `nodes.yaml` for screen/frame smoke coverage later;
- component stories metadata;
- `component-set.meta.yaml` variant axes;
- fixture-only visual states;
- viewport config.

### Output

```json
{
  "entries": [
    {
      "component": "TextInput",
      "group": "ds-text-input",
      "story": "Matrix",
      "viewport": "mobile",
      "stateKey": "State=Empty__Active=On__Writing=Default",
      "url": "/iframe.html?id=..."
    }
  ]
}
```

### Acceptance criteria

- Matrix адаптируется под viewport.
- Baseline key стабилен.
- Можно запускать changed-only и all.

## P6 — Screenshot runner and dashboard

Цель: закрыть CI/CD часть: compare, update, approve, dashboard.

### Commands

```bash
pnpm screenshot:web:compare --matrix tools/screenshot-matrix/matrix.generated.json
pnpm screenshot:web:update --matrix tools/screenshot-matrix/matrix.generated.json
pnpm design:dashboard:generate
```

### Artifacts

```text
actual.png
baseline.png
diff.png
report.json
report.md
video.webm              # optional, mostly for E2E flows
```

### Dashboard metrics

- `% imported`
- `% fresh locks`
- `% screenshots pass`
- `approval backlog`
- drift by component
- failures by component/viewport/state
- nightly trend

### Acceptance criteria

- MR job blocks only verified component regressions.
- Nightly produces dashboard.
- Update job creates artifacts/bot MR, not direct baseline commits.

## P7 — Native E2E and screenshot expansion

Цель: после web DS screenshots добавить iOS/Android confidence.

### Scope

- Maestro smoke flows for features.
- iOS/Android component screenshot POC.
- EAS simulator farm integration.
- Qase upload and reporter integration.
- Video evidence for native failures.

### Order

1. Web DS screenshot matrix.
2. Web feature E2E smoke.
3. Native Maestro smoke.
4. Native screenshot matrix only for verified DS components.

## P8 — Hardening

### Security/secrets

- Добавить `.env.example`.
- Проверить, что `.env.local` никогда не попадает в package/artifacts.
- CI variables only для tokens.
- No token echo in logs.

### Dependencies

- Обновить `vitest` и related dev dependencies после проверки compatibility.
- Разобрать `npm audit` findings отдельным MR.

### Live tests

- Добавить gated live-test command, который запускается только при наличии env vars и network.
- Не запускать live Figma tests в обычном unit suite.

### Docs

- README: import by URL flow.
- README: lock semantics.
- README: screenshot matrix lifecycle.
- AGENTS skill: design import agent handoff.
