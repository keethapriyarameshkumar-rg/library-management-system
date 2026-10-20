
const API = "http://localhost:8080/api";

let books = [];
let editingBookId = null;
let isLoading = false;
let onlineResults = [];

const $ = (id) => document.getElementById(id);

const elements = {
  total: $("totalBooks"),
  available: $("availableBooks"),
  issued: $("issuedBooks"),
  categories: $("categoryCount"),
  donut: $("availabilityDonut"),
  percent: $("availabilityPercent"),
  legendAvailable: $("legendAvailable"),
  legendIssued: $("legendIssued"),
  legendTotal: $("legendTotal"),
  categoryChart: $("categoryChart"),
  search: $("searchInput"),
  categoryFilter: $("categoryFilter"),
  statusFilter: $("statusFilter"),
  bookGrid: $("bookGrid"),
  emptyState: $("emptyState"),
  emptyTitle: $("emptyTitle"),
  emptyDescription: $("emptyDescription"),
  resultCount: $("resultCount"),
  catalogMessage: $("catalogMessage"),
  modal: $("bookModal"),
  form: $("bookForm"),
  modalTitle: $("modalTitle"),
  saveButton: $("saveBookBtn"),
  toastContainer: $("toastContainer")
};

const STORAGE_KEYS = {
  favorites: "galaxyLibraryFavorites",
  progress: "galaxyLibraryReadingProgress"
};

function readStorage(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

let favorites = readStorage(STORAGE_KEYS.favorites, []);
let readingProgress = readStorage(STORAGE_KEYS.progress, {});

if (!Array.isArray(favorites)) favorites = [];
if (!readingProgress || typeof readingProgress !== "object") {
  readingProgress = {};
}

function saveFavorites() {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(readingProgress));
}

function isFavorite(id) {
  return favorites.includes(String(id));
}

function getProgress(id) {
  const value = Number(readingProgress[String(id)] ?? 0);
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

function setProgress(id, value) {
  readingProgress[String(id)] = Math.min(100, Math.max(0, Number(value) || 0));
  saveProgress();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function isAvailable(book) {
  return book.available === true ||
    String(book.available).toLowerCase() === "true";
}

function normaliseBook(book) {
  return {
    id: Number(book.id),
    title: String(book.title ?? ""),
    author: String(book.author ?? ""),
    category: String(book.category ?? "Uncategorised"),
    isbn: String(book.isbn ?? ""),
    available: isAvailable(book)
  };
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === "success" ? "check-circle-2" : "alert-circle"}"></i>
    <span>${escapeHTML(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const text = await response.text();

  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function postForm(path, values) {
  const body = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    body.append(key, String(value ?? ""));
  });

  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: body.toString()
  });
}

/* ---------- GALAXY UI EXTRAS ---------- */

function installGalaxyStyles() {
  if ($("galaxyExtraStyles")) return;

  const style = document.createElement("style");
  style.id = "galaxyExtraStyles";
  style.textContent = `
    .galaxy-toolbar {
      display:flex; gap:10px; flex-wrap:wrap; align-items:center;
      margin:16px 0; animation: galaxyFade .35s ease both;
    }
    .galaxy-control {
      background:var(--surface, #151c32); color:var(--text, #f4f1ff);
      border:1px solid var(--border, #34304f); border-radius:12px;
      padding:11px 13px; font:inherit; max-width:100%;
    }
    .galaxy-button {
      border:1px solid var(--border, #34304f); border-radius:10px;
      background:rgba(167,139,250,.12); color:var(--text, #f4f1ff);
      padding:8px 10px; cursor:pointer; transition:transform .2s, background .2s;
    }
    .galaxy-button:hover { transform:translateY(-2px); background:rgba(167,139,250,.25); }
    .galaxy-button.active { background:#7c3aed; color:white; }
    .galaxy-book-tools { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
    .galaxy-progress { margin-top:12px; }
    .galaxy-progress-line { display:flex; justify-content:space-between; gap:8px; font-size:12px; margin-bottom:6px; }
    .galaxy-progress-track { height:7px; background:rgba(167,139,250,.15); border-radius:20px; overflow:hidden; }
    .galaxy-progress-fill { height:100%; border-radius:20px; background:linear-gradient(90deg,#8b5cf6,#ec4899); transition:width .35s; }
    .galaxy-fav { color:#f9a8d4; font-size:17px; }
    .galaxy-details-backdrop {
      position:fixed; inset:0; z-index:10000; display:flex; align-items:center;
      justify-content:center; padding:18px; background:rgba(3,5,16,.82);
      backdrop-filter:blur(10px); animation:galaxyFade .2s ease;
    }
    .galaxy-details {
      width:min(580px,100%); max-height:90vh; overflow:auto; padding:24px;
      color:var(--text, #f4f1ff); background:var(--surface, #151c32);
      border:1px solid var(--border, #34304f); border-radius:22px;
      box-shadow:0 25px 90px rgba(0,0,0,.45);
    }
    .galaxy-details h2 { margin:8px 0; overflow-wrap:anywhere; }
    .galaxy-details p { line-height:1.65; }
    .galaxy-detail-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:18px; }
    .galaxy-progress-input { width:100%; accent-color:#a78bfa; margin:12px 0; }
    .galaxy-small { opacity:.75; font-size:13px; }
    .book-card { animation:galaxyFade .45s ease both; }
    @keyframes galaxyFade {
      from { opacity:0; transform:translateY(9px); }
      to { opacity:1; transform:translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
    }
  `;
  document.head.appendChild(style);
}

function installGalaxyToolbar() {
  if ($("galaxyToolbar")) return;

  const toolbar = document.createElement("div");
  toolbar.id = "galaxyToolbar";
  toolbar.className = "galaxy-toolbar";
  toolbar.innerHTML = `
    <select id="galaxySort" class="galaxy-control" aria-label="Sort books">
      <option value="title">Sort: Title A–Z</option>
      <option value="title-desc">Sort: Title Z–A</option>
      <option value="author">Sort: Author A–Z</option>
      <option value="progress">Sort: Reading progress</option>
      <option value="newest">Sort: Highest book ID</option>
    </select>
    <button type="button" id="galaxyFavoritesOnly" class="galaxy-button">
      ♥ Favorites only
    </button>
    <button type="button" id="galaxyInProgressOnly" class="galaxy-button">
      ◷ Reading
    </button>
    <button type="button" id="galaxyClearExtra" class="galaxy-button">
      Clear extra filters
    </button>
  `;

  elements.bookGrid.parentElement.insertBefore(toolbar, elements.bookGrid);

  $("galaxySort").addEventListener("change", renderBooks);
  $("galaxyFavoritesOnly").addEventListener("click", event => {
    event.currentTarget.classList.toggle("active");
    renderBooks();
  });
  $("galaxyInProgressOnly").addEventListener("click", event => {
    event.currentTarget.classList.toggle("active");
    renderBooks();
  });
  $("galaxyClearExtra").addEventListener("click", () => {
    $("galaxyFavoritesOnly").classList.remove("active");
    $("galaxyInProgressOnly").classList.remove("active");
    $("galaxySort").value = "title";
    elements.search.value = "";
    elements.categoryFilter.value = "";
    elements.statusFilter.value = "";
    renderBooks();
  });
}

function installDetailsModal() {
  if ($("galaxyDetailsBackdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.id = "galaxyDetailsBackdrop";
  backdrop.className = "galaxy-details-backdrop hidden";
  backdrop.innerHTML = `
    <section class="galaxy-details" role="dialog" aria-modal="true" aria-labelledby="galaxyDetailTitle">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <span class="book-category">YOUR READING SPACE</span>
        <button type="button" class="galaxy-button" id="galaxyDetailClose" aria-label="Close details">✕</button>
      </div>
      <h2 id="galaxyDetailTitle"></h2>
      <p id="galaxyDetailAuthor" class="galaxy-small"></p>
      <p id="galaxyDetailMeta"></p>
      <p id="galaxyDetailStatus"></p>
      <div class="galaxy-progress">
        <div class="galaxy-progress-line">
          <label for="galaxyDetailProgress">Reading progress</label>
          <strong id="galaxyDetailProgressValue">0%</strong>
        </div>
        <input id="galaxyDetailProgress" class="galaxy-progress-input" type="range" min="0" max="100" step="5" value="0">
        <p class="galaxy-small">This progress is saved in this browser.</p>
      </div>
      <div class="galaxy-detail-actions">
        <button type="button" class="galaxy-button" id="galaxyDetailFavorite">♥ Add to favorites</button>
        <button type="button" class="galaxy-button" id="galaxyDetailEdit">✎ Edit book</button>
        <button type="button" class="galaxy-button" id="galaxyDetailDone">Done</button>
      </div>
    </section>
  `;
  document.body.appendChild(backdrop);

  $("galaxyDetailClose").addEventListener("click", closeDetails);
  $("galaxyDetailDone").addEventListener("click", closeDetails);
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeDetails();
  });
  $("galaxyDetailProgress").addEventListener("input", event => {
    const id = backdrop.dataset.bookId;
    if (!id) return;
    setProgress(id, event.target.value);
    $("galaxyDetailProgressValue").textContent = `${event.target.value}%`;
    renderBooks();
  });
  $("galaxyDetailFavorite").addEventListener("click", () => {
    const id = backdrop.dataset.bookId;
    if (id) toggleFavorite(id);
    const book = books.find(item => String(item.id) === String(id));
    if (book) $("galaxyDetailFavorite").textContent =
      isFavorite(id) ? "♥ Remove favorite" : "♥ Add to favorites";
  });
  $("galaxyDetailEdit").addEventListener("click", () => {
    const id = Number(backdrop.dataset.bookId);
    const book = books.find(item => item.id === id);
    closeDetails();
    if (book) openModal(book);
  });
}

let detailBookId = null;

function openDetails(id) {
  const book = books.find(item => item.id === Number(id));
  if (!book) return;

  detailBookId = book.id;
  const backdrop = $("galaxyDetailsBackdrop");
  backdrop.dataset.bookId = book.id;
  $("galaxyDetailTitle").textContent = book.title;
  $("galaxyDetailAuthor").textContent = `by ${book.author || "Unknown author"}`;
  $("galaxyDetailMeta").textContent =
    `Category: ${book.category || "Uncategorised"} · ${book.isbn ? `ISBN: ${book.isbn}` : `Book ID: ${book.id}`}`;
  $("galaxyDetailStatus").textContent =
    `Availability: ${isAvailable(book) ? "Available" : "Currently issued"}`;
  $("galaxyDetailProgress").value = getProgress(book.id);
  $("galaxyDetailProgressValue").textContent = `${getProgress(book.id)}%`;
  $("galaxyDetailFavorite").textContent =
    isFavorite(book.id) ? "♥ Remove favorite" : "♥ Add to favorites";
  backdrop.classList.remove("hidden");
  $("galaxyDetailClose").focus();
}

function closeDetails() {
  $("galaxyDetailsBackdrop")?.classList.add("hidden");
  detailBookId = null;
}

function toggleFavorite(id) {
  const key = String(id);
  favorites = favorites.map(String);

  if (favorites.includes(key)) {
    favorites = favorites.filter(item => item !== key);
    showToast("Removed from favorites.");
  } else {
    favorites.push(key);
    showToast("Added to your favorites.");
  }

  saveFavorites();
  renderBooks();
}

function getFilteredBooks() {
  const keyword = elements.search.value.trim().toLowerCase();
  const category = elements.categoryFilter.value;
  const status = elements.statusFilter.value;
  const favoritesOnly = $("galaxyFavoritesOnly")?.classList.contains("active");
  const progressOnly = $("galaxyInProgressOnly")?.classList.contains("active");

  const filtered = books.filter(book => {
    const searchableText = [
      book.title, book.author, book.isbn, book.category, book.id
    ].join(" ").toLowerCase();

    const matchesSearch = !keyword || searchableText.includes(keyword);
    const matchesCategory = !category || book.category === category;
    const matchesStatus = !status ||
      (status === "available" && isAvailable(book)) ||
      (status === "issued" && !isAvailable(book));
    const matchesFavorite = !favoritesOnly || isFavorite(book.id);
    const progress = getProgress(book.id);
    const matchesProgress = !progressOnly || (progress > 0 && progress < 100);

    return matchesSearch && matchesCategory && matchesStatus &&
      matchesFavorite && matchesProgress;
  });

  const sort = $("galaxySort")?.value || "title";
  filtered.sort((a, b) => {
    if (sort === "title-desc") return b.title.localeCompare(a.title);
    if (sort === "author") return a.author.localeCompare(b.author);
    if (sort === "progress") return getProgress(b.id) - getProgress(a.id);
    if (sort === "newest") return b.id - a.id;
    return a.title.localeCompare(b.title);
  });

  return filtered;
}

/* ---------- BACKEND AND DASHBOARD ---------- */

async function loadBooks() {
  if (isLoading) return;
  isLoading = true;
  $("refreshBtn").disabled = true;
  elements.catalogMessage.textContent = "Refreshing your collection...";

  try {
    const data = await request("/books");
    if (!Array.isArray(data)) throw new Error("The books endpoint did not return a JSON array.");

    books = data.map(normaliseBook);
    updateStatistics();
    updateCategoryFilter();
    renderBooks();
  } catch (error) {
    elements.bookGrid.innerHTML = `
      <div class="loading-card">
        <strong>We couldn't load your collection.</strong>
        <p>${escapeHTML(error.message)}</p>
        <p>Make sure the Java server is running on port 8080.</p>
      </div>`;
    elements.catalogMessage.textContent = "Unable to connect to the library API.";
    showToast("Could not load books. Check your Java server.", "error");
  } finally {
    isLoading = false;
    $("refreshBtn").disabled = false;
  }
}

function updateStatistics() {
  const total = books.length;
  const available = books.filter(isAvailable).length;
  const issued = total - available;
  const categoryNames = new Set(books.map(book => book.category.trim() || "Uncategorised"));
  const percentage = total ? Math.round(available / total * 100) : 0;

  elements.total.textContent = total;
  elements.available.textContent = available;
  elements.issued.textContent = issued;
  elements.categories.textContent = categoryNames.size;
  elements.percent.textContent = `${percentage}%`;
  elements.donut.style.setProperty("--available", `${percentage}%`);
  elements.legendAvailable.textContent = available;
  elements.legendIssued.textContent = issued;
  elements.legendTotal.textContent = total;

  renderCategoryChart();
}

function updateCategoryFilter() {
  const currentValue = elements.categoryFilter.value;
  const categories = [...new Set(
    books.map(book => book.category.trim() || "Uncategorised")
  )].sort((a, b) => a.localeCompare(b));

  elements.categoryFilter.innerHTML =
    '<option value="">All categories</option>' +
    categories.map(category =>
      `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
    ).join("");

  if (categories.includes(currentValue)) elements.categoryFilter.value = currentValue;
}

function renderCategoryChart() {
  const counts = {};
  books.forEach(book => {
    const category = book.category.trim() || "Uncategorised";
    counts[category] = (counts[category] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (!sorted.length) {
    elements.categoryChart.innerHTML =
      '<div class="chart-empty">Add books to see your category insights.</div>';
    return;
  }

  const maxCount = Math.max(...sorted.map(item => item[1]));
  elements.categoryChart.innerHTML = sorted.map(([name, count]) => `
    <div class="category-row">
      <span class="category-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, count / maxCount * 100)}%"></div></div>
      <span class="category-value">${count}</span>
    </div>
  `).join("");
}

function coverMarkup(book, index) {
  const title = escapeHTML(book.title || "Untitled");
  const category = escapeHTML(book.category || "Library edition");
  const isbn = String(book.isbn || "").trim();

  const fallback = `
    <div class="cover-placeholder tone-${index % 6}">
      <i data-lucide="book-open"></i>
      <strong>${title}</strong>
      <span>${category}</span>
    </div>`;

  if (!isbn) return `<div class="cover-wrap">${fallback}</div>`;

  return `
    <div class="cover-wrap">
      ${fallback}
      <img class="cover-image hidden"
        src="https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false"
        alt="Cover of ${title}" loading="lazy">
      <span class="book-status ${isAvailable(book) ? "available" : "issued"}">
        ${isAvailable(book) ? "Available" : "Issued"}
      </span>
    </div>`;
}

function renderBooks() {
  const filtered = getFilteredBooks();

  elements.resultCount.textContent = filtered.length;
  elements.catalogMessage.textContent = `Showing ${filtered.length} of ${books.length} books`;

  if (!filtered.length) {
    elements.bookGrid.innerHTML = "";
    elements.emptyState.classList.remove("hidden");

    const hasFilters = Boolean(
      elements.search.value.trim() ||
      elements.categoryFilter.value ||
      elements.statusFilter.value ||
      $("galaxyFavoritesOnly")?.classList.contains("active") ||
      $("galaxyInProgressOnly")?.classList.contains("active")
    );

    elements.emptyTitle.textContent = hasFilters
      ? "No books match your filters."
      : "Your shelves are waiting.";
    elements.emptyDescription.textContent = hasFilters
      ? "Try different filters or clear your extra filters."
      : "Add your first book to start building your collection.";
    $("emptyAddBtn").classList.toggle("hidden", hasFilters);
    if (window.lucide) lucide.createIcons();
    return;
  }

  elements.emptyState.classList.add("hidden");

  elements.bookGrid.innerHTML = filtered.map((book, index) => {
    const progress = getProgress(book.id);
    return `
      <article class="book-card" style="animation-delay:${Math.min(index * 35, 280)}ms">
        ${coverMarkup(book, index)}
        <div class="book-info">
          <span class="book-category">${escapeHTML(book.category || "Uncategorised")}</span>
          <h3 class="book-title">${escapeHTML(book.title)}</h3>
          <p class="book-author">by ${escapeHTML(book.author || "Unknown author")}</p>
          <div class="book-isbn">${book.isbn ? `ISBN: ${escapeHTML(book.isbn)}` : `Book ID: ${book.id}`}</div>
          <div class="galaxy-progress">
            <div class="galaxy-progress-line">
              <span>Reading progress</span><strong>${progress}%</strong>
            </div>
            <div class="galaxy-progress-track">
              <div class="galaxy-progress-fill" style="width:${progress}%"></div>
            </div>
          </div>
          <div class="galaxy-book-tools">
            <button class="galaxy-button ${isFavorite(book.id) ? "active" : ""}" data-action="favorite" data-id="${book.id}" aria-label="Toggle favorite">
              <span class="galaxy-fav">${isFavorite(book.id) ? "♥" : "♡"}</span>
            </button>
            <button class="galaxy-button" data-action="details" data-id="${book.id}">Details</button>
            <button class="galaxy-button" data-action="edit" data-id="${book.id}">Edit</button>
            <button class="galaxy-button" data-action="${isAvailable(book) ? "issue" : "return"}" data-id="${book.id}">
              ${isAvailable(book) ? "Issue" : "Return"}
            </button>
            <button class="galaxy-button" data-action="delete" data-id="${book.id}">Delete</button>
          </div>
        </div>
      </article>`;
  }).join("");

  elements.bookGrid.querySelectorAll(".cover-wrap").forEach(wrap => {
    const img = wrap.querySelector(".cover-image");
    if (!img) return;
    img.addEventListener("load", () => {
      if (img.naturalWidth > 1) {
        img.classList.remove("hidden");
        wrap.querySelector(".cover-placeholder")?.classList.add("hidden");
      }
    });
    img.addEventListener("error", () => img.remove());
  });

  if (window.lucide) lucide.createIcons();
}

/* ---------- ADD / EDIT BOOK MODAL ---------- */

function openModal(book = null) {
  editingBookId = book ? Number(book.id) : null;
  elements.form.reset();

  elements.modalTitle.textContent = book ? "Edit book details" : "Add a new book";
  elements.saveButton.innerHTML = book
    ? '<i data-lucide="check"></i> Save changes'
    : '<i data-lucide="plus"></i> Save book';

  const idInput = elements.form.elements.id;
  idInput.disabled = Boolean(book);
  idInput.value = book ? book.id : "";
  elements.form.elements.isbn.value = book?.isbn || "";
  elements.form.elements.title.value = book?.title || "";
  elements.form.elements.author.value = book?.author || "";
  elements.form.elements.category.value = book?.category || "";
  elements.form.elements.available.value = book ? String(isAvailable(book)) : "true";

  $("availabilityField").classList.toggle("hidden", !book);
  elements.modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
  if (book) elements.form.elements.title.focus();
  else idInput.focus();
}

function closeModal() {
  elements.modal.classList.add("hidden");
  editingBookId = null;
}

async function saveBook(event) {
  event.preventDefault();

  const form = elements.form;
  const values = {
    id: editingBookId ?? form.elements.id.value.trim(),
    title: form.elements.title.value.trim(),
    author: form.elements.author.value.trim(),
    category: form.elements.category.value.trim() || "Uncategorised",
    isbn: form.elements.isbn.value.trim(),
    available: editingBookId === null ? true : form.elements.available.value === "true"
  };

  if (!values.title || !values.author || !values.id) {
    showToast("Please enter the book ID, title, and author.", "error");
    return;
  }

  if (!Number.isInteger(Number(values.id)) || Number(values.id) < 1) {
    showToast("Book ID must be a positive whole number.", "error");
    return;
  }

  if (books.some(book => book.id === Number(values.id) && book.id !== editingBookId)) {
    showToast("That book ID already exists. Please use another ID.", "error");
    return;
  }

  elements.saveButton.disabled = true;

  try {
    if (editingBookId !== null) {
      await postForm("/books/update", values);
      showToast("Book details updated successfully.");
    } else {
      await postForm("/books/add", values);
      showToast("Your new book has been added.");
    }

    closeModal();
    await loadBooks();
  } catch (error) {
    showToast(error.message || "Could not save the book.", "error");
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function handleBookAction(action, id) {
  const book = books.find(item => item.id === Number(id));
  if (!book) return;

  if (action === "edit") return openModal(book);
  if (action === "details") return openDetails(id);
  if (action === "favorite") return toggleFavorite(id);

  if (action === "delete" && !window.confirm(
    `Delete "${book.title}" from your library? This cannot be undone.`
  )) return;

  const routes = {
    delete: "/books/delete",
    issue: "/books/issue",
    return: "/books/return"
  };
  const messages = {
    delete: "Book deleted.",
    issue: "Book issued successfully.",
    return: "Book returned successfully."
  };

  try {
    await postForm(routes[action], { id: book.id });

    if (action === "delete") {
      favorites = favorites.filter(item => String(item) !== String(id));
      delete readingProgress[String(id)];
      saveFavorites();
      saveProgress();
    }

    showToast(messages[action]);
    await loadBooks();
  } catch (error) {
    showToast(error.message || "The action could not be completed.", "error");
  }
}

/* ---------- OPEN LIBRARY ONLINE SEARCH ---------- */

const onlineForm = $("onlineSearchForm");
const onlineInput = $("onlineSearchInput");
const onlineGrid = $("onlineBookGrid");
const onlineMessage = $("onlineSearchMessage");
const onlineButton = $("onlineSearchBtn");

async function searchOpenLibrary(keyword) {
  onlineMessage.textContent = "Searching Open Library...";
  onlineGrid.innerHTML = "";
  onlineButton.disabled = true;

  try {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("q", keyword);
    url.searchParams.set("limit", "12");
    url.searchParams.set("fields", "key,title,author_name,first_publish_year,isbn,cover_i");

    const response = await fetch(url);
    if (!response.ok) throw new Error("Online search is temporarily unavailable.");

    const data = await response.json();
    onlineResults = data.docs || [];

    if (!onlineResults.length) {
      onlineMessage.textContent = "No books found. Try another title or author.";
      return;
    }

    onlineMessage.textContent =
      `Found ${onlineResults.length} results. Choose a book to add it to your library.`;

    onlineGrid.innerHTML = onlineResults.map((book, index) => {
      const title = book.title || "Untitled";
      const author = book.author_name?.[0] || "Unknown author";
      const isbn = book.isbn?.[0] || "";
      const year = book.first_publish_year || "Year unavailable";
      const cover = book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : "";

      return `
        <article class="book-card">
          <div class="cover-wrap">
            <div class="cover-placeholder tone-${index % 6}">
              <i data-lucide="book-open"></i><strong>${escapeHTML(title)}</strong>
              <span>Open Library</span>
            </div>
            ${cover ? `<img class="cover-image hidden" src="${cover}" alt="Book cover" loading="lazy">` : ""}
          </div>
          <div class="book-info">
            <span class="book-category">ONLINE BOOK</span>
            <h3 class="book-title">${escapeHTML(title)}</h3>
            <p class="book-author">by ${escapeHTML(author)}</p>
            <div class="book-isbn">Published: ${escapeHTML(year)}</div>
            <button type="button" class="primary-button" data-online-add="${index}">
              <i data-lucide="plus"></i> Add to My Library
            </button>
          </div>
        </article>`;
    }).join("");

    onlineGrid.querySelectorAll(".cover-wrap").forEach(wrap => {
      const img = wrap.querySelector(".cover-image");
      if (!img) return;
      img.addEventListener("load", () => {
        if (img.naturalWidth > 1) {
          img.classList.remove("hidden");
          wrap.querySelector(".cover-placeholder")?.classList.add("hidden");
        }
      });
      img.addEventListener("error", () => img.remove());
    });

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    onlineMessage.textContent =
      error.message || "Could not connect to Open Library. Check your internet connection.";
  } finally {
    onlineButton.disabled = false;
  }
}

onlineForm?.addEventListener("submit", event => {
  event.preventDefault();
  const keyword = onlineInput.value.trim();
  if (keyword) searchOpenLibrary(keyword);
});

onlineGrid?.addEventListener("click", event => {
  const button = event.target.closest("[data-online-add]");
  if (!button) return;

  const book = onlineResults[Number(button.dataset.onlineAdd)];
  if (!book) return;

  const nextId = books.reduce(
    (maximum, item) => Math.max(maximum, Number(item.id) || 0), 0
  ) + 1;

  openModal();
  const form = elements.form;
  form.elements.id.value = nextId;
  form.elements.title.value = book.title || "";
  form.elements.author.value = book.author_name?.[0] || "";
  form.elements.isbn.value = book.isbn?.[0] || "";
  form.elements.category.value = "Uncategorised";
  form.elements.available.value = "true";
  form.elements.title.focus();

  showToast("Book details filled in! Review them and save.");
});

/* ---------- EVENT LISTENERS ---------- */

$("addBookBtn").addEventListener("click", () => openModal());
$("emptyAddBtn").addEventListener("click", () => openModal());
$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);
$("refreshBtn").addEventListener("click", loadBooks);
elements.form.addEventListener("submit", saveBook);

elements.search.addEventListener("input", renderBooks);
elements.categoryFilter.addEventListener("change", renderBooks);
elements.statusFilter.addEventListener("change", renderBooks);

$("resetFilters").addEventListener("click", () => {
  elements.search.value = "";
  elements.categoryFilter.value = "";
  elements.statusFilter.value = "";
  $("galaxyFavoritesOnly")?.classList.remove("active");
  $("galaxyInProgressOnly")?.classList.remove("active");
  if ($("galaxySort")) $("galaxySort").value = "title";
  renderBooks();
});

elements.bookGrid.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button) handleBookAction(button.dataset.action, button.dataset.id);
});

elements.modal.addEventListener("click", event => {
  if (event.target === elements.modal) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    closeDetails();
  }
});

installGalaxyStyles();
installGalaxyToolbar();
installDetailsModal();

if (window.lucide) lucide.createIcons();
loadBooks();