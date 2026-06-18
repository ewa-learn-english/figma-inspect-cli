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

## P1.6 — Unified export contract wrapper

Статус: сделано.

Цель: упростить CLI для оператора и LLM: по Figma URL не требовать заранее знать, что это `COMPONENT_SET`, `FRAME` или standalone `COMPONENT`.

### CLI/API

Добавить универсальную команду:

```bash
figma-inspect --export-contract --url "<figma-url>" --output-dir ... --variables ...
```

Опционально разрешить ручной source:

```bash
figma-inspect --export-contract --file-key <key> --node-id <id> --output-dir ... --variables ...
```

### Semantics

`--export-contract` должен быть тонким wrapper/autodetect слоем:

- URL/file-key+node-id превращается в canonical node ref.
- CLI загружает root node и определяет Figma node type.
- `COMPONENT_SET` маршрутизируется в существующий component-set export pipeline.
- `FRAME` маршрутизируется в node-contract frame pipeline.
- standalone `COMPONENT` маршрутизируется в node-contract component pipeline.
- `COMPONENT` внутри component set получает понятную ошибку: выбрать root `COMPONENT_SET` или использовать `--export-component-set`.
- Unsupported node types (`INSTANCE`, `SECTION`, `GROUP`, `CANVAS`, etc.) получают clear error с фактическим node type.

### Compatibility / command policy

Оставить специализированные команды как explicit/debug surface:

```bash
figma-inspect --export-component-set ...
figma-inspect --export-node-contract ...
```

Но в docs/live-test/LLM handoff рекомендовать URL-first путь:

```bash
figma-inspect --export-contract --url "<figma-url>" --output-dir ... --variables ...
```

Reasons:

- оператору не нужно понимать Figma node taxonomy;
- LLM может использовать одну команду для design import;
- внутри код остается типизированным: component-set и node-contract pipelines не смешиваются;
- acceptance/error messages становятся проще: “дай ссылку на Figma node”.

### Tasks for agent

1. Add `--export-contract` to parse/run/usage.
2. Add inspect helper for root node type detection by `FigmaNodeRef`.
3. Route `COMPONENT_SET` to current `exportComponentSet`.
4. Route `FRAME`/standalone `COMPONENT` to `exportNodeContract`.
5. Preserve `sourceUrl` in downstream import notes/locks.
6. Add tests for autodetect routing:
   - component set URL -> `.component-set.*`;
   - frame URL -> `.frame.*`;
   - standalone component URL -> `.component.*`;
   - unsupported node -> clear error.
7. Update `.agents/skills/live-test/SKILL.md`.

### Acceptance criteria

- `--export-contract --url <component-set-url>` produces current component-set artifacts.
- `--export-contract --url <frame-url>` produces frame artifacts.
- `--export-contract --url <standalone-component-url>` produces component artifacts.
- Specialized commands still work.
- Usage/help and live-test skill prefer `--export-contract` for URL-first workflows.
- `npm run check` + `npm run build` проходят.

## P2 — Lock v2 и contract surface fingerprint

Статус: сделано.

Цель: отделить фактические изменения визуального/структурного контракта от metadata drift для всех lock kinds: `component-set`, `component`, `frame`.

### Lock v2

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

1. Add `fingerprintContractSurface(raw, variables?, teamComponents?)`.
2. Add tests with fixture where only `updated_at` / volatile metadata changes.
3. Add tests where absolute canvas position changes but layout contract does not.
4. Add tests where padding/fill/text/children order changes and fingerprint changes.
5. Add migration reader for lock v1/v2.
6. Write v2 locks for all exporters after repo adoption.
7. Use `contractSurface` for verify drift, with `tree` as v1 fallback / compatibility fingerprint.

### Done

- Added allowlisted contract surface fingerprinting:
   - includes node type/name, component and instance identity, variant definitions/names, layout, dimensions, constraints, fills/strokes/effects, opacity/blend mode, text style/content, visibility, bound variables, and children order;
   - excludes timestamps, plugin/editor metadata, absolute canvas `x/y`, and other REST payload noise.
- Component-set writer now emits `version: 2`, `kind: component-set`, `fingerprints.contractSurface`, `approval`, and `drift`.
- Frame/component node writer now emits v2 lock fields and `fingerprints.contractSurface`.
- Component-set and node lock readers accept both v1 and v2.
- Verify compares `contractSurface` for v2 locks and falls back to raw `tree` for v1 locks.
- Verify stdout includes `contract-surface` when a real surface drift is detected.
- Added unit coverage for:
   - metadata-only drift;
   - canvas-position-only drift;
   - layout/visual/text/children-order changes;
   - v1 fallback and v2 surface compare.

### Acceptance criteria

- False positives from timestamp/canvas-position metadata are gone.
- Real layout/visual/structure changes are detected.
- Backward compatibility with lock v1 read is preserved.
- `npm run check` + `npm run build` проходят.

## P2.5 — Nested node asset export

Статус: сделано.

Цель: закрыть legacy gap для импорта компонентов, где часть дизайна должна быть перенесена в TypeScript как локальный visual asset: иконка, иллюстрация, сложная vector/group/frame-нода или вложенный instance.

Это не compatibility layer для старого `component.contract.json`; импорт и валидация идут по новым `dsl/yaml/lock/preview` контрактам.

### CLI/API

Добавлен отдельный sidecar export, не смешанный с текущим asset-backed component-set mode:

```bash
figma-inspect --export-contract --url "<figma-url>" --output-dir ... --variables ... \
  --export-nested-assets \
  --asset-node-id <nested-node-id> \
  --asset-format svg
```

Опции:

- `--export-nested-assets` — экспортировать выбранные nested nodes как sidecar assets;
- `--asset-node-id <id>` — explicit nested node id, repeatable;
- `--asset-include-regex <regex>` — выбрать candidates по имени/path;
- `--asset-node-types <csv>` — ограничить candidate types, например `INSTANCE,VECTOR,FRAME`;
- `--asset-max <number>` — fail-fast guard против случайного массового экспорта;
- `--asset-format svg|png` — repeatable, default `svg`;
- `--asset-scale <number>` — PNG scale, default `2`.

Текущий `--export-assets` остается про component-set variant assets, где SVG variants становятся частью `meta.assets` и `structure.dsl`.

### Semantics

- Работает для `COMPONENT_SET`, standalone `COMPONENT`, `FRAME`.
- По умолчанию не экспортирует все подряд: нужен explicit id или фильтр.
- Candidate discovery использует conservative heuristic:
   - visual node types: `INSTANCE`, `COMPONENT`, `COMPONENT_SET`, `FRAME`, `GROUP`, `BOOLEAN_OPERATION`, `VECTOR`;
   - visual keywords in name/path: `icon`, `logo`, `asset`, `image`, `illustration`, `avatar`, `photo`, `thumb`, `thumbnail`, `badge`, `mark`, `glyph`, `symbol`, `spinner`, `loader`.
- Files:
   - `<Name>.assets/<slug>.svg`
   - `<Name>.assets/<slug>.png`
   - `<Name>.<kind>.nested-assets.yaml`
- Manifest содержит:
   - source node id/name/type/path;
   - reasons/selection criteria;
   - exported file paths/formats/scale;
   - warnings для non-exported candidates.
- SVG root `width/height` нормализуются, PNG валидируется по signature.
- Nested assets не должны автоматически менять structure DSL; handoff должен явно подсказать, какие assets copy/use.
- Nested asset manifest сейчас является sidecar artifact и не меняет lock fingerprints; если nested assets станут committed implementation assets, следующим шагом нужен отдельный verify/hash path, чтобы drift не прятался.

### Реализация

- `--export-nested-assets` доступен для `--export-contract`, `--export-component-set`, `--export-node-contract`.
- Требует `--asset-node-id` и/или `--asset-include-regex`; массовый экспорт без selector не включается.
- `--asset-node-id` repeatable и принимает URL-style ids с `-`.
- `--asset-format` repeatable: `svg|png` для nested assets; `--export-assets` по-прежнему поддерживает только `svg`.
- Пишет `<Name>.assets/*.{svg,png}` и `<Name>.<kind>.nested-assets.yaml`.
- Manifest содержит source, criteria, candidates, exports, warnings.
- Existing component-set variant asset lock fingerprints ограничены variant SVG slugs, чтобы nested sidecar files в той же папке не попадали в variant lock случайно.

### Acceptance criteria

- Можно экспортировать explicit nested `INSTANCE`/`VECTOR` по `--asset-node-id`.
- Можно экспортировать candidates по regex/type с `--asset-max`.
- Поддержаны SVG и PNG.
- Выводится deterministic manifest для LLM handoff.
- `--export-assets` component-set behavior не меняется.
- `npm run check` + `npm run build` проходят.

## P3 — Team inventory index

Статус: сделано.

Цель: дать LLM deterministic discovery layer по всей `FIGMA_TEAM_ID`, чтобы модель могла:

- найти component set / standalone component / screen по названию;
- открыть URL нужной ноды и передать его в `--export-contract`;
- по одному screen найти structurally similar alternatives для других device sizes;
- не сканировать Figma raw JSON вручную.

### CLI/API

Добавлена команда:

```bash
figma-inspect --export-team-index --output-dir tmp/figma-index
```

Опции:

- `--output-dir <dir>` — обязательный; команда не имеет дефолтной директории;
- `--screen-similarity-threshold <number>` — default `0.9`;
- `--screen-size-tolerance <px>` — default `2`.

### Output

```text
tmp/figma-index/team.index.yaml
tmp/figma-index/<Project>.<File>.<FileKey>.index.yaml
```

`team.index.yaml` — компактный router для модели:

- team id;
- только список Figma files с counts и path к per-file index.
- все YAML mapping keys в camelCase и сериализуются в стабильном порядке.

Каждый sibling `*.index.yaml` содержит только navigation index одного Figma file:

- file metadata: `{ key, name, lastModified, projectId, projectName }`;
- component sets: `{ id, name, lastModified, url }`;
- standalone components: `{ id, name, lastModified, url }`;
- screen-sized frames: `{ id, name, size, group, lastModified, url }`;
- screen groups: `{ id, screens }`, где `id` — `fileKey#<sorted node ids>` и `screens` — `{ id, name, size, lastModified, url }`.

Индекс не содержит props, component internals, screen internals, dependencies, fingerprints, layer paths, variant counts или token diagnostics. Это все появляется только в точечном `--export-contract`.

### Screen detection

Поддержанные размеры:

- `375x916`
- `375x854`
- `375x812`
- `375x667`
- `390x844`
- `428x926`
- `834x1194` (iPad Portrait)
- `1194x834` (iPad Landscape)

Правила:

- screen candidates — только `FRAME`;
- размер сравнивается с tolerance;
- если screen-sized frame вложен в другой screen, индексируется внешний screen, чтобы не плодить дубли;
- имена используются как labels, но не как source of truth.

### Similarity

- Algorithm: `screen-structure-v1`.
- Fingerprint строится из normalized structure tokens и instance/component identity.
- Score учитывает:
   - multiset similarity структурных tokens;
   - sequence similarity;
   - component instance token similarity;
   - node count similarity.
- Default threshold: `0.9`.

### Acceptance criteria

- `--export-team-index --output-dir tmp/figma-index` пишет `team.index.yaml` и по одному YAML на Figma file.
- Без `--output-dir` команда падает понятной ошибкой.
- Screen alternatives доступны без зависимости от названия screen.
- Nested screen-sized frames не создают дубли.
- Output deterministic, compact, YAML-only, camelCase и object-based; `team.index.yaml` не дублирует per-file entries.
- `npm run check` + `npm run build` проходят.

## P3.5 — Verified manifest and bulk registry

Цель: управлять 250+ импортированными контрактами после discovery/export слоя.

### Possible commands

```bash
figma-inspect --verify-component-contract --contract-dir artifacts/figma-components --json
figma-inspect --verify-node-contract --contract-dir artifacts/figma-components --json
figma-inspect --export-component-set-batch --manifest tools/design-import/components.yaml
figma-inspect --export-node-contract-batch --manifest tools/design-import/nodes.yaml
```

### Acceptance criteria

- Можно batch-verify все component-set/component/frame lock-файлы.
- Можно отфильтровать verified/unverified/changed contracts.
- Batch export читает явный repo-owned manifest, а не пытается импортировать всю Figma team автоматически.

## P4 — Consumer skill migration

Статус: не делать как CLI handoff artifact на текущем этапе.

Цель: перенести project-specific LLM guidance в consuming repo skill, а не плодить рядом с контрактами дополнительный prompt file.

### Decision

- Не генерировать `handoff.md`, `implementation-plan.md` или отдельный prompt рядом с каждым компонентом.
- CLI уже пишет реальные artifacts: DSL/YAML contracts, lock, preview, nested-assets manifest, import notes.
- Специфика ewa import flow должна жить в `../ewa-expo/.agents/skills/ds-figma-component-inspect/SKILL.md` и связанных consumer skills.
- Token-registry/global CSS diagnostics остаются repo adapter layer, не core CLI.

### Acceptance criteria

- Consumer skill описывает, как читать `team.index.yaml`, переходить в sibling `*.index.yaml`, выбирать URL и вызывать `--export-contract`.
- Consumer skill описывает, какие contract files давать модели для реализации.
- Core CLI не генерирует лишний model prompt файл.

## P8 — Hardening

### Security/secrets

- Добавить `.env.example`.
- Проверить, что `.env.local` никогда не попадает в package/artifacts.
- Если shell/wrapper не прокидывает `.env.local`, добавить non-secret CLI override для `--team-id`; пока `FIGMA_TEAM_ID` из env остается основным путем.
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
