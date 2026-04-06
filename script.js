const DATA_SOURCE = "https://akhil-06.github.io/emoji_project/emojiList.js";
const FLAG_ASSET_BASE = "https://twemoji.maxcdn.com/v/latest/svg";
const numberFormatter = new Intl.NumberFormat("en-US");

const state = {
  emojis: [],
  filteredEmojis: [],
  activeCategory: "All",
  query: "",
  spotlightId: null,
};

const elements = {
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  categoryFilters: document.querySelector("#category-filters"),
  totalCount: document.querySelector("#total-count"),
  visibleCount: document.querySelector("#visible-count"),
  activeView: document.querySelector("#active-view"),
  resultsTitle: document.querySelector("#results-title"),
  resultsSummary: document.querySelector("#results-summary"),
  emojiGrid: document.querySelector("#emoji-grid"),
  emptyState: document.querySelector("#empty-state"),
  resetFilters: document.querySelector("#reset-filters"),
  toast: document.querySelector("#toast"),
  spotlightEmoji: document.querySelector("#spotlight-emoji"),
  spotlightName: document.querySelector("#spotlight-name"),
  spotlightMeta: document.querySelector("#spotlight-meta"),
  shuffleSpotlight: document.querySelector("#shuffle-spotlight"),
};

let filterFrame = 0;
let toastTimer = 0;

window.addEventListener("load", initializeApp);

function initializeApp() {
  renderLoadingCards();
  registerEvents();
  loadEmojis();
}

function registerEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    scheduleFilter();
  });

  elements.clearSearch.addEventListener("click", () => {
    elements.searchInput.value = "";
    state.query = "";
    scheduleFilter();
    elements.searchInput.focus();
  });

  elements.resetFilters.addEventListener("click", resetAllFilters);

  elements.categoryFilters.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-category]");

    if (!trigger) {
      return;
    }

    state.activeCategory = trigger.dataset.category;
    syncCategoryButtons();
    scheduleFilter();
  });

  elements.emojiGrid.addEventListener("click", async (event) => {
    const copyButton = event.target.closest("[data-copy-emoji]");

    if (!copyButton) {
      return;
    }

    const emoji = copyButton.dataset.copyEmoji;
    const description = copyButton.dataset.copyDescription;
    await copyEmojiToClipboard(emoji, description);
  });

  elements.shuffleSpotlight.addEventListener("click", () => {
    updateSpotlight(true);
  });
}

async function loadEmojis() {
  try {
    const emojiData = await fetchEmojiData();
    state.emojis = emojiData.map(normalizeEmoji);
    state.filteredEmojis = [...state.emojis];

    renderCategoryFilters();
    updateSpotlight();
    applyFilters();
  } catch (error) {
    console.error(error);
    renderErrorState();
  }
}

async function fetchEmojiData() {
  const response = await fetch(DATA_SOURCE, { mode: "cors", cache: "force-cache" });

  if (!response.ok) {
    throw new Error("Unable to fetch emoji data.");
  }

  const fileText = await response.text();
  const jsonLikeText = fileText
    .replace(/^\s*const\s+emojiList\s*=\s*/, "")
    .replace(/;\s*$/, "");

  try {
    const parsedData = JSON.parse(jsonLikeText);

    if (Array.isArray(parsedData)) {
      return parsedData;
    }
  } catch (jsonError) {
    const fallbackParser = new Function(`${fileText}; return emojiList;`);
    const parsedData = fallbackParser();

    if (Array.isArray(parsedData)) {
      return parsedData;
    }

    throw jsonError;
  }

  throw new Error("Emoji data format is invalid.");
}

function normalizeEmoji(item, index) {
  const aliases = Array.isArray(item.aliases) ? item.aliases : [];
  const tags = Array.isArray(item.tags) ? item.tags : [];

  return {
    id: `${aliases[0] || "emoji"}-${index}`,
    emoji: item.emoji || "?",
    description: item.description || "Unknown emoji",
    category: item.category || "Other",
    aliases,
    tags,
    searchText: [
      item.emoji,
      item.description,
      item.category,
      aliases.join(" "),
      tags.join(" "),
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function renderCategoryFilters() {
  const counts = state.emojis.reduce((map, item) => {
    map.set(item.category, (map.get(item.category) || 0) + 1);
    return map;
  }, new Map());

  const sortedCategories = [...counts.entries()].sort((first, second) => {
    return second[1] - first[1] || first[0].localeCompare(second[0]);
  });

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createCategoryButton("All", state.emojis.length));

  sortedCategories.forEach(([categoryName, total]) => {
    fragment.appendChild(createCategoryButton(categoryName, total));
  });

  elements.categoryFilters.replaceChildren(fragment);
  syncCategoryButtons();
}

function createCategoryButton(categoryName, total) {
  const button = document.createElement("button");
  const count = document.createElement("span");

  button.type = "button";
  button.className = "chip";
  button.dataset.category = categoryName;
  button.setAttribute("aria-pressed", "false");
  button.append(categoryName);

  count.className = "chip__count";
  count.textContent = total;
  button.appendChild(count);

  return button;
}

function syncCategoryButtons() {
  const buttons = elements.categoryFilters.querySelectorAll("[data-category]");

  buttons.forEach((button) => {
    const isActive = button.dataset.category === state.activeCategory;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function scheduleFilter() {
  cancelAnimationFrame(filterFrame);
  filterFrame = requestAnimationFrame(applyFilters);
}

function applyFilters() {
  state.filteredEmojis = state.emojis.filter((item) => {
    const matchesCategory =
      state.activeCategory === "All" || item.category === state.activeCategory;
    const matchesQuery = !state.query || item.searchText.includes(state.query);

    return matchesCategory && matchesQuery;
  });

  renderEmojiCards(state.filteredEmojis);
  updateSummary();
  updateSpotlight();
}

function updateSummary() {
  const isSearching = Boolean(state.query);
  const isCategoryFiltered = state.activeCategory !== "All";
  const details = [];

  if (isSearching) {
    details.push(`for "${state.query}"`);
  }

  if (isCategoryFiltered) {
    details.push(`inside ${state.activeCategory}`);
  }

  elements.totalCount.textContent = numberFormatter.format(state.emojis.length);
  elements.visibleCount.textContent = numberFormatter.format(
    state.filteredEmojis.length
  );
  elements.activeView.textContent = isCategoryFiltered ? state.activeCategory : "All";
  elements.resultsTitle.textContent =
    isSearching || isCategoryFiltered ? "Filtered emoji results" : "All emojis";
  elements.resultsSummary.textContent = details.length
    ? `${numberFormatter.format(state.filteredEmojis.length)} matches ${details.join(
        " "
      )}.`
    : `Showing the full collection of ${numberFormatter.format(
        state.emojis.length
      )} emojis.`;

  elements.emptyState.hidden = state.filteredEmojis.length !== 0;
}

function renderEmojiCards(items) {
  if (!items.length) {
    elements.emojiGrid.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const card = document.createElement("article");
    const top = document.createElement("div");
    const emoji = createEmojiVisual(item);
    const copyButton = document.createElement("button");
    const category = document.createElement("p");
    const title = document.createElement("h3");
    const aliases = document.createElement("p");
    const tagList = document.createElement("div");

    card.className = "emoji-card";
    card.style.animationDelay = `${Math.min(index * 16, 180)}ms`;

    top.className = "emoji-card__top";

    copyButton.type = "button";
    copyButton.className = "copy-button";
    copyButton.dataset.copyEmoji = item.emoji;
    copyButton.dataset.copyDescription = item.description;
    copyButton.textContent = "Copy";
    copyButton.setAttribute("aria-label", `Copy ${item.description}`);

    top.append(emoji, copyButton);

    category.className = "emoji-card__category";
    category.textContent = item.category;

    title.className = "emoji-card__title";
    title.textContent = toTitleCase(item.description);

    aliases.className = "emoji-card__aliases";
    aliases.textContent = item.aliases.length
      ? item.aliases.map((alias) => `:${alias}:`).join(" ")
      : "No aliases listed";

    tagList.className = "tag-list";
    buildTags(item).forEach((value) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value;
      tagList.appendChild(tag);
    });

    card.append(top, category, title, aliases, tagList);
    fragment.appendChild(card);
  });

  elements.emojiGrid.replaceChildren(fragment);
}

function buildTags(item) {
  const tags = [];

  item.aliases.slice(0, 2).forEach((alias) => {
    tags.push(`#${alias}`);
  });

  item.tags.slice(0, 3).forEach((tag) => {
    tags.push(`#${tag}`);
  });

  if (!tags.length) {
    tags.push("#emoji");
  }

  return tags;
}

function updateSpotlight(forceShuffle = false) {
  if (!state.emojis.length) {
    elements.spotlightEmoji.textContent = String.fromCodePoint(0x1FAE5);
    elements.spotlightName.textContent = "No spotlight available";
    elements.spotlightMeta.textContent = "Adjust the search to see matching emojis.";
    return;
  }

  const hasActiveFilters = Boolean(state.query) || state.activeCategory !== "All";
  const filteredPool = hasActiveFilters ? state.filteredEmojis : state.emojis;
  const shufflePool = filteredPool.length ? filteredPool : state.emojis;

  if (forceShuffle || !state.spotlightId) {
    const randomIndex = Math.floor(Math.random() * shufflePool.length);
    state.spotlightId = shufflePool[randomIndex].id;
  }

  const item =
    state.emojis.find((emoji) => emoji.id === state.spotlightId) ||
    shufflePool[0] ||
    state.emojis[0];
  const aliasText = item.aliases.length ? `:${item.aliases[0]}:` : "No alias";

  renderSpotlightEmoji(item);
  elements.spotlightName.textContent = toTitleCase(item.description);
  elements.spotlightMeta.textContent = `${item.category} - ${aliasText}`;
}

function renderLoadingCards() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 12; index += 1) {
    const card = document.createElement("article");
    const top = document.createElement("div");
    const emoji = document.createElement("div");
    const copy = document.createElement("div");
    const lineLarge = document.createElement("div");
    const lineSmall = document.createElement("div");
    const tagList = document.createElement("div");

    card.className = "emoji-card emoji-card--skeleton";

    top.className = "emoji-card__top";
    emoji.className = "skeleton-block skeleton-emoji";
    copy.className = "skeleton-block skeleton-chip";
    top.append(emoji, copy);

    lineLarge.className = "skeleton-block skeleton-line-lg";
    lineSmall.className = "skeleton-block skeleton-line-sm";
    tagList.className = "tag-list";

    for (let tagIndex = 0; tagIndex < 3; tagIndex += 1) {
      const tag = document.createElement("div");
      tag.className = "skeleton-chip";
      tagList.appendChild(tag);
    }

    card.append(top, lineSmall, lineLarge, tagList);
    fragment.appendChild(card);
  }

  elements.emojiGrid.replaceChildren(fragment);
}

function renderErrorState() {
  elements.resultsTitle.textContent = "Emoji data could not be loaded";
  elements.resultsSummary.textContent =
    "Check your internet connection and reload the page.";
  elements.emojiGrid.replaceChildren();
  elements.emptyState.hidden = false;
  elements.emptyState.querySelector("h3").textContent = "Unable to fetch emojis right now.";
  elements.emptyState.querySelector("p").textContent =
    "The app needs the remote emoji dataset to display results.";
  elements.spotlightEmoji.textContent = String.fromCodePoint(0x26A0);
  elements.spotlightName.textContent = "Data source unavailable";
  elements.spotlightMeta.textContent = "Try reloading the page.";
}

function resetAllFilters() {
  state.activeCategory = "All";
  state.query = "";
  elements.searchInput.value = "";
  syncCategoryButtons();
  scheduleFilter();
}

function createEmojiVisual(item) {
  if (!isFlagItem(item)) {
    const symbol = document.createElement("div");
    symbol.className = "emoji-card__symbol";
    symbol.textContent = item.emoji;
    return symbol;
  }

  const flagImage = document.createElement("img");
  flagImage.className = "emoji-card__symbol emoji-card__symbol--image";
  flagImage.src = getFlagAssetUrl(item.emoji);
  flagImage.alt = toTitleCase(item.description);
  flagImage.loading = "lazy";
  flagImage.decoding = "async";
  flagImage.addEventListener("error", () => {
    const fallback = document.createElement("div");
    fallback.className = "emoji-card__symbol";
    fallback.textContent = item.emoji;
    flagImage.replaceWith(fallback);
  });
  return flagImage;
}

function renderSpotlightEmoji(item) {
  elements.spotlightEmoji.replaceChildren();

  if (!isFlagItem(item)) {
    elements.spotlightEmoji.textContent = item.emoji;
    return;
  }

  const flagImage = document.createElement("img");
  flagImage.className = "spotlight-card__emoji-image";
  flagImage.src = getFlagAssetUrl(item.emoji);
  flagImage.alt = toTitleCase(item.description);
  flagImage.decoding = "async";
  flagImage.addEventListener("error", () => {
    elements.spotlightEmoji.textContent = item.emoji;
  });

  elements.spotlightEmoji.appendChild(flagImage);
}

function isFlagItem(item) {
  return item.category === "Flags";
}

function getFlagAssetUrl(emoji) {
  const codepoints = Array.from(emoji, (character) => {
    return character.codePointAt(0).toString(16);
  }).join("-");

  return `${FLAG_ASSET_BASE}/${codepoints}.svg`;
}

async function copyEmojiToClipboard(emoji, description) {
  try {
    await navigator.clipboard.writeText(emoji);
    showToast(`${emoji} ${toTitleCase(description)} copied.`);
  } catch (error) {
    const helperField = document.createElement("textarea");
    helperField.value = emoji;
    helperField.setAttribute("readonly", "");
    helperField.style.position = "absolute";
    helperField.style.left = "-9999px";
    document.body.appendChild(helperField);
    helperField.select();
    document.execCommand("copy");
    helperField.remove();
    showToast(`${emoji} copied to clipboard.`);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 1800);
}

function toTitleCase(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
