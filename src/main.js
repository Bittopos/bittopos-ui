import { api } from "./api.js";
import { clone, validateWorkspace, flatten, makeInstance, removeInstance } from "./model.js";
import { render, toast } from "./ui.js";
const $ = id => document.getElementById(id);
const app = {
  resources: {}, workspace: { content: { instances: [] } }, revision: 0, selectedId: null, query: "", expanded: new Set(), busy: false,
  paint() { render(this); },
  openResource() { openResourceDialog(); },
  openInstance(parentId = app.selectedId) { openInstanceDialog(parentId); },
  editResource(id) { openResourceDialog(id); },
  async reload() {
    try {
      const data = await api.getState(), resources = {};
      for (const resource of data.resources) { if (!resource || typeof resource.id !== "string") throw new Error("La API devolvió un recurso sin id."); resources[resource.id] = resource; }
      validateWorkspace(data.workspace); this.resources = resources; this.workspace = data.workspace; this.revision = data.revision;
      if (this.selectedId && !flatten(this.workspace).some(row => row.instance.id === this.selectedId)) this.selectedId = null;
      this.paint();
    } catch (error) { $("connection-label").textContent = "API no disponible"; $("connection-detail").textContent = "Comprueba el servidor Rust"; toast("No se pudieron cargar los datos: " + error.message, "error"); }
  },
  async persistWorkspace(next) {
    this.busy = true; this.paint();
    try { const result = await api.saveWorkspace(next, this.revision); this.workspace = result.workspace; this.revision = result.revision; this.busy = false; this.paint(); return true; }
    catch (error) {
      this.busy = false; this.paint();
      if (error.status === 409) { toast("La estructura cambió en otra sesión. Se recargarán los datos; revisa antes de repetir la operación.", "error"); await this.reload(); }
      else toast("No se pudo guardar la estructura: " + error.message, "error");
      return false;
    }
  },
  async deleteInstance(id) {
    if (!confirm("¿Eliminar esta instancia y sus descendientes? La definición del recurso se conservará.")) return;
    const next = clone(this.workspace);
    try { removeInstance(next, id); if (await this.persistWorkspace(next)) { this.selectedId = null; this.paint(); toast("Instancia eliminada. La definición se conserva.", "success"); } }
    catch (error) { toast(error.message, "error"); }
  },
};
function openResourceDialog(id = null) {
  const resource = id ? app.resources[id] : null;
  if (id && !resource) return toast("No se encontró el recurso.", "error");
  $("resource-dialog-title").textContent = resource ? "Editar recurso" : "Nuevo recurso";
  $("resource-id").value = resource?.id || ""; $("resource-title").value = resource?.info?.title || "";
  $("resource-description").value = resource?.info?.description || "";
  $("resource-tags").value = Array.isArray(resource?.info?.tags) ? resource.info.tags.join(", ") : "";
  $("resource-dialog").showModal(); $("resource-title").focus();
}
function openInstanceDialog(parentId = null) {
  const resources = $("instance-resource"), parents = $("instance-parent"); resources.replaceChildren(); parents.replaceChildren(new Option("Raíz de la estructura", ""));
  for (const resource of Object.values(app.resources).sort((a, b) => (a.info?.title || "").localeCompare(b.info?.title || ""))) resources.add(new Option(resource.info?.title || resource.id, resource.id));
  for (const { instance } of flatten(app.workspace)) parents.add(new Option((app.resources[instance.source.id]?.info?.title || "Recurso") + " · " + instance.id.slice(0, 8), instance.id));
  if (!Object.keys(app.resources).length) { toast("Primero crea o importa una definición de recurso.", "error"); openResourceDialog(); return; }
  parents.value = parentId || ""; $("instance-dialog").showModal();
}
$("resource-form").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("resource-id").value || crypto.randomUUID(), existing = app.resources[id];
  const resource = { ...(existing || {}), id, info: { ...(existing?.info || {}), title: $("resource-title").value.trim(), description: $("resource-description").value.trim() || null, tags: $("resource-tags").value.split(",").map(value => value.trim()).filter(Boolean) } };
  if (!resource.info.title) return toast("El nombre del recurso es obligatorio.", "error");
  try { if (existing) await api.updateResource(id, resource); else await api.createResource(resource); $("resource-dialog").close(); await app.reload(); toast(existing ? "Definición actualizada." : "Recurso creado.", "success"); }
  catch (error) { toast("No se pudo guardar el recurso: " + error.message, "error"); }
});
$("instance-form").addEventListener("submit", async event => {
  event.preventDefault(); const next = clone(app.workspace), parentId = $("instance-parent").value || null;
  try { const instance = makeInstance($("instance-resource").value, parentId, next); if (await app.persistWorkspace(next)) { $("instance-dialog").close(); app.selectedId = instance.id; if (parentId) app.expanded.add(parentId); app.paint(); toast("Instancia guardada en SQLite.", "success"); } }
  catch (error) { toast(error.message, "error"); }
});
$("new-resource").addEventListener("click", () => openResourceDialog());
$("new-instance").addEventListener("click", () => openInstanceDialog(app.selectedId));
$("edit-selected").addEventListener("click", () => { const row = flatten(app.workspace).find(item => item.instance.id === app.selectedId); if (row) openResourceDialog(row.instance.source.id); });
$("refresh").addEventListener("click", () => app.reload());
$("clear-selection").addEventListener("click", () => { app.selectedId = null; app.paint(); });
$("collapse").addEventListener("click", () => { app.expanded.clear(); app.paint(); });
$("search").addEventListener("input", event => { app.query = event.target.value; app.paint(); });
$("about").addEventListener("click", () => $("about-dialog").showModal());
$("export-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ resources: Object.values(app.resources), workspace: app.workspace }, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "bittopos-export.json"; link.click(); URL.revokeObjectURL(url); toast("Exportación JSON preparada.", "success");
});
$("import-json").addEventListener("click", () => $("json-file").click());
$("json-file").addEventListener("change", async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const bundled = Array.isArray(payload.resources) && payload.workspace;
    const workspace = bundled ? payload.workspace : payload;
    if (!workspace?.content || !Array.isArray(workspace.content.instances)) throw new Error("Se esperaba un workspace con content.instances o un paquete {resources, workspace}.");
    if (bundled) {
      for (const resource of payload.resources) {
        try { await api.createResource(resource); }
        catch (error) { if (error.status === 409) await api.updateResource(resource.id, resource); else throw error; }
      }
    }
    const state = await api.getState(), result = await api.saveWorkspace(workspace, state.revision);
    app.revision = result.revision; await app.reload();
    toast(bundled ? "Paquete JSON importado a la base de datos." : "Workspace JSON importado; las definiciones TOML deben importarse por separado.", "success");
  } catch (error) { toast("No se pudo importar el JSON: " + error.message, "error"); }
  finally { event.target.value = ""; }
});
$("import-resource").addEventListener("click", () => $("toml-file").click());
$("toml-file").addEventListener("change", async event => {
  const files = Array.from(event.target.files || []); if (!files.length) return;
  let imported = 0; const errors = [];
  for (const file of files) {
    try { await api.importToml(await file.text()); imported++; }
    catch (error) { errors.push(file.name + ": " + error.message); }
  }
  await app.reload();
  if (imported) toast(imported + " recurso(s) TOML importado(s) a SQLite.", "success");
  if (errors.length) toast(errors.slice(0, 2).join(" · "), "error");
  event.target.value = "";
});
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
document.addEventListener("keydown", event => { if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) { event.preventDefault(); $("search").focus(); } });
async function initialize() {
  const dialog = $("login-dialog");
  const form = $("login-form");
  const errorLabel = $("login-error");
  async function prepareWorkspace() {
    let profiles = await api.listProfiles();
    if (!profiles.length) profiles = [await api.createProfile()];
    const profileId = profiles[0].id;
    let projects = await api.listProjects(profileId);
    if (!projects.length) projects = [await api.createProject(profileId, { name: "Mi primer proyecto", description: "Espacio de trabajo inicial" })];
    api.setProject(projects[0].id);
  }
  try {
    await api.me();
    await prepareWorkspace();
    await app.reload();
    return;
  } catch (_) {
    dialog.showModal();
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    errorLabel.textContent = "";
    try {
      await api.login($("login-username").value.trim(), $("login-password").value);
      await prepareWorkspace();
      dialog.close();
      await app.reload();
    } catch (error) {
      errorLabel.textContent = error.status === 401 ? "Usuario o contraseña incorrectos." : "No se pudo iniciar sesión: " + error.message;
    } finally {
      button.disabled = false;
    }
  });
}
initialize();
