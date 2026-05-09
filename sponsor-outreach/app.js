const STORAGE_KEY = "warriorSponsorLeads";
const SPONSOR_LINK = "https://thewarrioramaziah.com/sponsors.html";

const statuses = ["New", "Contacted", "Interested", "Follow Up", "Closed"];
const categories = [
  "Barbershop",
  "Boxing / Fitness Gym",
  "Restaurant",
  "Car Detail / Wrap",
  "Tattoo Shop",
  "Contractor",
  "Real Estate",
  "Recovery / Chiro",
  "Clothing Brand",
  "Church / Community",
  "Other"
];

const starterLeads = [
  { business: "Local Barbershop", category: "Barbershop", contact: "Owner", email: "", phone: "", instagram: "", status: "New", amount: "$1,500", followUp: "", notes: "Ask if they want local fight-week visibility and repostable content." },
  { business: "Boxing / Fitness Gym", category: "Boxing / Fitness Gym", contact: "Manager", email: "", phone: "", instagram: "", status: "New", amount: "$1,500", followUp: "", notes: "Good fit for training content and community support." },
  { business: "Car Detail Shop", category: "Car Detail / Wrap", contact: "Owner", email: "", phone: "", instagram: "", status: "New", amount: "$1,500", followUp: "", notes: "Offer website placement and fight-week social shoutout." },
  { business: "Recovery Clinic", category: "Recovery / Chiro", contact: "Clinic owner", email: "", phone: "", instagram: "", status: "New", amount: "$1,500", followUp: "", notes: "Pitch performance, recovery, and heavyweight athlete alignment." },
  { business: "Local Restaurant", category: "Restaurant", contact: "Owner", email: "", phone: "", instagram: "", status: "New", amount: "$1,500", followUp: "", notes: "Ask about supporting a local Las Vegas heavyweight." }
];

let leads = [];
let selectedId = "";
let activeTemplate = "email";
let senderEmail = "yeshayaamaziah@gmail.com";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function uid() {
  return `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadLeads() {
  try {
    leads = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    leads = [];
  }
}

function saveLeads() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function normalizeLead(lead) {
  return {
    id: lead.id || uid(),
    business: lead.business || "",
    category: lead.category || "Other",
    contact: lead.contact || "",
    email: lead.email || "",
    phone: lead.phone || "",
    instagram: lead.instagram || "",
    status: statuses.includes(lead.status) ? lead.status : "New",
    amount: lead.amount || "$1,500",
    followUp: lead.followUp || "",
    notes: lead.notes || "",
    lastContacted: lead.lastContacted || ""
  };
}

function filteredLeads() {
  const search = $("[data-search]").value.trim().toLowerCase();
  const category = $("[data-category-filter]").value;
  const status = $("[data-status-filter]").value;
  return leads.filter((lead) => {
    const haystack = [lead.business, lead.category, lead.contact, lead.email, lead.phone, lead.instagram, lead.notes].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) && (!category || lead.category === category) && (!status || lead.status === status);
  });
}

function moneyTotal(list) {
  return list.reduce((total, lead) => total + Number(String(lead.amount || "").replace(/[^0-9.]/g, "") || 0), 0);
}

function renderStats() {
  const root = $("[data-stats]");
  const contacted = leads.filter((lead) => lead.status !== "New").length;
  const interested = leads.filter((lead) => lead.status === "Interested" || lead.status === "Follow Up").length;
  const closed = leads.filter((lead) => lead.status === "Closed");
  const due = leads.filter((lead) => lead.followUp && new Date(`${lead.followUp}T23:59:59`) < new Date() && lead.status !== "Closed").length;
  const stats = [
    ["Total Leads", leads.length],
    ["Contacted", contacted],
    ["Interested", interested],
    ["Closed Value", `$${moneyTotal(closed).toLocaleString()}`],
    ["Follow-ups Due", due]
  ];
  root.innerHTML = stats.map(([label, value]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderBoard() {
  const board = $("[data-board]");
  const list = filteredLeads();
  board.innerHTML = "";
  statuses.forEach((status) => {
    const column = document.createElement("section");
    column.className = "column";
    const columnLeads = list.filter((lead) => lead.status === status);
    column.innerHTML = `
      <div class="column-header">
        <h2>${status}</h2>
        <span>${columnLeads.length}</span>
      </div>
      <div class="column-body"></div>
    `;
    const body = column.querySelector(".column-body");
    columnLeads.forEach((lead) => body.append(renderCard(lead)));
    board.append(column);
  });
}

function renderCard(lead) {
  const template = $("[data-card-template]").content.cloneNode(true);
  const card = template.querySelector(".lead-card");
  card.classList.toggle("active", lead.id === selectedId);
  card.querySelector("[data-card-category]").textContent = lead.category;
  card.querySelector("[data-card-business]").textContent = lead.business;
  card.querySelector("[data-card-contact]").textContent = [lead.contact, lead.email || lead.instagram || lead.phone].filter(Boolean).join(" | ") || "No contact added yet";
  card.querySelector("[data-card-amount]").textContent = lead.amount || "$1,500";
  card.querySelector("[data-card-followup]").textContent = lead.followUp ? `Follow up ${lead.followUp}` : "No follow-up";
  card.querySelector("[data-edit]").addEventListener("click", () => openLeadForm(lead.id));
  card.querySelector("[data-message-button]").addEventListener("click", () => selectLead(lead.id));
  card.querySelector("[data-prev]").disabled = statuses.indexOf(lead.status) === 0;
  card.querySelector("[data-next]").disabled = statuses.indexOf(lead.status) === statuses.length - 1;
  card.querySelector("[data-prev]").addEventListener("click", () => moveLead(lead.id, -1));
  card.querySelector("[data-next]").addEventListener("click", () => moveLead(lead.id, 1));
  return card;
}

function selectLead(id) {
  selectedId = id;
  renderBoard();
  renderMessage();
}

function moveLead(id, direction) {
  const lead = leads.find((item) => item.id === id);
  if (!lead) return;
  const index = statuses.indexOf(lead.status);
  lead.status = statuses[Math.max(0, Math.min(statuses.length - 1, index + direction))];
  saveLeads();
  render();
}

function messageFor(lead) {
  const contact = lead.contact || "there";
  const business = lead.business || "your business";
  const categoryLine = lead.category && lead.category !== "Other" ? `I thought of ${business} because local ${lead.category.toLowerCase()} businesses are a strong fit for his audience and fight-week content.` : `I thought ${business} could be a strong fit for his audience and fight-week content.`;
  const senderLine = `Send from: ${senderEmail}`;
  const optOut = `If this is not a fit, reply "no thanks" and I will not follow up again.`;
  const base = `Avishai "The Warrior" Amaziah is a 6'5" heavyweight fighting out of Las Vegas with a faith, family, and discipline story. Official fight sponsor spots are $1,500 per fight and include website placement, fight-week recognition, social media shoutouts, and content your business can repost.\n\nSponsor page: ${SPONSOR_LINK}`;

  if (activeTemplate === "dm") {
    return `${senderLine}\n\nHey ${contact}, I am helping Avishai "The Warrior" Amaziah connect with a few local fight sponsors.\n\n${categoryLine}\n\n${base}\n\nWould you be open to seeing the sponsor info?\n\n${optOut}`;
  }
  if (activeTemplate === "followup") {
    return `${senderLine}\n\nHey ${contact}, just wanted to follow up on the Avishai Amaziah fight sponsor info.\n\nWe are keeping it simple: $1,500 per fight for official sponsor visibility, website placement, social shoutouts, and fight-week content the business can repost.\n\nHere is the sponsor page again: ${SPONSOR_LINK}\n\nWould you like to talk through it this week?\n\n${optOut}`;
  }
  return `${senderLine}\n\nSubject: Fight sponsorship opportunity with Avishai "The Warrior" Amaziah\n\nHey ${contact},\n\nI am helping Avishai "The Warrior" Amaziah build sponsor support for his next fight camp. ${categoryLine}\n\n${base}\n\nWould you be open to seeing the sponsor options or talking through whether this is a fit for ${business}?\n\n${optOut}\n\nThank you.`;
}

function renderMessage() {
  const lead = leads.find((item) => item.id === selectedId);
  $("[data-message-title]").textContent = lead ? lead.business : "Pick a lead";
  $("[data-message]").value = lead ? messageFor(lead) : "";
}

function render() {
  renderStats();
  renderBoard();
  renderMessage();
}

function populateSelects() {
  const categoryOptions = categories.map((item) => `<option>${item}</option>`).join("");
  const statusOptions = statuses.map((item) => `<option>${item}</option>`).join("");
  $("[name='category']").innerHTML = categoryOptions;
  $("[name='status']").innerHTML = statusOptions;
  $("[data-category-filter]").insertAdjacentHTML("beforeend", categoryOptions);
  $("[data-status-filter]").insertAdjacentHTML("beforeend", statusOptions);
}

function openLeadForm(id = "") {
  const dialog = $("[data-lead-dialog]");
  const form = $("[data-lead-form]");
  const lead = leads.find((item) => item.id === id) || normalizeLead({});
  $("[data-form-title]").textContent = id ? "Edit Lead" : "Add Lead";
  form.elements.id.value = id ? lead.id : "";
  form.elements.business.value = lead.business;
  form.elements.category.value = lead.category;
  form.elements.contact.value = lead.contact;
  form.elements.email.value = lead.email;
  form.elements.phone.value = lead.phone;
  form.elements.instagram.value = lead.instagram;
  form.elements.status.value = lead.status;
  form.elements.amount.value = lead.amount;
  form.elements.followUp.value = lead.followUp;
  form.elements.notes.value = lead.notes;
  $("[data-delete-lead]").hidden = !id;
  dialog.showModal();
}

function saveLeadFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const lead = normalizeLead(data);
  const index = leads.findIndex((item) => item.id === lead.id);
  if (index >= 0) leads[index] = lead;
  else leads.unshift(lead);
  selectedId = lead.id;
  saveLeads();
  $("[data-lead-dialog]").close();
  render();
}

function deleteSelectedLead() {
  const id = $("[name='id']").value;
  if (!id) return;
  if (!confirm("Delete this sponsor lead?")) return;
  leads = leads.filter((lead) => lead.id !== id);
  if (selectedId === id) selectedId = "";
  saveLeads();
  $("[data-lead-dialog]").close();
  render();
}

function copyText(text) {
  navigator.clipboard.writeText(text);
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = ["business", "category", "contact", "email", "phone", "instagram", "status", "amount", "followUp", "lastContacted", "notes"];
  const rows = leads.map((lead) => headers.map((key) => csvEscape(lead[key])).join(","));
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "warrior-sponsor-leads.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function importCsv(file) {
  const text = await file.text();
  const rows = parseCsv(text);
  const headers = rows.shift().map((item) => item.trim());
  const imported = rows.map((row) => {
    const lead = {};
    headers.forEach((header, index) => {
      lead[header] = row[index] || "";
    });
    return normalizeLead(lead);
  });
  leads = [...imported, ...leads];
  saveLeads();
  render();
}

function bindEvents() {
  $("[data-open-form]").addEventListener("click", () => openLeadForm());
  $("[data-lead-form]").addEventListener("submit", saveLeadFromForm);
  $("[data-delete-lead]").addEventListener("click", deleteSelectedLead);
  $("[data-search]").addEventListener("input", renderBoard);
  $("[data-category-filter]").addEventListener("change", renderBoard);
  $("[data-status-filter]").addEventListener("change", renderBoard);
  $("[data-export]").addEventListener("click", exportCsv);
  $("[data-import]").addEventListener("change", (event) => {
    if (event.target.files[0]) importCsv(event.target.files[0]);
    event.target.value = "";
  });
  $("[data-seed]").addEventListener("click", () => {
    leads = [...starterLeads.map(normalizeLead), ...leads];
    saveLeads();
    render();
  });
  $("[data-copy-sponsor-link]").addEventListener("click", () => copyText(SPONSOR_LINK));
  $("[data-copy-message]").addEventListener("click", () => copyText($("[data-message]").value));
  $("[data-sender]").addEventListener("change", (event) => {
    senderEmail = event.target.value;
    renderMessage();
  });
  $("[data-mark-contacted]").addEventListener("click", () => {
    const lead = leads.find((item) => item.id === selectedId);
    if (!lead) return;
    lead.status = lead.status === "New" ? "Contacted" : lead.status;
    lead.lastContacted = new Date().toISOString().slice(0, 10);
    saveLeads();
    render();
  });
  $$("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTemplate = button.dataset.template;
      $$("[data-template]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderMessage();
    });
  });
}

populateSelects();
loadLeads();
leads = leads.map(normalizeLead);
bindEvents();
render();
