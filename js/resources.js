// Loads resource data, builds tag chips, and filters by search text + active tags.
document.addEventListener("DOMContentLoaded", () => {
	const searchInput = document.getElementById("resource-search");
	const tagChipsContainer = document.getElementById("tag-chips");
	const grid = document.getElementById("resource-grid");
	const statusMessage = document.getElementById("resource-status");

	let allResources = [];
	let activeTags = new Set();

	fetchResources();

	searchInput.addEventListener("input", () => {
		const filtered = filterResources(searchInput.value, activeTags, allResources);
		renderResources(filtered);
	});

	function handleTagClick(tag) {
		if (activeTags.has(tag)) {
			activeTags.delete(tag);
		} else {
			activeTags.add(tag);
		}
		updateChipStyles();
		const filtered = filterResources(searchInput.value, activeTags, allResources);
		renderResources(filtered);
	}

	async function fetchResources() {
		try {
			const response = await fetch("data/resources.json");
			if (!response.ok) throw new Error("Network response was not ok");
			allResources = await response.json();
			renderResources(allResources);
			renderTagChips(collectTags(allResources));
		} catch (err) {
			statusMessage.textContent = "Could not load resources right now. Please refresh.";
			console.error("Failed to load resources.json", err);
		}
	}

	function renderResources(list) {
		grid.innerHTML = "";
		if (list.length === 0) {
			grid.innerHTML = '<p class="muted">No resources match your search. Try a different word or clear some tags.</p>';
			return;
		}

		list.forEach((item) => {
			const card = document.createElement("article");
			card.className = "resource-card";
			card.innerHTML = `
        <h3><a href="${item.url}" target="_blank" rel="noopener">${item.title}</a></h3>
        <p>${item.description}</p>
        <div class="resource-tags">
          ${item.tags.map((tag) => `<span class="pill-tag">${tag}</span>`).join("")}
        </div>
      `;
			grid.appendChild(card);
		});
	}

	function renderTagChips(tags) {
		tagChipsContainer.innerHTML = "";
		tags.forEach((tag) => {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = "tag-chip";
			chip.textContent = tag;
			chip.addEventListener("click", () => handleTagClick(tag));
			tagChipsContainer.appendChild(chip);
		});
	}

	function collectTags(resources) {
		const set = new Set();
		resources.forEach((r) => r.tags.forEach((tag) => set.add(tag)));
		return Array.from(set).sort();
	}

	function updateChipStyles() {
		tagChipsContainer.querySelectorAll(".tag-chip").forEach((chip) => {
			chip.classList.toggle("active", activeTags.has(chip.textContent));
		});
	}

	// AND logic: a resource must include every active tag to appear, plus match the search text.
	function filterResources(searchTerm, tagsSet, list) {
		const term = searchTerm.trim().toLowerCase();
		return list.filter((item) => {
			const matchesText = !term || `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(term);
			const matchesTags = tagsSet.size === 0 || Array.from(tagsSet).every((tag) => item.tags.includes(tag));
			return matchesText && matchesTags;
		});
	}
});
