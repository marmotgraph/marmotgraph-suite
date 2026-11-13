# Spaces

The spaces are an entry of the "Admin" section of the navigation, available to everyone who manages at least one space
(or may create spaces) - it lists the spaces you are allowed to manage. Each space brings together everything that is configured for it:

## Settings

Whether the instances of the space are released automatically when they change. A space without a specification has the default settings - saving them specifies it.
Deleting the specification removes a space without types. Otherwise, it stays with the default settings.

With the global permission to manage spaces, you can add new spaces.

## Types

The types assigned to the space are offered when instances are created in it. Each type is listed with the number of
its instances in the space, and can be assigned or removed with its switch.

## Permissions

The claims mapped to the roles in the space - only shown with the global permission to manage permissions. A user
matching the claims of a role is granted the role in the space. They are shown read only - the claims are managed in the
[permissions](admin.md#permissions) of the admin section.
