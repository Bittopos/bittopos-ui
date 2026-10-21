export const clone = value => structuredClone(value);
export function validateWorkspace(workspace) {
  if (!workspace || typeof workspace !== "object" || !workspace.content || !Array.isArray(workspace.content.instances)) throw new Error("La estructura debe contener content.instances.");
  const seen = new Set();
  function visit(instances) { for (const item of instances) {
    if (!item || typeof item.id !== "string" || !item.id || !item.source || typeof item.source.id !== "string") throw new Error("Cada instancia debe conservar id y source.id.");
    if (seen.has(item.id)) throw new Error("ID de instancia duplicado: " + item.id);
    seen.add(item.id);
    if (item.content !== undefined) { if (!item.content || !Array.isArray(item.content.instances)) throw new Error("content.instances inválido en " + item.id); visit(item.content.instances); }
  } }
  visit(workspace.content.instances); return workspace;
}
export function flatten(workspace) {
  const result = [];
  function visit(instances, depth = 0, parentId = null) { for (const instance of instances) { result.push({ instance, depth, parentId }); visit(instance.content?.instances || [], depth + 1, instance.id); } }
  visit(workspace.content.instances); return result;
}
export const findInstance = (workspace, id) => flatten(workspace).find(row => row.instance.id === id) || null;
export function makeInstance(resourceId, parentId, workspace) {
  const instance = { id: crypto.randomUUID(), source: { id: resourceId } };
  if (!parentId) workspace.content.instances.push(instance);
  else {
    const parent = findInstance(workspace, parentId)?.instance;
    if (!parent) throw new Error("No se encontró la instancia contenedora.");
    parent.content ||= {}; parent.content.instances ||= []; parent.content.instances.push(instance);
    parent.semantic ||= {};
    if (parent.semantic.allocation === undefined) parent.semantic.allocation = [];
    if (!Array.isArray(parent.semantic.allocation)) throw new Error("semantic.allocation debe ser una lista; no se modificó la estructura.");
    parent.semantic.allocation.push(instance.id);
  }
  return instance;
}
export function removeInstance(workspace, id) {
  const row = findInstance(workspace, id); if (!row) throw new Error("La instancia ya no existe.");
  const siblings = row.parentId ? findInstance(workspace, row.parentId)?.instance.content?.instances : workspace.content.instances;
  const index = siblings?.findIndex(item => item.id === id) ?? -1;
  if (index < 0) throw new Error("No se pudo localizar la instancia en su contenedor.");
  const [removed] = siblings.splice(index, 1);
  if (row.parentId) {
    const parent = findInstance(workspace, row.parentId)?.instance;
    if (parent?.semantic?.allocation) parent.semantic.allocation = parent.semantic.allocation.filter(childId => childId !== id);
    if (parent?.content?.instances?.length === 0) {
      delete parent.content.instances;
      if (Object.keys(parent.content).length === 0) delete parent.content;
    }
    if (parent?.semantic?.allocation?.length === 0) {
      delete parent.semantic.allocation;
      if (Object.keys(parent.semantic).length === 0) delete parent.semantic;
    }
  }
  return removed;
}
export const resourceTitle = (resources, instance) => resources[instance.source.id]?.info?.title || "Recurso no importado";
export function instanceMatches(resources, instance, query) {
  const resource = resources[instance.source.id];
  return [resource?.info?.title, resource?.info?.description, ...(Array.isArray(resource?.info?.tags) ? resource.info.tags : []), instance.id, instance.source.id]
    .filter(Boolean).join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase());
}