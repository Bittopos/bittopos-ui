const BASE = "/api/v1";
let activeProjectId = null;

async function request(path, options = {}) {
  const response = await fetch(BASE + path, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = response.status === 204 ? null : isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const projectPath = () => {
  if (!activeProjectId) throw new Error("No hay un proyecto activo.");
  return "/projects/" + encodeURIComponent(activeProjectId);
};

export const api = {
  health: () => request("/health"),
  login: (username, password) => request("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/logout", { method: "POST" }),
  me: () => request("/me"),
  listProfiles: async () => (await request("/profiles")).items,
  createProfile: () => request("/profiles", { method: "POST" }),
  listProjects: async profileId => (await request("/profiles/" + encodeURIComponent(profileId) + "/projects")).items,
  createProject: (profileId, project) => request("/profiles/" + encodeURIComponent(profileId) + "/projects", { method: "POST", body: JSON.stringify(project) }),
  setProject: projectId => { activeProjectId = projectId; },
  getState: async () => {
    const base = projectPath();
    const [resources, data] = await Promise.all([
      request(base + "/resources"),
      request(base + "/workspace"),
    ]);
    return { resources: resources.items, workspace: data.workspace, revision: data.revision };
  },
  createResource: resource => request(projectPath() + "/resources", { method: "POST", body: JSON.stringify(resource) }),
  updateResource: (id, resource) => request(projectPath() + "/resources/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(resource) }),
  importToml: content => request(projectPath() + "/resources/import-toml", { method: "POST", body: JSON.stringify({ content }) }),
  saveWorkspace: (workspace, expectedRevision) => request(projectPath() + "/workspace", { method: "PUT", body: JSON.stringify({ workspace, expected_revision: expectedRevision }) }),
};
