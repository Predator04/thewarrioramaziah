let draft;

const $ = (selector) => document.querySelector(selector);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? {} : { "content-type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setMessage(selector, message) {
  $(selector).textContent = message || "";
}

function bindBasicFields() {
  document.querySelectorAll("[data-field]").forEach((input) => {
    const key = input.dataset.field;
    input.value = draft[key] || "";
    input.addEventListener("input", () => {
      draft[key] = input.value;
    });
  });
}

function field(label, value, onInput, type = "text") {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
  if (type !== "textarea") input.type = type;
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}

function imageField(label, value, onInput) {
  const wrapper = document.createElement("div");
  wrapper.className = "image-preview full";
  const textInput = field(label, value, onInput);
  const img = document.createElement("img");
  img.src = value || "";
  img.alt = "";
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp";
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    if (!selected) return;
    const form = new FormData();
    form.append("file", selected);
    const result = await api("/api/admin/upload", { method: "POST", body: form });
    onInput(result.src);
    textInput.querySelector("input").value = result.src;
    img.src = result.src;
  });
  wrapper.append(textInput, img, file);
  return wrapper;
}

function renderStatsEditor() {
  const root = $("[data-stats-editor]");
  root.innerHTML = "";
  draft.stats.forEach((stat) => {
    const row = document.createElement("div");
    row.className = "admin-repeat";
    row.append(
      field("Label", stat.label, (value) => (stat.label = value)),
      field("Value", stat.value, (value) => (stat.value = value))
    );
    root.append(row);
  });
}

function renderEventsEditor() {
  const root = $("[data-events-editor]");
  root.innerHTML = "";
  draft.events.forEach((event, index) => {
    const row = document.createElement("div");
    row.className = "admin-repeat";
    row.append(
      Object.assign(document.createElement("h3"), { textContent: `Event ${index + 1}` }),
      field("Title", event.title, (value) => (event.title = value)),
      field("Type", event.type, (value) => (event.type = value)),
      field("Date Text", event.date, (value) => (event.date = value)),
      field("Countdown Date", event.countdownDate, (value) => (event.countdownDate = value), "datetime-local"),
      field("Location", event.location, (value) => (event.location = value)),
      field("Link Label", event.linkLabel, (value) => (event.linkLabel = value)),
      field("URL", event.url, (value) => (event.url = value)),
      field("Note", event.note, (value) => (event.note = value), "textarea")
    );
    root.append(row);
  });
}

function renderProductsEditor() {
  const root = $("[data-products-editor]");
  root.innerHTML = "";
  draft.products.forEach((product, index) => {
    product.images ||= [];
    const row = document.createElement("div");
    row.className = "admin-repeat";
    row.append(
      Object.assign(document.createElement("h3"), { textContent: `Item ${index + 1}` }),
      field("Name", product.name, (value) => (product.name = value)),
      field("Status", product.status, (value) => (product.status = value)),
      field("Price", product.price, (value) => (product.price = value)),
      field("Colors", product.colors, (value) => (product.colors = value)),
      field("Sizes", product.sizes, (value) => (product.sizes = value)),
      field("Description", product.description, (value) => (product.description = value), "textarea"),
      imageField("Main Image URL or Upload", product.image, (value) => (product.image = value))
    );
    root.append(row);
  });
}

function renderMediaEditor() {
  const root = $("[data-media-editor]");
  root.innerHTML = "";
  draft.media.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "admin-repeat";
    row.append(
      Object.assign(document.createElement("h3"), { textContent: `Media ${index + 1}` }),
      field("Title", item.title, (value) => (item.title = value)),
      field("Type", item.type, (value) => (item.type = value)),
      imageField("Image URL or Upload", item.image, (value) => (item.image = value))
    );
    root.append(row);
  });
}

function renderEditors() {
  bindBasicFields();
  renderStatsEditor();
  renderEventsEditor();
  renderProductsEditor();
  renderMediaEditor();
}

async function loadDraft() {
  const saved = await api("/api/site-data");
  draft = saved || clone(siteData);
  renderEditors();
}

async function initAdmin() {
  const status = await api("/api/admin/status");
  if (status.authenticated) {
    $("[data-login]").hidden = true;
    $("[data-admin]").hidden = false;
    await loadDraft();
  }
}

$("[data-login-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("[data-login-message]", "Checking...");
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: new FormData(event.target).get("password") })
    });
    location.reload();
  } catch (error) {
    setMessage("[data-login-message]", error.message);
  }
});

$("[data-save]").addEventListener("click", async () => {
  setMessage("[data-save-message]", "Saving...");
  try {
    await api("/api/admin/save", { method: "POST", body: JSON.stringify(draft) });
    setMessage("[data-save-message]", "Saved. Public site updated.");
  } catch (error) {
    setMessage("[data-save-message]", error.message);
  }
});

$("[data-logout]").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  location.reload();
});

$("[data-add-event]").addEventListener("click", () => {
  draft.events.push({ title: "New Event", type: "Appearance", date: "Date TBA", countdownDate: "", location: "", note: "", linkLabel: "Details soon", url: "#" });
  renderEventsEditor();
});

$("[data-add-product]").addEventListener("click", () => {
  draft.products.push({ name: "New Item", status: "Preview", price: "TBA", description: "", colors: "", sizes: "", image: "", buyUrl: "#" });
  renderProductsEditor();
});

$("[data-add-media]").addEventListener("click", () => {
  draft.media.push({ title: "New Photo", type: "Media", image: "" });
  renderMediaEditor();
});

initAdmin().catch((error) => setMessage("[data-login-message]", error.message));
