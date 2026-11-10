// A synthetic knowledge graph served through a fetch mock - for looking at the visualizer without a backend.
const TYPES = [
  { name: "Dataset", color: "#4f6bed", n: 70 },
  { name: "Person", color: "#e8590c", n: 90 },
  { name: "Organization", color: "#0ea5a4", n: 14 },
  { name: "Model", color: "#9c36b5", n: 28 },
  { name: "Software", color: "#2f9e5c", n: 20 },
  { name: "Species", color: "#d6336c", n: 9 },
  { name: "Technique", color: "#c9a227", n: 16 },
  { name: "Brain region", color: "#1c7ed6", n: 24 },
];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const FIRST = ["Ada", "Bo", "Cleo", "Dmitri", "Elena", "Farid", "Greta", "Hugo", "Ines", "Jonas", "Kira", "Luca", "Mara", "Noor", "Omar", "Petra", "Quinn", "Rosa", "Sven", "Tara"];
const LAST = ["Ahn", "Berg", "Cruz", "Dahl", "Evans", "Fox", "Gomez", "Hart", "Ito", "Jensen", "Kaya", "Lund", "Moreau", "Novak", "Ortiz", "Park", "Reyes", "Sato", "Tran", "Voss"];
const TOPICS = ["hippocampal", "cortical", "cerebellar", "thalamic", "striatal", "spinal", "retinal", "olfactory", "visual", "motor"];
const KINDS = ["recordings", "atlas", "connectivity map", "simulation", "imaging series", "spike trains", "morphologies", "receptor densities"];

interface Inst { id: string; name: string; type: string; color: string; space: string; restricted: boolean; release: string }
const insts: Inst[] = [];
const byType = new Map<string, Inst[]>();
TYPES.forEach((t) => {
  byType.set(t.name, []);
  for (let i = 0; i < t.n; i++) {
    const name =
      t.name === "Person" ? `${pick(FIRST)} ${pick(LAST)}`
      : t.name === "Organization" ? `${pick(["University of", "Institute of", "Centre for"])} ${pick(LAST)}`
      : t.name === "Species" ? pick(["Mus musculus", "Rattus norvegicus", "Homo sapiens", "Macaca mulatta", "Callithrix jacchus", "Danio rerio", "Drosophila", "Felis catus", "Sus scrofa"]) + (i > 8 ? ` ${i}` : "")
      : t.name === "Technique" ? pick(["Patch clamp", "fMRI", "Two-photon", "Electron microscopy", "EEG", "Histology", "MEG", "Tractography"]) + ` ${i}`
      : t.name === "Brain region" ? `${pick(["Area", "Layer", "Nucleus", "Gyrus"])} ${pick(["V1", "CA1", "S1", "M1", "DG", "STN", "LGN"])}-${i}`
      : `${pick(TOPICS)} ${pick(KINDS)} ${i}`;
    const inst = { id: `${t.name.toLowerCase().replace(/\W/g, "")}-${String(i).padStart(3, "0")}-uuid`, name, type: t.name, color: t.color, space: pick(["collab-ebrains", "myspace", "dataset", "model"]), restricted: rnd() < 0.03, release: pick(["released", "released", "in progress", "has changed"]) };
    insts.push(inst);
    byType.get(t.name)!.push(inst);
  }
});
interface Edge { s: Inst; t: Inst; prop: string; label: string }
const edges: Edge[] = [];
const link = (from: string, to: string, prop: string, label: string, min: number, max: number, skew = false) =>
  byType.get(from)!.forEach((s) => {
    const n = min + Math.floor(rnd() * (max - min + 1));
    const pool = byType.get(to)!;
    for (let i = 0; i < n; i++) {
      // A few hubs attract most links
      const t = skew && rnd() < 0.6 ? pool[Math.floor(rnd() * rnd() * pool.length)] : pick(pool);
      if (t !== s && !edges.some((e) => e.s === s && e.t === t && e.prop === prop)) edges.push({ s, t, prop, label });
    }
  });
link("Dataset", "Person", "author", "Author", 2, 6, true);
link("Dataset", "Organization", "custodian", "Custodian", 1, 2, true);
link("Dataset", "Species", "studiedSpecies", "Studied species", 1, 2, true);
link("Dataset", "Technique", "technique", "Technique", 1, 3, true);
link("Dataset", "Brain region", "studyTarget", "Study target", 0, 3, true);
link("Model", "Person", "author", "Author", 1, 4, true);
link("Model", "Dataset", "usedDataset", "Used dataset", 0, 3);
link("Model", "Software", "software", "Software", 1, 2, true);
link("Software", "Person", "developer", "Developer", 1, 3, true);
link("Software", "Organization", "custodian", "Custodian", 0, 1, true);
link("Person", "Organization", "affiliation", "Affiliation", 1, 2, true);
link("Technique", "Brain region", "target", "Target", 0, 1);
const TYPE_ID = (n: string) => `https://openminds.om-i.org/types/${n.replace(/\W/g, "")}`;
const colorOf = (n: string) => TYPES.find((t) => t.name === n)!.color;
const linked = (i: Inst, label?: string) => ({
  instanceId: i.id, instanceName: i.name, type: i.type, typeColor: i.color, space: i.space, fieldLabel: label,
  hasDirectLinks: edges.some((e) => e.s === i), hasReverseLinks: edges.some((e) => e.t === i),
  ...(i.restricted ? { linkStatus: "restricted" } : {}),
});
const summary = (i: Inst, idx: number) => ({ id: idx, instanceId: i.id, type: i.type, typeColor: i.color, instanceName: i.name, space: i.space, permissions: "READ", favorite: false, contributed: false, releaseStatus: i.release });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const real = window.fetch.bind(window);
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.origin);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return real(input, init);
  if (path === "/api/types") return delay(json(TYPES.map((t) => ({ identifier: TYPE_ID(t.name), name: t.name, color: t.color }))));
  if (path === "/api/instances") {
    const term = (url.searchParams.get("search") ?? "").toLowerCase();
    const types = url.searchParams.getAll("type");
    let list = insts.filter((i) => (!term || i.name.toLowerCase().includes(term)) && (types.length === 0 || types.includes(TYPE_ID(i.type))));
    const total = list.length;
    list = list.slice(0, 20);
    return delay(json({ instances: list.map((i) => summary(i, insts.indexOf(i))), total }));
  }
  const incoming = path.match(/^\/api\/instances\/([^/]+)\/incomingLinks$/);
  if (incoming) {
    const target = insts.find((i) => i.id === decodeURIComponent(incoming[1]))!;
    const marker = url.searchParams.get("marker");
    const offset = marker ? Number(marker) : 0;
    const groups = new Map<string, Map<string, Edge[]>>();
    edges.filter((e) => e.t === target).forEach((e) => {
      const g = groups.get(e.prop) ?? new Map();
      g.set(e.s.type, [...(g.get(e.s.type) ?? []), e]);
      groups.set(e.prop, g);
    });
    return delay(json([...groups.entries()].map(([prop, types]) => ({
      property: `https://openminds.om-i.org/props/${prop}`,
      label: `Is ${prop} of`,
      types: [...types.entries()].map(([type, es]) => ({
        typeIdentifier: TYPE_ID(type), type, typeColor: colorOf(type),
        links: es.slice(offset, offset + 5).map((e) => ({ instanceId: e.s.id, instanceName: e.s.name, space: e.s.space, hasDirectLinks: true, hasReverseLinks: false })),
        total: es.length,
        nextMarker: offset + 5 < es.length ? String(offset + 5) : undefined,
      })),
    }))));
  }
  const one = path.match(/^\/api\/instances\/([^/]+)$/);
  if (one) {
    const i = insts.find((x) => x.id === decodeURIComponent(one[1]));
    if (!i) return new Response("{}", { status: 404 });
    return delay(json({
      instanceId: i.id, type: i.type, typeColor: i.color, instanceName: i.name, space: i.space, permissions: "READ", releaseStatus: i.release, contributed: rnd() < 0.2,
      fields: [
        { identifier: "name", label: "Name", kind: "TEXT", value: i.name, required: true, readOnly: false, labelProperty: true },
        { identifier: "desc", label: "Description", kind: "TEXTAREA", value: `A ${i.type.toLowerCase()} about ${i.name}, curated for the preview.`, required: false, readOnly: false },
        { identifier: "kw", label: "Keywords", kind: "TEXTS", value: ["neuroscience", i.type.toLowerCase()], required: false, readOnly: false },
        { identifier: "doi", label: "DOI", kind: "TEXT", value: `10.5281/${i.id.slice(0, 8)}`, required: false, readOnly: false },
        { identifier: "ver", label: "Version", kind: "TEXT", value: "v1.2", required: false, readOnly: false },
      ],
      directLinks: edges.filter((e) => e.s === i).map((e) => linked(e.t, e.label)),
    }));
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;
