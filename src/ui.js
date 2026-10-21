import { flatten, instanceMatches, resourceTitle } from "./model.js";
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
export function toast(message, kind = "") { const node = el("div", "toast " + kind, message); $("toasts").append(node); setTimeout(() => node.remove(), 4200); }
const button = (text, cls, action) => { const node = el("button", cls, text); node.type = "button"; node.addEventListener("click", action); return node; };
export function render(app) {
  const rows = flatten(app.workspace), selected = app.selectedId ? rows.find(row => row.instance.id === app.selectedId) : null;
  $("connection-label").textContent = app.busy ? "Guardando cambios…" : "API conectada";
  $("connection-detail").textContent = "SQLite · revisión " + app.revision;
  $("revision").textContent = "REV " + String(app.revision).padStart(4, "0");
  $("resource-count").textContent = Object.keys(app.resources).length; $("instance-count").textContent = rows.length;
  $("depth-count").textContent = selected ? selected.depth : "Raíz";
  $("result-count").textContent = rows.length + (rows.length === 1 ? " elemento" : " elementos");
  $("heading").textContent = selected ? resourceTitle(app.resources, selected.instance) : "Workspace";
  $("subtitle").textContent = selected ? "Instancia seleccionada · la definición de origen permanece separada." : "Las definiciones se mantienen separadas de las instancias que las utilizan.";
  $("breadcrumbs").replaceChildren(el("span", "", "Workspace"), el("b", "", "/"), el("strong", "", selected ? resourceTitle(app.resources, selected.instance) : "Raíz"));
  $("edit-selected").disabled = !selected || !app.resources[selected.instance.source.id];
  renderTree(app); renderStructure(app, rows); renderDetails(app, selected);
}
function renderTree(app) {
  const target = $("tree"); target.replaceChildren(); const query = app.query.trim().toLocaleLowerCase();
  const hasMatch = instance => instanceMatches(app.resources, instance, query) || (instance.content?.instances || []).some(hasMatch);
  function add(instance, depth) {
    if (query && !hasMatch(instance)) return;
    const kids = instance.content?.instances || [], selected = instance.id === app.selectedId;
    const row = el("button", "tree-row" + (selected ? " selected" : "")); row.type = "button"; row.style.paddingLeft = (9 + depth * 15) + "px";
    row.append(el("span", "tree-arrow", kids.length ? (app.expanded.has(instance.id) || query ? "⌄" : "›") : "·"), el("span", "tree-glyph", "◇"), el("span", "tree-name", resourceTitle(app.resources, instance)));
    if (kids.length) row.append(el("span", "tree-count", String(kids.length)));
    row.setAttribute("aria-current", String(selected));
    row.addEventListener("click", () => { app.selectedId = instance.id; if (kids.length && !app.expanded.has(instance.id)) app.expanded.add(instance.id); else if (kids.length) app.expanded.delete(instance.id); app.paint(); });
    target.append(row); if (kids.length && (app.expanded.has(instance.id) || query)) kids.forEach(child => add(child, depth + 1));
  }
  app.workspace.content.instances.forEach(instance => add(instance, 0));
  if (!target.children.length) target.append(el("p", "tree-empty", query ? "No hay coincidencias." : "La estructura está vacía."));
}
function renderStructure(app, rows) {
  const target = $("structure"); target.replaceChildren();
  if (!rows.length) {
    const empty = el("div", "empty-state"); empty.append(el("div", "empty-symbol", "◇"), el("h3", "", "Empieza con una instancia"), el("p", "", "Crea una definición reutilizable y colócala en la estructura. La API guardará los cambios en SQLite."));
    empty.append(button("＋ Nuevo recurso", "button primary", app.openResource), button("↳ Añadir instancia", "button secondary", app.openInstance)); target.append(empty); return;
  }
  const list = el("div", "instance-list"), query = app.query.trim().toLocaleLowerCase();
  const matches = rows.filter(row => !query || instanceMatches(app.resources, row.instance, query));
  for (const row of matches) {
    const instance = row.instance, card = el("button", "instance-card" + (instance.id === app.selectedId ? " selected" : "")); card.type = "button";
    card.style.setProperty("--depth", Math.min(row.depth, 8));
    card.append(el("span", "instance-glyph", "◇"));
    const main = el("span", "instance-main"); main.append(el("strong", "instance-title", resourceTitle(app.resources, instance)), el("small", "instance-meta", "Instancia · " + instance.id.slice(0, 8) + " · recurso " + instance.source.id.slice(0, 8)));
    card.append(main, el("span", "instance-depth", "L" + row.depth), el("span", "instance-chevron", "›"));
    card.addEventListener("click", () => { app.selectedId = instance.id; app.paint(); }); list.append(card);
  }
  if (!matches.length) list.append(el("p", "tree-empty", "No hay coincidencias en las instancias."));
  target.append(list);
}
const detailLine = (label, value, code = false) => { const row = el("div", "detail-line"); row.append(el("span", "", label), el("strong", code ? "code" : "", value)); return row; };
function renderDetails(app, selected) {
  const target = $("details"); target.replaceChildren();
  if (!selected) { const empty = el("div", "empty-inspector"); empty.append(el("div", "empty-symbol", "◇"), el("h3", "", "Selecciona una instancia"), el("p", "", "Consulta la identidad, el recurso de origen y su ubicación dentro de la estructura.")); target.append(empty); return; }
  const instance = selected.instance, resource = app.resources[instance.source.id];
  target.append(el("div", "detail-symbol", "◇"), el("span", "type-chip", "INSTANCIA"), el("h3", "detail-title", resourceTitle(app.resources, instance)));
  if (resource?.info?.description) target.append(el("p", "detail-description", resource.info.description));
  const identity = el("section", "detail-section"); identity.append(el("h4", "", "IDENTIDAD"), detailLine("ID instancia", instance.id, true), detailLine("ID recurso", instance.source.id, true), detailLine("Profundidad", String(selected.depth)));
  if (selected.parentId) identity.append(detailLine("Contenedora", selected.parentId, true)); target.append(identity);
  if (resource) {
    const section = el("section", "detail-section"); section.append(el("h4", "", "DEFINICIÓN"), detailLine("Nombre", resource.info.title));
    if (resource.info.description) section.append(detailLine("Descripción", resource.info.description));
    const tags = el("div", "tags"); (Array.isArray(resource.info.tags) ? resource.info.tags : []).forEach(tag => tags.append(el("span", "tag", tag))); if (tags.children.length) section.append(tags); target.append(section);
  } else target.append(el("p", "warning", "No se ha importado la definición TOML de este recurso."));
  const actions = el("div", "detail-actions");
  actions.append(button("＋ Añadir hija", "button secondary wide", () => app.openInstance(instance.id)));
  if (resource) actions.append(button("✎ Editar definición", "button secondary wide", () => app.editResource(instance.source.id)));
  actions.append(button("× Eliminar instancia", "button danger wide", () => app.deleteInstance(instance.id))); target.append(actions);
}