You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Forms in THIS project use native `[value]` + `(input)` bound to the signal store — not Signal Forms, not Reactive Forms, not `ngModel`. See "Project-specific decisions" below before writing any form code
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Project-specific decisions (this repo, not generic Angular advice)

These are the decisions implemented in this codebase. `docs/superpowers/specs/2026-09-12-xirr-calculator-design.md` is the binding design authority; this section records the parts a contributor will trip over first.

- **Dependency direction is one-way: `ui → state → core`.** `src/app/core/**` must never import `@angular/*` — the XIRR maths is plain TypeScript so it can be tested without a TestBed. `core` does not know `state` exists; `state` does not know `ui` exists.
- **No form library.** Inputs bind natively with `[value]` + `(input)` straight to store methods. No Reactive Forms, no Signal Forms, no `ngModel`. Validation lives in `core/` and state lives in the store; a second form model would duplicate both and then drift out of sync.
- **Amount fields keep the user's raw text in the model** (`amountText` on `PositionInput` / `CashFlowRow`), and the templates bind to that. `amount: number | null` stays the parsed value that validation, metrics and the solver consume. Binding the parsed value directly would overwrite mid-edit input: on `<input type="number">`, typing `-` over an existing number reports `''`, and writing the old parsed value back erases the minus sign.
- **State is one signal store**, `src/app/state/calculator-store.ts`. No NgRx — action/reducer/effect layers are pure boilerplate at this size. Components inject the store directly instead of relaying through `input()`/`output()`.
- **Results are produced only when 計算報酬率 is pressed**, never via `computed()` live recalculation.
- **`@angular/cdk` is for `drag-drop` only. Do not add Angular Material.** Styling is hand-written CSS.
- **Angular is pinned to exactly 22.1.6** (no `^`), as is `@angular/cdk`. Do not add dependencies.
- **UI copy is Traditional Chinese**, and `src/index.html` is `lang="zh-Hant"`.
- **Dates are `'YYYY-MM-DD'` strings end to end.** Never `Date` objects — `new Date('2024-01-01')` is UTC midnight and shifts a day in UTC+8.
