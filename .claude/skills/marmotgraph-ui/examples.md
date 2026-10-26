# Examples

Short patches. Match the surrounding file's style when you apply them.

## A field on the detail card

View mode uses the existing label and value. A linked instance is a badge with the type color; a scalar stays text.

```tsx
<div className="mb-4">
  <div className="view-label">Weight</div>
  <div className="view-value">42 kg</div>
</div>
```

```tsx
<div className="mb-4">
  <div className="view-label">Animal</div>
  <div className="view-value">
    <span className="view-badge">
      <FontAwesomeIcon
        icon={faCircle}
        className="type-color-icon me-2"
        style={{ color: typeColor }}
      />
      Whistle
    </span>
  </div>
</div>
```

The type color is the only inline style. The badge, label, and value already exist. A new field does not get its own font size or a new pill color.

## A status

Reuse the release pair. Add a modifier next to the ones in `InstanceRelease.css` when the state is new, and keep an icon plus a word.

```css
.release-status--archived {
  background-color: #f1f3f5;
  color: #495057;
}
```

```tsx
<span className="release-status release-status--archived">
  <FontAwesomeIcon icon={faBoxArchive} /> archived
</span>
```

Neutral states use the gray pair. Green, amber, and orange stay reserved for released, changed, and incomplete. A colored dot with no word fails the status rule.

## A primary action

Page-level actions go through the subnav CTA. They are already `btn-dark` `btn-sm`.

```ts
{
  label: "Create new instance",
  href: "/editor/new",
  variant: "dark" as const,
  size: "sm" as const,
}
```

A second page-level dark button breaks the one-primary-action rule. Search is already the dark button inside `SearchBar`. Row tools stay quiet:

```tsx
<button type="button" className="edit-icon-btn" aria-label="Edit instance">
  <FontAwesomeIcon icon={faPencil} />
</button>
```

## Search and filters

Use `SearchBar` (dark button, the word "Search", Enter submits). Desktop filters use `Form.Check` and `InstanceFilterPanel`. Below 768px they collapse into one button that opens the existing dialog, with Clear and a dark Done. Active filters render as `FilterPill`s the user can remove.

## Review notes

Must fix. The new "owner" column renders the id in `#2563EB` at 1rem. Ids are meta: monospace 0.75rem `#6c757d`, ellipsis, plus the copy control used by `.instance-id-info`. Blue is for links that navigate.

Should fix. The empty links message is a blank column. Use `.links-empty-state` with one sentence, for example "No outgoing links".

Out of scope. Rounding the focus card to 16px and giving it a colored shadow. The focus card is 10px with the shadow in `reference.md`.
