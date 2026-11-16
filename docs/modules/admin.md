# Admin

Each section of the admin module is an entry of the "Admin" section of the navigation - you only see the sections you
have the global permissions for. The [spaces](spaces.md) are part of the section too.

## Permissions

The overview of all claims mapped to the roles of the core - the global ones and those of every space. Claims can be
added to any space (also to one which doesn't exist yet) and removed one by one. Requires the permission to create or
to delete permissions.

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

## Import/export

Export the settings of the admin sections into a single JSON file - and import such a file again, e.g. to restore the
tools and permissions after the database has been wiped or to transfer them to another deployment. The file contains:

- **Spaces** - the settings of every space you manage which has a specification (auto release, client space, defer
  cache). The types assigned to a space are not part of the export.
- **Permissions** - the claims of every role, global and per space.
- **Tenants** - every tenant except the default one, with its definition, theme (font, colors, custom stylesheet) and
  images (logos, backgrounds and favicon).
- **Tools** - the categories with their icons and the tools with their claims. Tools refer to their category by name.

You can choose which sections to export and, after selecting a file, which of the sections it contains to import. Only
the sections you have the permissions for are offered. An import never removes anything: spaces, tenants, categories
and tools with the same name are updated, everything else is created, and claims are added to the ones a role already
has. The outcome is reported for each setting - a setting which can't be imported doesn't stop the import of the
others.

The file holds no identifiers of the core, so it can be imported into an empty database. It does contain the claims of
your permissions - keep it as confidential as the setup itself.
