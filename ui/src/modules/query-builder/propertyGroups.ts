import type { QueryProperty } from "../../services/queries";
import { propertyLabel, simpleName, TypesById } from "./queryModel";

/** Properties of the core itself - only offered on request */
const ADVANCED_PROPERTY_PREFIX = "https://core.kg.ebrains.eu/vocab/meta";

export interface PropertyGroup {
  /** The type the properties are specific to */
  type: string;
  properties: QueryProperty[];
}

/** The properties which can be added to a field - the ones shared by all its types first, then the specific ones. */
export interface AvailableProperties {
  commonAttributes: QueryProperty[];
  commonLinks: QueryProperty[];
  attributesByType: PropertyGroup[];
  linksByType: PropertyGroup[];
  count: number;
}

function propertyKey(property: QueryProperty): string {
  return `${property.identifier}${property.reverse ? " reverse" : ""}`;
}

function matches(property: QueryProperty, filter: string): boolean {
  return (
    !filter ||
    propertyLabel(property).toLowerCase().includes(filter) ||
    property.identifier.toLowerCase().includes(filter) ||
    property.targetTypes.some((type) => simpleName(type).toLowerCase().includes(filter))
  );
}

const byLabel = (a: QueryProperty, b: QueryProperty) => propertyLabel(a).localeCompare(propertyLabel(b));

/**
 * Groups the properties of the given types. A property is "common" if several of the types have it (with the target
 * types of all of them) - or if there is only a single type.
 */
export function availableProperties(
  types: TypesById,
  lookups: string[],
  filterText: string,
  includeAdvanced: boolean,
): AvailableProperties {
  const filter = filterText.trim().toLowerCase();
  const groups: PropertyGroup[] = lookups.flatMap((typeId) => {
    const type = types.get(typeId);
    if (!type) {
      return [];
    }
    const properties = type.properties.filter(
      (p) => (includeAdvanced || !p.identifier.startsWith(ADVANCED_PROPERTY_PREFIX)) && matches(p, filter),
    );
    return properties.length ? [{ type: typeId, properties }] : [];
  });

  const counters = new Map<string, { property: QueryProperty; count: number }>();
  groups.forEach((group) =>
    group.properties.forEach((property) => {
      const key = propertyKey(property);
      const counter = counters.get(key);
      if (counter) {
        const targets = new Set([...counter.property.targetTypes, ...property.targetTypes]);
        counter.property = {
          ...counter.property,
          label: counter.property.label ?? property.label,
          targetTypes: Array.from(targets).sort(),
        };
        counter.count += 1;
      } else {
        counters.set(key, { property: { ...property, targetTypes: [...property.targetTypes].sort() }, count: 1 });
      }
    }),
  );
  const common = Array.from(counters.values())
    .filter(({ count }) => count > 1 || groups.length === 1)
    .map(({ property }) => property)
    .sort(byLabel);
  const commonKeys = new Set(common.map(propertyKey));

  const specific = (links: boolean) =>
    groups
      .map((group) => ({
        type: group.type,
        properties: group.properties
          .filter((p) => p.targetTypes.length > 0 === links && !commonKeys.has(propertyKey(p)))
          .sort(byLabel),
      }))
      .filter((group) => group.properties.length);

  const attributesByType = specific(false);
  const linksByType = specific(true);
  const commonAttributes = common.filter((p) => p.targetTypes.length === 0);
  const commonLinks = common.filter((p) => p.targetTypes.length > 0);
  const count =
    common.length + [...attributesByType, ...linksByType].reduce((sum, group) => sum + group.properties.length, 0);
  return { commonAttributes, commonLinks, attributesByType, linksByType, count };
}
