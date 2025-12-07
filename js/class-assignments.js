// Fetches class data, renders summary and timeline, and provides filter controls.
document.addEventListener("DOMContentLoaded", () => {
	const summaryContainer = document.getElementById("summary-content");
	const listContainer = document.getElementById("class-list");
	const filterSelect = document.getElementById("class-filter");
	const statusMessage = document.getElementById("status-message");

	let allClasses = [];

	fetchClasses();

	filterSelect.addEventListener("change", () => {
		const filtered = applyFilters(filterSelect.value, allClasses);
		renderClasses(filtered);
	});

	async function fetchClasses() {
		try {
			const response = await fetch("data/classes.json");
			if (!response.ok) throw new Error("Network response was not ok");
			const data = await response.json();
			allClasses = data.sort((a, b) => new Date(b.date) - new Date(a.date));

			const latestClass = allClasses.find((item) => item.class);
			renderSummary(latestClass);
			renderClasses(allClasses);
		} catch (err) {
			statusMessage.textContent = "Oops! We could not load the class list right now. Please try again later.";
			summaryContainer.innerHTML = '<p class="muted">Unable to load class highlight.</p>';
			console.error("Failed to load classes.json", err);
		}
	}

	function renderSummary(latestClass) {
		if (!latestClass) {
			summaryContainer.innerHTML = '<p class="muted">No class entries yet. Check back soon!</p>';
			return;
		}
		const homeworkText = latestClass.homework
			? `<a class="btn-primary" href="${latestClass.homework}" target="_blank" rel="noopener">View Homework</a>
         <span class="pill-tag">Due: ${formatDate(latestClass.homework_due)}</span>`
			: '<span class="pill-tag">No homework for this class 🎉</span>';

		summaryContainer.innerHTML = `
      <h3>${latestClass.class_name}</h3>
      <div class="summary-meta">
        <span>${formatDate(latestClass.date)}</span>
      </div>
      <p class="summary-text">${latestClass.covered_in_class}</p>
      <div class="summary-actions">${homeworkText}</div>
    `;
	}

	function renderClasses(list) {
		listContainer.innerHTML = "";
		statusMessage.textContent = list.length === 0 ? "No items match this filter yet." : "";
		list.forEach((item) => {
			const card = document.createElement("article");
			card.className = `class-card ${item.class ? "" : "no-school"}`;
			const date = `<p class="date">${formatDate(item.date)}</p>`;

			if (!item.class) {
				card.innerHTML = `
          <h3>No School</h3>
          ${date}
          <p class="summary-text" style="color: var(--error); font-weight: 700;">Enjoy your day off! (Don't forget any homework)</p>
          <p class="summary-text">${item.covered_in_class || "No class today."}</p>
        `;
			} else {
				card.innerHTML = `
          <h3>${item.class_name}</h3>
          ${date}
          <p class="summary-text">${item.covered_in_class}</p>
          ${renderNotes(item.notes_contents)}
          ${renderHomework(item.homework, item.homework_due)}
        `;
			}
			listContainer.appendChild(card);
		});
	}

	function renderNotes(notes) {
		if (!notes || notes.length === 0) {
			return '<p class="muted">No notes or extra links for this class.</p>';
		}
		const items = notes.map((note) => `<li><a href="${note.url}" target="_blank" rel="noopener">${note.label}</a></li>`).join("");
		return `
      <p><strong>Notes & Resources</strong></p>
      <ul class="notes-list">${items}</ul>
    `;
	}

	function renderHomework(homework, due) {
		if (!homework) {
			return '<p class="muted">No homework for this class 🎉</p>';
		}
		return `
      <div class="summary-actions" style="margin-top: 0.5rem;">
        <a class="btn-secondary" href="${homework}" target="_blank" rel="noopener">View Homework</a>
        <span class="pill-tag">Due: ${formatDate(due)}</span>
      </div>
    `;
	}

	function applyFilters(option, list) {
		switch (option) {
			case "classes":
				return list.filter((item) => item.class);
			case "no-school":
				return list.filter((item) => !item.class);
			default:
				return list;
		}
	}

	function formatDate(iso) {
		if (!iso) return "TBA";
		const date = new Date(iso + "T00:00:00");
		return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
	}
});
