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

const helpText = {
  statLabel: "What this stat is called, like Record, Weight Class, Stance, or Fighting Out Of.",
  statValue: "The actual value visitors see for this stat. Use TBA if you do not know yet.",
  socialLabel: "The name visitors see, like Instagram, TikTok, YouTube, or Facebook.",
  socialUrl: "Paste the full profile link. Leave # to hide it from the public site.",
  eventTitle: "The public event name, like Columbia Appearance or Fight Night.",
  eventType: "What kind of event this is, such as Fight, Appearance, Weigh-in, Pop-up, or Signing.",
  eventDate: "Simple date text visitors see. Example: Date TBA or June 14, 2026.",
  countdownDate: "Optional exact date/time for the countdown. Leave blank until the event date is confirmed.",
  eventLocation: "City, venue, gym, or event location.",
  eventLinkLabel: "Text on the event link. Example: Tickets, Details Soon, RSVP, or Watch Live.",
  eventUrl: "Where the event link goes. Use # if there is no link yet.",
  eventNote: "Short extra detail shown under the event title.",
  itemName: "Name of this fight kit item or future merch item.",
  itemStatus: "Small label above the item name. Example: Fight Kit, Preview, Coming Later.",
  itemPrice: "Use Not for sale for fight kit, or add a price when fan merch is ready.",
  itemColors: "Colors shown on the card.",
  itemSizes: "Sizes or status. For fight kit, Team gear works well.",
  itemDescription: "Short description visitors read under the item name.",
  itemImage: "Main card image. Upload a photo or paste an image URL.",
  itemBackImage: "Back view used by the Back toggle. Upload the back of the jacket/shorts here.",
  itemFrontImage: "Front view used by the Front toggle. Upload the front of the jacket/shorts here.",
  mediaTitle: "Name shown under the media image.",
  mediaType: "Small label above the media title. Example: Training, Fight Kit, Fight Week.",
  mediaImage: "Gallery image. Upload a photo or paste an image URL."
};

function field(label, value, onInput, type = "text", help = "") {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  if (help) wrapper.dataset.help = help;
  const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
  if (type !== "textarea") input.type = type;
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}

function imageField(label, value, onInput, help = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "image-preview full";
  const textInput = field(label, value, onInput, "text", help);
  const img = document.createElement("img");
  img.src = value || "";
  img.alt = "";
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp";
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    if (!selected) return;
    if (selected.size > 1500000) {
      alert("That image is too large. Please use an image under 1.5 MB.");
      file.value = "";
      return;
    }
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
      field("Stat Name", stat.label, (value) => (stat.label = value), "text", helpText.statLabel),
      field("Stat Value", stat.value, (value) => (stat.value = value), "text", helpText.statValue)
    );
    root.append(row);
  });
}

function renderSocialsEditor() {
  const root = $("[data-socials-editor]");
  root.innerHTML = "";
  draft.socials ||= [];
  draft.socials.forEach((social, index) => {
    const row = document.createElement("div");
    row.className = "admin-repeat";
    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button full";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete This Social Link";
    deleteButton.addEventListener("click", () => {
      if (!confirm(`Delete social link "${social.label}"?`)) return;
      draft.socials.splice(index, 1);
      renderSocialsEditor();
    });
    row.append(
      field("Social Platform Name", social.label, (value) => (social.label = value), "text", helpText.socialLabel),
      field("Social Profile URL", social.url, (value) => (social.url = value), "text", helpText.socialUrl),
      deleteButton
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
    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button full";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete This Event";
    deleteButton.addEventListener("click", () => {
      if (!confirm(`Delete event "${event.title}"?`)) return;
      draft.events.splice(index, 1);
      renderEventsEditor();
    });
    row.append(
      Object.assign(document.createElement("h3"), { textContent: `Event ${index + 1}` }),
      field("Event Name", event.title, (value) => (event.title = value), "text", helpText.eventTitle),
      field("Event Type", event.type, (value) => (event.type = value), "text", helpText.eventType),
      field("Displayed Date", event.date, (value) => (event.date = value), "text", helpText.eventDate),
      field("Countdown Date and Time", event.countdownDate, (value) => (event.countdownDate = value), "datetime-local", helpText.countdownDate),
      field("Location", event.location, (value) => (event.location = value), "text", helpText.eventLocation),
      field("Link Button Text", event.linkLabel, (value) => (event.linkLabel = value), "text", helpText.eventLinkLabel),
      field("Link URL", event.url, (value) => (event.url = value), "text", helpText.eventUrl),
      field("Event Note", event.note, (value) => (event.note = value), "textarea", helpText.eventNote),
      deleteButton
    );
    root.append(row);
  });
}

function renderProductsEditor() {
  const root = $("[data-products-editor]");
  root.innerHTML = "";
  draft.products.forEach((product, index) => {
    product.images ||= [];
    const backImage = product.images.find((image) => image.label === "Back") || product.images[0] || { label: "Back", src: product.image || "" };
    const frontImage = product.images.find((image) => image.label === "Front") || product.images[1] || { label: "Front", src: "" };
    product.images = [backImage, frontImage].filter((image) => image.src !== undefined);
    const row = document.createElement("div");
    row.className = "admin-repeat";
    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button full";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete This Fight Kit Item";
    deleteButton.addEventListener("click", () => {
      if (!confirm(`Delete item "${product.name}"?`)) return;
      draft.products.splice(index, 1);
      renderProductsEditor();
    });
    row.append(
      Object.assign(document.createElement("h3"), { textContent: `Item ${index + 1}` }),
      field("Item Name", product.name, (value) => (product.name = value), "text", helpText.itemName),
      field("Small Status Label", product.status, (value) => (product.status = value), "text", helpText.itemStatus),
      field("Price / Availability", product.price, (value) => (product.price = value), "text", helpText.itemPrice),
      field("Colors", product.colors, (value) => (product.colors = value), "text", helpText.itemColors),
      field("Sizes / Fit", product.sizes, (value) => (product.sizes = value), "text", helpText.itemSizes),
      field("Item Description", product.description, (value) => (product.description = value), "textarea", helpText.itemDescription),
      imageField("Main Card Image", product.image, (value) => (product.image = value), helpText.itemImage),
      imageField("Back Toggle Image", backImage.src, (value) => {
        backImage.label = "Back";
        backImage.src = value;
        product.image ||= value;
      }, helpText.itemBackImage),
      imageField("Front Toggle Image", frontImage.src, (value) => {
        frontImage.label = "Front";
        frontImage.src = value;
      }, helpText.itemFrontImage),
      deleteButton
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
    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button full";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete This Media Item";
    deleteButton.addEventListener("click", () => {
      if (!confirm(`Delete media "${item.title}"?`)) return;
      draft.media.splice(index, 1);
      renderMediaEditor();
    });
    row.append(
      Object.assign(document.createElement("h3"), { textContent: `Media ${index + 1}` }),
      field("Media Title", item.title, (value) => (item.title = value), "text", helpText.mediaTitle),
      field("Media Type Label", item.type, (value) => (item.type = value), "text", helpText.mediaType),
      imageField("Media Image", item.image, (value) => (item.image = value), helpText.mediaImage),
      deleteButton
    );
    root.append(row);
  });
}

function renderEditors() {
  bindBasicFields();
  renderStatsEditor();
  renderSocialsEditor();
  renderEventsEditor();
  renderProductsEditor();
  renderMediaEditor();
}

async function loadSubmissions() {
  const root = $("[data-submissions]");
  if (!root) return;
  root.textContent = "Loading requests...";
  try {
    const result = await api("/api/admin/submissions");
    if (!result.submissions.length) {
      root.textContent = "No requests yet.";
      return;
    }
    root.innerHTML = "";
    result.submissions.forEach((submission) => {
      const row = document.createElement("div");
      row.className = "admin-repeat";
      row.append(
        Object.assign(document.createElement("h3"), { textContent: `${submission.type || "Request"} - ${submission.name || "No name"}` }),
        Object.assign(document.createElement("time"), { textContent: new Date(submission.createdAt).toLocaleString() }),
        field("Email", submission.email || "", () => {}),
        field("Message", submission.message || "", () => {}, "textarea")
      );
      root.append(row);
    });
  } catch (error) {
    root.textContent = error.message;
  }
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
    await loadSubmissions();
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

document.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", async () => {
  setMessage("[data-save-message]", "Saving...");
  try {
    await api("/api/admin/save", { method: "POST", body: JSON.stringify(draft) });
    setMessage("[data-save-message]", "Saved. Public site updated.");
  } catch (error) {
    setMessage("[data-save-message]", error.message);
  }
}));

$("[data-export]").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `warrior-amaziah-site-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$("[data-import]").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported.products || !imported.events || !imported.stats) throw new Error("Backup file does not look valid.");
    draft = imported;
    renderEditors();
    setMessage("[data-save-message]", "Backup loaded. Click Save Changes to publish it.");
  } catch (error) {
    setMessage("[data-save-message]", error.message);
  } finally {
    event.target.value = "";
  }
});

$("[data-refresh-submissions]").addEventListener("click", loadSubmissions);

$("[data-change-password]").addEventListener("click", async () => {
  const input = $("[data-new-password]");
  const password = input.value.trim();
  setMessage("[data-save-message]", "Changing password...");
  try {
    await api("/api/admin/change-password", { method: "POST", body: JSON.stringify({ password }) });
    input.value = "";
    setMessage("[data-save-message]", "Password changed.");
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

$("[data-add-social]").addEventListener("click", () => {
  draft.socials ||= [];
  draft.socials.push({ label: "New Link", url: "#" });
  renderSocialsEditor();
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
