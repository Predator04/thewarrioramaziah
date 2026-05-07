function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function renderProducts() {
  const grid = document.querySelector(".product-grid");
  if (!grid) return;

  const limit = Number(grid.dataset.productsLimit || siteData.products.length);
  const products = siteData.products.slice(0, limit);

  grid.innerHTML = products
    .map(
      (product) => `
        <article class="product-card">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-card-body">
            <span>${product.status}</span>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <dl>
              <div><dt>Price</dt><dd>${product.price}</dd></div>
              <div><dt>Colors</dt><dd>${product.colors}</dd></div>
              <div><dt>Sizes</dt><dd>${product.sizes}</dd></div>
            </dl>
            ${
              product.images
                ? `<div class="view-switch" aria-label="${product.name} views">
                    ${product.images
                      .map(
                        (image, index) =>
                          `<button type="button" ${index === 0 ? 'aria-pressed="true"' : 'aria-pressed="false"'} data-image-src="${image.src}">${image.label}</button>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
            <a class="button product-button" href="${product.buyUrl}">Preview Only</a>
          </div>
        </article>
      `
    )
    .join("");

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

  list.innerHTML = siteData.events
    .map(
      (event) => `
        <article class="event-card">
          <div>
            <span class="event-type">${event.type}</span>
            <h2>${event.title}</h2>
            <p>${event.note}</p>
          </div>
          <div class="event-meta">
            <span>${event.date}</span>
            <span>${event.location}</span>
            <a href="${event.url}">${event.linkLabel}</a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderStats() {
  const strip = document.querySelector("[data-stats]");
  if (!strip) return;

  strip.innerHTML = siteData.stats
    .map(
      (stat) => `
        <div>
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </div>
      `
    )
    .join("");
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

  grid.innerHTML = siteData.media
    .map(
      (item) => `
        <article class="media-card">
          <img src="${item.image}" alt="${item.title}">
          <div>
            <span>${item.type}</span>
            <h3>${item.title}</h3>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSiteData() {
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
}

document.addEventListener("DOMContentLoaded", renderSiteData);
