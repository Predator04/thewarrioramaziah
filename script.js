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
            <a class="button product-button" href="${product.buyUrl}">Drop Details Soon</a>
          </div>
        </article>
      `
    )
    .join("");
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
}

document.addEventListener("DOMContentLoaded", renderSiteData);
