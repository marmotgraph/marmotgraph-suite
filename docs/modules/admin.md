# Admin

The admin module shows the sections you have the global permissions for - it is hidden if there are none.

## Permissions

Manage who has access to which spaces and functionality. Requires the permission to create permissions.

## Tenants

Define the tenants of the core together with their branding - colors, font and custom stylesheet. Requires the
permission to manage tenants.

## Tools

Register the tools built on top of the knowledge graph - e.g. a search or a dashboard which runs on its own. Tools are
grouped in categories, and each category gets an entry with its icon in the "Tools built on KG" section of the
navigation. The entry opens an overview of the tools of the category, from where each tool opens in a new tab.

- A **category** has a name and an optional icon: a self-contained SVG (no scripts, event handlers or links to anything
  outside the icon). A category can only be deleted once it has no tools anymore.
- A **tool** has a name, an optional description, its category and the URL it runs at (`http` or `https`). It is
  listed either to every authenticated user or to the users matching a claim pattern - e.g.
  `{"groups": ["^/curators$"]}`, whose leaves are regular expressions matched against the user information of the
  identity provider.

Users only see the categories with at least one tool listed to them. Administrators see all tools. Requires the
permission to define tools.
