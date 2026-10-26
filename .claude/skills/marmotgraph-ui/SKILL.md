---
name: marmotgraph-ui
description: >-
  Keeps the MarmotGraph UI on the Editor visual system and on core UX
  principles. Use when adding or changing screens, components, layout, or CSS
  in ui/, when reviewing an interface, or when the user mentions UI, UX,
  design, layout, styling, or CSS.
---

# MarmotGraph UI

This is a portable skill. Any coding agent that reads `SKILL.md` follows it when changing the MarmotGraph interface.

The reference screens are the instance list (`/editor`) and the instance detail with outgoing links (`/editor/instances/:instanceId`). Their CSS is the source of truth. Colors, type, radii, shadows, and the class to reuse are in [reference.md](reference.md). Worked patches are in [examples.md](examples.md).

If this skill and the Editor CSS disagree, follow the CSS and update the skill in the same change.

## Before you write UI

1. Name the nearest reference surface: list, detail, links, release, modal, or sidebar.
2. Read that surface's stylesheet. The map is in [reference.md](reference.md). Read the token tables there before choosing a color, radius, shadow, or control.
3. Reuse the existing component and classes. Add a class only when none fits, in the stylesheet that already owns that surface.
4. Put presentation in that stylesheet. Keep the component free of one-off color, radius, and shadow.
5. Use the type color the instance or type already carries. Fall back to `#6c757d`.
6. Build controls with React-Bootstrap (`Button`, `Form`, `Table`, `Modal`). Match the icon set already on that surface: Lucide in the sidebar, Font Awesome on editor search and the instance toolbar.

Leave `ui/src/styles/theme.css` alone. Editor screens paint their own light surfaces. Those variables are an older theme layer.

## Visual rules

- **Shell.** Page background `#eee`, typeface Inter, white canvas with 20px radius (`layout-content`). The sidebar sits outside the canvas. The footer stays right-aligned: "Powered by MarmotGraph, 2024 - Present".
- **One title.** The list title is the `h2` ("Instances"). On a detail page the instance name is the title (1.85rem, weight 600, `#212529`). The page action is the subnav CTA: `variant: "dark"`, `size: "sm"`, top right. A view has one title of that size and one dark page action. Search keeps its own dark button inside `SearchBar`. A dialog confirm ("Done") may be dark. Every other action stays quiet.
- **Kickers.** Group labels are 0.7–0.8rem, weight 600, uppercase, letter-spacing 0.4–0.5px, `#6c757d` or `#868e96`.
- **Instance identity.** Every place an instance appears shows the same facts, in this order: type color dot, type name, instance name, monospace id, space. The id is 0.75rem, `#6c757d`, one line, ellipsis, with a copy control.
- **Cards.** White, 1px `#dee2e6` (link cards `#e4e7eb`). Radius 10px on a primary card, 8px on a nested card. The open instance uses a 3px top border in the type color and the focus-card shadow. A linked instance uses a 3px side border in the type color.
- **Scarce color.** Type, status, links (`#2563EB`), and the black primary button carry meaning. Chrome stays gray. Row hover is `#e8e9f3`, selected is `#eef0fb`, both with a `#5b5fc7` left bar.
- **Status pairs.** Released: check, `#1e7a42` on `#e8f6ee`. Changed or unsaved: amber text on `#fff4e5` or `#fff8e6`, border `#ffe08a`. Incomplete validation: `#c27c0e`. Bars use track `#e9ecef`, a fill in the status color, and a tabular percent.
- **Quiet actions.** Secondary tools are transparent icon buttons, `#6c757d`, hover `#f1f3f5` or `#e9ecef`. The active tool uses `edit-icon-btn--active`.
- **Focus.** Keep a visible ring. Fields and link cards use `#6c8ebf`. List selection and preview controls use `#5b5fc7`. Links use `#2563EB`, hover `#1D4ED8`.

## UX rules

1. **Place.** The current sidebar item uses `sidebar-nav-link` and `active`. A detail page shows breadcrumbs: blue parent, gray separator, type dot, gray current label.
2. **Status.** Unsaved work is visible on the instance and in the unsaved rail. Release, changed, and validation progress are visible on the row and the record. A list shows its result count.
3. **One primary action.** Its label is a verb plus a noun ("Create new instance", "Search"). Search stays a labeled dark button on `SearchBar`, and Enter submits.
4. **Recognition.** Desktop filters stay on the page (`Form.Check`, `InstanceFilterPanel`) and show the current count. Active filters become removable `FilterPill`s. Sort direction is visible on the column. A collapsed group still shows its count.
5. **Relationships.** A link field and its targets line up. Draw the connector. The active edge uses the type color. Restricted or missing targets use the dashed muted treatment in the links panel.
6. **Disclosure.** Unsupported fields, link groups, and the unsaved rail collapse in place. The summary stays visible.
7. **Every state.** Hover, selected, focus-visible, disabled, loading, empty, and error each have a treatment. Empty is a short centered sentence. Loading does not shift the layout. Copy uses the existing tooltip.
8. **Recovery.** A destructive action confirms first and applies only to the current selection. The bulk bar (`bulk-actions-bar`) appears only while something is selected.
9. **Access.** Icon-only buttons have an accessible name. Toolbar targets are at least 32px. Meaning never depends on color alone. Honor `prefers-reduced-motion`. Names wrap with `overflow-wrap: anywhere`. Table headers stay on one line.
10. **Small screens.** Below 768px (`MOBILE_VIEWPORT_QUERY`), filters collapse into one button that opens a dialog with Clear and Done, the sidebar starts collapsed, and a side preview yields the width to the main content.
11. **Menus.** New popovers match the breadcrumb menu: white, 1px `#E2E8F0`, radius 8px, shadow `0 8px 24px rgba(15, 23, 42, 0.12)`.

Sentence case for actions and names. Uppercase is for kickers only.

## After the change

Complete this checklist before you finish:

```
- [ ] Nearest reference stylesheet was read and its classes reused
- [ ] New rules live in that stylesheet and use tokens from reference.md
- [ ] Title, instance identity, and status pairs match the reference screens
- [ ] Hover, selected, focus-visible, empty, and loading are covered
- [ ] The dark page action is the labeled subnav CTA; search uses SearchBar; other actions stay quiet
- [ ] Each new control has an accessible name and a focus ring
- [ ] A column or shell change still works below 768px
- [ ] The changed flow was exercised in the browser
```

Open the app and use the change the way a person would: the new control, a second screen that shares the component, and the empty or error path. Check a phone-width viewport when layout changed. A single screenshot does not finish the task.

## Reviewing UI

Lead with the finding.

- **Must fix** — breaks a visual rule or a UX rule on a reference screen.
- **Should fix** — a missing state, uneven spacing, or a one-off style that already has a class.

For each item, name the place, the rule, and the class or token to use. A suggestion that adds a new palette, a new radius, or a second primary button is out of scope.
