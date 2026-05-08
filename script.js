function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function clear(element) {
  while (element.firstChild) element.firstChild.remove();
}

function safeUrl(value, fallback = "#") {
  const text = String(value || "").trim();
  if (!text || text === "#") return fallback;
  try {
    const url = new URL(text, window.location.origin);
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return url.href;
  } catch (error) {
    if (/^[\w./#-]+$/.test(text)) return text;
  }
  return fallback;
}

function safeImageSrc(value) {
  const text = String(value || "").trim();
  if (/^assets\/[\w./-]+\.(svg|png|jpe?g|webp)$/i.test(text)) return text;
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(text)) return text;
  try {
    const url = new URL(text, window.location.origin);
    if (["http:", "https:"].includes(url.protocol)) return url.href;
  } catch (error) {
    return "assets/warrior-poster.svg";
  }
  return "assets/warrior-poster.svg";
}

function renderProducts() {
  const grid = document.querySelector(".product-grid");
  if (!grid) return;

  const limit = Number(grid.dataset.productsLimit || siteData.products.length);
  const products = siteData.products.slice(0, limit);

  clear(grid);
  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const image = document.createElement("img");
    image.src = safeImageSrc(product.image);
    image.alt = product.name || "Fight gear item";

    const body = document.createElement("div");
    body.className = "product-card-body";
    const status = document.createElement("span");
    status.textContent = product.status || "";
    const title = document.createElement("h3");
    title.textContent = product.name || "";
    const description = document.createElement("p");
    description.textContent = product.description || "";
    const details = document.createElement("dl");
    [
      ["Price", product.price],
      ["Colors", product.colors],
      ["Sizes", product.sizes]
    ].forEach(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const definition = document.createElement("dd");
      definition.textContent = value || "";
      row.append(term, definition);
      details.append(row);
    });

    body.append(status, title, description, details);
    if (product.images?.length) {
      const switcher = document.createElement("div");
      switcher.className = "view-switch";
      switcher.setAttribute("aria-label", `${product.name || "Item"} views`);
      product.images.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
        button.dataset.imageSrc = safeImageSrc(item.src);
        button.textContent = item.label || `View ${index + 1}`;
        switcher.append(button);
      });
      body.append(switcher);
    }
    const badge = document.createElement("span");
    badge.className = "preview-badge";
    badge.textContent = "Preview Only";
    body.append(badge);
    card.append(image, body);
    grid.append(card);
  });

  grid.querySelectorAll(".view-switch button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".product-card");
      const image = card.querySelector("img");
      button.parentElement.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      image.src = button.dataset.imageSrc;
    });
  });
}

function renderEvents() {
  const list = document.querySelector(".event-list");
  if (!list) return;

  clear(list);
  siteData.events.forEach((event) => {
    const card = document.createElement("article");
    card.className = "event-card";
    const copy = document.createElement("div");
    const type = document.createElement("span");
    type.className = "event-type";
    type.textContent = event.type || "";
    const title = document.createElement("h2");
    title.textContent = event.title || "";
    const note = document.createElement("p");
    note.textContent = event.note || "";
    copy.append(type, title, note);

    const meta = document.createElement("div");
    meta.className = "event-meta";
    [event.date, event.location].forEach((value) => {
      const item = document.createElement("span");
      item.textContent = value || "";
      meta.append(item);
    });
    const link = document.createElement("a");
    link.href = safeUrl(event.url);
    link.textContent = event.linkLabel || "Details";
    meta.append(link);
    card.append(copy, meta);
    list.append(card);
  });
}

function renderStats() {
  const strip = document.querySelector("[data-stats]");
  if (!strip) return;

  clear(strip);
  siteData.stats.forEach((stat) => {
    const item = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = stat.label || "";
    const value = document.createElement("strong");
    value.textContent = stat.value || "";
    item.append(label, value);
    strip.append(item);
  });
}

function renderCountdown() {
  const countdown = document.querySelector("[data-countdown]");
  if (!countdown) return;

  const event = siteData.events[0];
  const target = event?.countdownDate ? new Date(event.countdownDate) : null;
  if (!target || Number.isNaN(target.getTime())) {
    countdown.innerHTML = `
      <div><strong>TBA</strong><span>Days</span></div>
      <div><strong>TBA</strong><span>Hours</span></div>
      <div><strong>TBA</strong><span>Mins</span></div>
      <div><strong>TBA</strong><span>Secs</span></div>
    `;
    return;
  }

  const update = () => {
    const remaining = Math.max(0, target.getTime() - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    countdown.innerHTML = `
      <div><strong>${days}</strong><span>Days</span></div>
      <div><strong>${hours}</strong><span>Hours</span></div>
      <div><strong>${mins}</strong><span>Mins</span></div>
      <div><strong>${secs}</strong><span>Secs</span></div>
    `;
  };

  update();
  setInterval(update, 1000);
}

function renderMedia() {
  const grid = document.querySelector("[data-media]");
  if (!grid) return;

  clear(grid);
  siteData.media.forEach((item) => {
    const card = document.createElement("article");
    card.className = "media-card";
    const image = document.createElement("img");
    image.src = safeImageSrc(item.image);
    image.alt = item.title || "Media image";
    const body = document.createElement("div");
    const type = document.createElement("span");
    type.textContent = item.type || "";
    const title = document.createElement("h3");
    title.textContent = item.title || "";
    body.append(type, title);
    card.append(image, body);
    grid.append(card);
  });
}

function renderHeroMeta() {
  const row = document.querySelector("[data-hero-meta]");
  if (!row) return;
  const meta = siteData.heroMeta || {};
  const event = siteData.events[0] || {};

  const items = [
    { k: "Identity", v: meta.identity || "Faith-Driven", hot: false },
    { k: "Next Stop", v: meta.nextStop || event.location || "TBA", hot: true },
    { k: "Status", v: meta.status || "In Camp", hot: false }
  ];

  clear(row);
  items.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "meta-item";
    const k = document.createElement("span");
    k.className = "k";
    k.textContent = item.k;
    const v = document.createElement("span");
    v.className = "v" + (item.hot ? " hot" : "");
    v.textContent = item.v;
    wrap.append(k, v);
    row.append(wrap);
  });
}

function renderHeroFootplate() {
  const fp = document.querySelector("[data-hero-footplate]");
  if (!fp) return;
  const event = siteData.events[0] || {};
  const venueDate = [event.location, event.date].filter(Boolean).join(" · ") || "Date drops soon";
  const ticketLabel = event.linkLabel || "Tickets";

  clear(fp);
  const left = document.createElement("strong");
  left.textContent = venueDate;
  const right = document.createElement("a");
  right.href = safeUrl(event.url);
  right.textContent = `${ticketLabel} →`;
  fp.append(left, right);
}

function renderRecord() {
  const card = document.querySelector("[data-record]");
  if (!card) return;
  const r = siteData.record || { wins: 0, losses: 0, draws: 0, kos: 0, status: "", note: "" };

  const copy = card.querySelector("[data-record-copy]");
  if (copy) {
    const status = r.status || "Pro Debut TBA";
    copy.innerHTML = `
      <p class="eyebrow muted">Pro Record</p>
      <h2><span>${r.wins}–${r.losses}–${r.draws}</span> · <span class="accent">${status}</span></h2>
      <p>${r.note || ""}</p>
    `;
  }

  const grid = card.querySelector("[data-record-grid]");
  if (grid) {
    grid.innerHTML = `
      <div><strong>${r.wins}</strong><span>Wins</span></div>
      <div><strong>${r.losses}</strong><span>Losses</span></div>
      <div><strong>${r.draws}</strong><span>Draws</span></div>
      <div class="hot"><strong>${r.kos}</strong><span>KO</span></div>
    `;
  }
}

function renderFightPosterMeta() {
  const meta = document.querySelector("[data-fight-poster-meta]");
  if (!meta) return;
  const event = siteData.events[0] || {};

  meta.innerHTML = `
    <div><span class="k">Date</span><span class="v">${event.date || "TBA"}</span></div>
    <div><span class="k">Venue</span><span class="v hot">${event.location || "TBA"}</span></div>
    <div><span class="k">Status</span><span class="v">Date Drops Soon</span></div>
  `;

  const link = document.querySelector("[data-fight-poster-link]");
  if (link) {
    link.href = safeUrl(event.url);
    link.textContent = `${event.linkLabel || "Tickets"} →`;
  }
}

function renderSocials() {
  document.querySelectorAll("[data-socials]").forEach((container) => {
    clear(container);
    (siteData.socials || [])
      .filter((social) => social.url && social.url !== "#")
      .forEach((social) => {
        const link = document.createElement("a");
        link.href = safeUrl(social.url);
        link.rel = "noopener";
        link.target = "_blank";
        link.textContent = social.label || "Social";
        container.append(link);
      });
  });
}

function setupContactForm() {
  const forms = document.querySelectorAll("[data-contact-form]");
  if (!forms.length) return;

  forms.forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector("[data-contact-message]");
    message.textContent = "Sending...";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send request.");
      form.reset();
      message.textContent = "Request sent. The team will follow up.";
    } catch (error) {
      message.textContent = error.message;
    }
  }));
}

function setupPronunciation() {
  document.querySelectorAll("[data-pronounce-name]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!("speechSynthesis" in window)) {
        button.textContent = "Audio Not Supported";
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(button.dataset.speakText || "Avishai Amaziah");
      utterance.rate = 0.78;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    });
  });
}

async function loadEditableSiteData() {
  try {
    const response = await fetch("/api/site-data", { cache: "no-store" });
    if (!response.ok) return;
    const saved = await response.json();
    if (saved && typeof saved === "object") {
      Object.assign(siteData, saved);
    }
  } catch (error) {
    // Local file previews do not have the Worker API. Static data is fine there.
  }
}

async function renderSiteData() {
  await loadEditableSiteData();
  setText("[data-brand]", siteData.brandName);
  setText("[data-hero-title]", siteData.tagline);
  setText("[data-hero-copy]", siteData.heroCopy);
  setText("[data-about-title]", siteData.aboutTitle);
  setText("[data-about-copy]", siteData.aboutCopy);

  const bookingLink = document.querySelector("[data-booking-link]");
  if (bookingLink) {
    bookingLink.href = `mailto:${siteData.bookingEmail}`;
  }

  const nextEvent = siteData.events[0];
  if (nextEvent) {
    setText("[data-next-event-title]", nextEvent.title);
    setText("[data-next-event-copy]", `${nextEvent.date} - ${nextEvent.location}. ${nextEvent.note}`);
  }

  renderProducts();
  renderEvents();
  renderStats();
  renderCountdown();
  renderMedia();
  renderSocials();
  renderHeroMeta();
  renderHeroFootplate();
  renderRecord();
  renderFightPosterMeta();
  setupContactForm();
  setupPronunciation();
}

document.addEventListener("DOMContentLoaded", renderSiteData);
