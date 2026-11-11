(() => {
  const header = document.querySelector("[data-uc-header]");
  if (!header || header.dataset.ucReady === "true") return;
  header.dataset.ucReady = "true";

  const routes = {
    search: header.dataset.searchUrl,
    predictiveSearch: header.dataset.predictiveSearchUrl,
    cart: header.dataset.cartUrl,
    cartChange: header.dataset.cartChangeUrl,
  };

  const currency = header.dataset.currency || "USD";

  const toggles = [...header.querySelectorAll("[data-uc-toggle]")];
  const panels = [...header.querySelectorAll('[data-uc-panel="cart"]')];
  const searchInline = header.querySelector("[data-uc-search-inline]");
  const searchForm = searchInline?.querySelector(".uc-search-inline-form");
  const menu = header.querySelector("#uc-header-menu");
  const menuButton = header.querySelector(".header-menu-toggle");
  const searchInput = searchForm?.querySelector("[data-uc-search-input]");
  const searchResults = header.querySelector("[data-uc-search-results]");
  const viewAll = header.querySelector("[data-uc-view-all]");
  const cartItems = header.querySelector("[data-uc-cart-items]");
  const cartButton = header.querySelector('[data-uc-toggle="cart"]');
  const cartLabel = header.querySelector("[data-uc-cart-label]");
  const cartCloseLabel = header.querySelector("[data-uc-cart-close-label]");
  const cartCount = header.querySelector("[data-uc-cart-count]");
  const cartHeading = header.querySelector("[data-uc-cart-heading]");
  const subtotal = header.querySelector("[data-uc-cart-subtotal]");
  const moneyFormat = "{{ shop.money_format | escape }}";

  let searchTimer;
  let searchController;
  let cartRequest = 0;

  const money = (cents) =>
    (cents / 100).toLocaleString(undefined, {
      style: "currency",
      currency,
    });

  function closeSearch() {
    if (!searchInline || !searchForm) return;

    searchForm.hidden = true;

    const button = searchInline.querySelector('[data-uc-toggle="search"]');

    if (button) {
      button.hidden = false;
      button.setAttribute("aria-expanded", "false");
    }

    clearTimeout(searchTimer);
    searchController?.abort();

    if (searchInput) {
      searchInput.value = "";
    }

    searchResults?.replaceChildren();

    if (viewAll) {
      viewAll.hidden = true;
      viewAll.removeAttribute("href");
    }
  }

  function closeMenu() {
    if (!menu || !menuButton) return;

    menu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    if (!menu || !menuButton) return;

    const isOpen = menu.classList.contains("is-open");

    if (isOpen) {
      closeMenu();
      return;
    }

    menu.classList.add("is-open");
    menuButton.setAttribute("aria-expanded", "true");
  }

  function closePanels() {
    panels.forEach((panel) => {
      panel.hidden = true;
    });

    header
      .querySelector('[data-uc-toggle="cart"]')
      ?.setAttribute("aria-expanded", "false");

    cartLabel.hidden = false;
    cartCloseLabel.hidden = true;
    cartButton.setAttribute("aria-label", "Open cart");

    closeSearch();
  }

  function openPanel(name) {
    if (name === "search") {
      const button = searchInline?.querySelector('[data-uc-toggle="search"]');
      if (!button || !searchForm) return;

      const wasOpen = !searchForm.hidden;
      closePanels();

      if (wasOpen) return;

      searchForm.hidden = false;
      button.hidden = true;
      button.setAttribute("aria-expanded", "true");
      searchInput?.focus();
      return;
    }

    closeMenu();
    const panel = header.querySelector('[data-uc-panel="cart"]');
    const button = header.querySelector('[data-uc-toggle="cart"]');
    if (!panel || !button) return;

    const wasOpen = !panel.hidden;
    closePanels();

    if (wasOpen) return;

    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    cartLabel.hidden = true;
    cartCloseLabel.hidden = false;
    cartButton.setAttribute("aria-label", "Close cart");
    renderCart();
  }

  // Product add-to-cart
  const productForm = document.querySelector("#ProductForm");

  productForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = productForm.querySelector('[name="add"]');
    if (!submitButton || submitButton.disabled) return;

    const originalLabel = submitButton.textContent.trim();

    submitButton.disabled = true;
    submitButton.textContent = "ADDING…";

    try {
      const response = await fetch(`${routes.cart}/add.js`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: new FormData(productForm),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.description || "Unable to add product");
      }

      submitButton.textContent = originalLabel;

      const cartPanel = header.querySelector('[data-uc-panel="cart"]');

      if (cartPanel?.hidden) {
        openPanel("cart");
      } else {
        renderCart();
      }
    } catch (error) {
      console.error("Add to cart failed:", error);
      submitButton.textContent = "TRY AGAIN";
    } finally {
      submitButton.disabled = false;
    }
  });

  menuButton?.addEventListener("click", toggleMenu);

  toggles.forEach((button) => {
    button.addEventListener("click", () => {
      openPanel(button.dataset.ucToggle);
    });
  });

  header.querySelectorAll("[data-uc-close]").forEach((button) => {
    button.addEventListener("click", closePanels);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (searchInline && !searchInline.contains(target)) {
      closeSearch();
    }

    const cartPanel = header.querySelector('[data-uc-panel="cart"]');

    if (
      cartPanel &&
      !cartPanel.hidden &&
      !cartPanel.contains(target) &&
      !cartButton.contains(target)
    ) {
      closePanels();
    }

    if (!header.contains(target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanels();
      closeMenu();
    }
  });

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderSearch(products, query) {
    searchResults.replaceChildren();

    const hasQuery = query.trim().length > 0;
    const hasResults = products.length > 0;

    // Only show View All when products are found.
    viewAll.hidden = !hasQuery || !hasResults;

    if (!hasQuery) {
      viewAll.removeAttribute("href");
      return;
    }

    if (!hasResults) {
      viewAll.removeAttribute("href");
      searchResults.append(
        makeElement("p", "uc-search-status", "NO PRODUCTS FOUND"),
      );
      return;
    }

    const searchUrl = new URL(routes.search, location.origin);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "product");
    viewAll.href = searchUrl.toString();

    products.slice(0, 3).forEach((product) => {
      const link = makeElement("a", "uc-search-result");
      link.href = product.url;

      if (product.image) {
        const image = document.createElement("img");
        image.src = product.image;
        image.alt = "";
        image.loading = "lazy";
        link.append(image);
      }

      const copy = makeElement("span", "uc-search-result-copy");
      copy.append(
        makeElement("span", "", product.title),
        makeElement(
          "span",
          "uc-search-result-price",
          money(Number(product.price) * 100),
        ),
      );

      link.append(copy);
      searchResults.append(link);
    });
  }

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearTimeout(searchTimer);
    searchController?.abort();

    if (!query) {
      renderSearch([], "");
      return;
    }

    searchTimer = setTimeout(async () => {
      searchController = new AbortController();

      try {
        const url = new URL(routes.predictiveSearch, window.location.origin);

        url.pathname = `${url.pathname.replace(/\/$/, "").replace(/\.json$/, "")}.json`;

        url.searchParams.set("q", query);
        url.searchParams.set("resources[type]", "product");
        url.searchParams.set("resources[limit]", "5");
        url.searchParams.set(
          "resources[options][unavailable_products]",
          "last",
        );

        const response = await fetch(url, {
          signal: searchController.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();
        const products = data.resources?.results?.products || [];

        renderSearch(products, query);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Predictive search error:", error);

          searchResults.replaceChildren(
            makeElement(
              "p",
              "uc-search-status",
              "SEARCH TEMPORARILY UNAVAILABLE",
            ),
          );
        }
      }
    }, 180);
  });

  async function getCart() {
    const response = await fetch(`${routes.cart}.js`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to load cart");
    }

    return response.json();
  }

  function renderCartItems(cart) {
    cartItems.replaceChildren();

    if (!cart.items.length) {
      cartItems.append(
        makeElement("p", "uc-search-status", "YOUR CART IS EMPTY"),
      );
      return;
    }

    cart.items.forEach((item) => {
      const row = makeElement("div", "uc-cart-item");

      const image = document.createElement("img");
      image.src = item.featured_image?.url || item.image || "";
      image.alt = item.featured_image?.alt || "";
      image.loading = "lazy";
      row.append(image);

      const info = makeElement("div", "uc-cart-item-info");
      const link = makeElement("a", "uc-cart-item-name", item.product_title);
      link.href = item.url;
      info.append(link);

      if (item.variant_title && item.variant_title !== "Default Title") {
        info.append(makeElement("span", "uc-cart-variant", item.variant_title));
      }

      info.append(
        makeElement("span", "uc-cart-item-price", money(item.final_line_price)),
      );

      const controls = makeElement("div", "uc-cart-item-controls");
      const decrease = makeElement("button", "", "−");
      decrease.type = "button";
      decrease.setAttribute(
        "aria-label",
        `Decrease ${item.product_title} quantity`,
      );
      decrease.addEventListener("click", () =>
        updateLine(item.key, Math.max(0, item.quantity - 1)),
      );

      const quantity = makeElement("span", "", String(item.quantity));
      const increase = makeElement("button", "", "+");
      increase.type = "button";
      increase.setAttribute(
        "aria-label",
        `Increase ${item.product_title} quantity`,
      );
      increase.addEventListener("click", () =>
        updateLine(item.key, item.quantity + 1),
      );

      controls.append(decrease, quantity, increase);
      info.append(controls);

      const remove = makeElement("button", "uc-cart-remove", "REMOVE");
      remove.type = "button";
      remove.addEventListener("click", () => updateLine(item.key, 0));

      row.append(info, remove);
      cartItems.append(row);
    });
  }

  async function renderCart() {
    const request = ++cartRequest;
    cartItems.replaceChildren(
      makeElement("p", "uc-search-status", "LOADING CART…"),
    );

    try {
      const cart = await getCart();
      if (request !== cartRequest) return;

      renderCartItems(cart);
      cartCount.textContent = cart.item_count;
      cartHeading.textContent = `CART / ${cart.item_count} ITEMS`;
      subtotal.textContent = money(cart.total_price);
    } catch {
      cartItems.replaceChildren(
        makeElement(
          "p",
          "uc-search-status",
          "UNABLE TO LOAD CART. PLEASE TRY AGAIN.",
        ),
      );
    }
  }

  async function updateLine(key, quantity) {
    try {
      const response = await fetch(`${routes.cartChange}.js`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id: key,
          quantity,
        }),
      });

      if (!response.ok) {
        throw new Error("Cart update failed");
      }

      const cart = await response.json();

      renderCartItems(cart);

      cartCount.textContent = cart.item_count;
      cartHeading.textContent = `CART / ${cart.item_count} ITEMS`;
      subtotal.textContent = money(cart.total_price);

      document.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
    } catch {
      cartItems.prepend(
        makeElement(
          "p",
          "uc-search-status",
          "UPDATE FAILED. PLEASE TRY AGAIN.",
        ),
      );
    }
  }
})();
