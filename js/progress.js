// js/progress.js

document.addEventListener("DOMContentLoaded", () => {
	const form = document.getElementById("progress-form");
	const statusEl = document.getElementById("progress-status");
	const resultSection = document.getElementById("progress-result");
	const summaryEl = document.getElementById("progress-summary");
	const progressTableBody = document.querySelector("#progress-table tbody");
	const categoryTableBody = document.querySelector("#category-table tbody");
	const commentsCard = document.getElementById("comments-card");
	const headingEl = document.getElementById("student-heading");
	const subheadingEl = document.getElementById("student-subheading");
	const recordFilterTypeSelect = document.getElementById("record-filter-type");
	const sessionTimerEl = document.getElementById("session-timer");

	const SHEET_CSV_URL =
		"https://docs.google.com/spreadsheets/d/e/2PACX-1vTyQUGq3_eYNkqU_-DrOTcaMlEW6Vkk2BL8dVS7p4W0-r0103YHwx8OJYwrTb1ykf1eYfUwavbccIBK/pub?gid=0&single=true&output=csv";
	const COMMENTS_CSV_URL =
		"https://docs.google.com/spreadsheets/d/e/2PACX-1vTyQUGq3_eYNkqU_-DrOTcaMlEW6Vkk2BL8dVS7p4W0-r0103YHwx8OJYwrTb1ykf1eYfUwavbccIBK/pub?gid=1495378420&single=true&output=csv";

	const SESSION_KEY = "specialArabicProgressSession";
	const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

	let gradingConfig = null;
	let allRecordsForFilters = [];
	let sessionExpireAt = null;
	let timerIntervalId = null;

	// ----- Event wiring -----

	form.addEventListener("submit", (e) => {
		e.preventDefault();

		const lastNameInput = document.getElementById("last-name").value.trim();
		const month = document.getElementById("dob-month").value;
		const day = document.getElementById("dob-day").value.trim();
		const year = document.getElementById("dob-year").value.trim();

		if (!lastNameInput || !month || !day || !year) {
			statusEl.textContent = "Please fill in all fields.";
			return;
		}

		const dob = buildDob(year, month, day);
		if (!dob) {
			statusEl.textContent = "Invalid date of birth. Please check the day, month, and year.";
			return;
		}

		handleLookup(lastNameInput, dob, false, null);
	});

	if (recordFilterTypeSelect) {
		recordFilterTypeSelect.addEventListener("change", () => {
			applyRecordFilters();
		});
	}

	// Try to restore a recent session on load
	tryRestoreSession();

	// ----- Core lookup workflow -----

	async function handleLookup(lastNameInput, dob, fromRestore, restoreExpiresAt) {
		resetUI();

		try {
			statusEl.textContent = "Looking up student…";

			const [student, grading] = await Promise.all([findStudent(lastNameInput, dob), loadGradingConfig()]);

			gradingConfig = grading;

			if (!student) {
				statusEl.textContent = "We could not find a student with that last name and date of birth. Please double-check and try again.";
				if (fromRestore) clearSession();
				return;
			}

			statusEl.textContent = "Loading progress from gradebook…";

			const [records, comments] = await Promise.all([
				fetchStudentRecords(student, SHEET_CSV_URL),
				fetchStudentComments(student, COMMENTS_CSV_URL),
			]);

			renderAll(student, records, comments);
			statusEl.textContent = "";
			resultSection.classList.remove("hidden");

			if (fromRestore && restoreExpiresAt) {
				sessionExpireAt = restoreExpiresAt;
				startSessionTimer();
			} else {
				saveSession(lastNameInput, dob);
			}
		} catch (err) {
			console.error(err);
			statusEl.textContent = "Something went wrong while loading progress. Please refresh and try again.";
			if (fromRestore) clearSession();
		}
	}

	function resetUI() {
		statusEl.textContent = "";
		summaryEl.innerHTML = "";
		progressTableBody.innerHTML = "";
		categoryTableBody.innerHTML = "";
		commentsCard.innerHTML = "";
		headingEl.textContent = "Progress for …";
		subheadingEl.textContent = "";
		resultSection.classList.add("hidden");
		allRecordsForFilters = [];
	}

	// ----- Session helpers -----

	function saveSession(lastName, dob) {
		const now = Date.now();
		const payload = {
			lastName,
			dob,
			createdAt: now,
			expiresAt: now + SESSION_TTL_MS,
		};
		sessionExpireAt = payload.expiresAt;
		localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
		startSessionTimer();
	}

	function clearSession() {
		localStorage.removeItem(SESSION_KEY);
		sessionExpireAt = null;
		if (timerIntervalId) {
			clearInterval(timerIntervalId);
			timerIntervalId = null;
		}
		if (sessionTimerEl) {
			sessionTimerEl.textContent = "";
		}
	}

	function startSessionTimer() {
		if (!sessionTimerEl || !sessionExpireAt) return;
		if (timerIntervalId) clearInterval(timerIntervalId);

		updateSessionTimerText();
		timerIntervalId = setInterval(() => {
			const remaining = sessionExpireAt - Date.now();
			if (remaining <= 0) {
				clearInterval(timerIntervalId);
				timerIntervalId = null;
				sessionTimerEl.textContent = "Session expired. Please search again to refresh.";
				clearSession();
				resetUI();
				return;
			}
			updateSessionTimerText();
		}, 1000);
	}

	function updateSessionTimerText() {
		const remaining = sessionExpireAt - Date.now();
		const totalSec = Math.max(0, Math.floor(remaining / 1000));
		const mins = Math.floor(totalSec / 60);
		const secs = totalSec % 60;
		sessionTimerEl.textContent = `Session will reset in ${mins}:${secs.toString().padStart(2, "0")}`;
	}

	function tryRestoreSession() {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return;

		let data;
		try {
			data = JSON.parse(raw);
		} catch {
			clearSession();
			return;
		}

		if (!data.expiresAt || Date.now() > data.expiresAt) {
			clearSession();
			return;
		}

		// Prefill form
		const lastInput = document.getElementById("last-name");
		const monthEl = document.getElementById("dob-month");
		const dayEl = document.getElementById("dob-day");
		const yearEl = document.getElementById("dob-year");

		if (lastInput) lastInput.value = data.lastName || "";
		if (data.dob) {
			const [y, m, d] = data.dob.split("-");
			if (yearEl && y) yearEl.value = y;
			if (monthEl && m) monthEl.value = String(Number(m)); // strip leading 0
			if (dayEl && d) dayEl.value = String(Number(d));
		}

		// Auto-load quietly
		handleLookup(data.lastName, data.dob, true, data.expiresAt);
	}

	// ----- Data helpers -----

	function buildDob(year, month, day) {
		const y = Number(year);
		const m = Number(month);
		const d = Number(day);
		if (!y || !m || !d) return null;

		const date = new Date(y, m - 1, d);
		if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
			return null;
		}

		const mm = String(m).padStart(2, "0");
		const dd = String(d).padStart(2, "0");
		return `${y}-${mm}-${dd}`;
	}

	async function findStudent(lastName, dob) {
		const response = await fetch("data/students.json");
		if (!response.ok) throw new Error("Failed to load students.json");
		const students = await response.json();

		const ln = lastName.toLowerCase();
		return students.find((s) => s.last_name.toLowerCase() === ln && String(s.dob) === dob);
	}

	async function loadGradingConfig() {
		const response = await fetch("data/grading.json");
		if (!response.ok) throw new Error("Failed to load grading.json");
		return response.json();
	}

	async function fetchStudentRecords(student, csvUrl) {
		const response = await fetch(csvUrl);
		if (!response.ok) throw new Error("Failed to download grade sheet CSV");
		const text = await response.text();
		const rows = parseCsv(text);

		if (!rows || rows.length < 5) return [];

		const headerRow = rows[0]; // dates
		const typeRow = rows[1]; // Attendance/Homework/Quiz/Test
		const titleRow = rows[2]; // titles
		const includeRow = rows[3]; // TRUE/FALSE
		const nameColIndex = 0;

		const studentFullName = `${student.first_name} ${student.last_name}`.toLowerCase();

		const studentRow = rows.find((row, idx) => {
			if (idx < 4) return false; // skip header rows
			const cell = (row[nameColIndex] || "").toString().trim();
			if (!cell) return false;
			const baseName = cell.split("(")[0].trim(); // remove "(2A)"
			return baseName.toLowerCase() === studentFullName;
		});

		if (!studentRow) {
			throw new Error("Student not found in grade sheet");
		}

		const records = [];

		for (let col = 1; col < headerRow.length; col++) {
			const includeFlag = (includeRow[col] || "").toString().trim().toUpperCase();
			if (includeFlag !== "TRUE") continue; // skip hidden columns

			const rawDate = headerRow[col];
			const rawType = (typeRow[col] || "").toString().trim();
			const title = (titleRow[col] || "").toString().trim();
			const value = (studentRow[col] || "").toString().trim();

			if (!rawDate && !rawType && !title && !value) continue;

			const type = rawType.toLowerCase();
			const category = type === "attendance" || type === "homework" || type === "quiz" || type === "test" ? type : "other";

			const numericScore = toNumericScore(category, value);
			const dateStr = formatSheetDate(rawDate);

			records.push({
				date: dateStr,
				type: capitalize(type || "N/A"),
				category,
				title,
				rawValue: value,
				numericScore,
			});
		}

		return records;
	}

	async function fetchStudentComments(student, csvUrl) {
		const response = await fetch(csvUrl);
		if (!response.ok) throw new Error("Failed to download comments CSV");
		const text = await response.text();
		const rows = parseCsv(text);
		if (!rows || rows.length === 0) return [];

		const studentFullName = `${student.first_name} ${student.last_name}`.toLowerCase();

		const header = rows[0].map((c) => c.toLowerCase());
		const nameIdx = header.indexOf("student name");
		const dateIdx = header.indexOf("date");
		const commentIdx = header.indexOf("comment");

		if (nameIdx === -1 || dateIdx === -1 || commentIdx === -1) return [];

		const comments = rows
			.slice(1)
			.filter((row) => {
				const cell = (row[nameIdx] || "").toString().trim();
				if (!cell) return false;
				const baseName = cell.split("(")[0].trim();
				return baseName.toLowerCase() === studentFullName;
			})
			.map((row) => ({
				date: row[dateIdx] || "",
				comment: row[commentIdx] || "",
			}));

		return comments;
	}

	function parseCsv(text) {
		return text
			.trim()
			.split(/\r?\n/)
			.map((line) => line.split(","));
	}

	function formatSheetDate(raw) {
		if (!raw) return "";
		return raw; // already like "12/7/2025"
	}

	function capitalize(str) {
		if (!str) return "";
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	function toNumericScore(category, value) {
		if (!value) return null;

		if (category === "attendance") {
			const v = value.trim().toUpperCase();
			if (v === "Y") return 100;
			if (v === "N") return 0;
			return null;
		}

		const n = Number(value);
		if (!Number.isNaN(n)) {
			return n; // assume 0–100
		}

		const v = value.trim().toUpperCase();
		if (v === "E") return 95;
		if (v === "M") return 80;
		if (v === "P") return 60;

		return null;
	}

	// ----- Rendering -----

	function renderAll(student, records, comments) {
		headingEl.textContent = `Progress for ${student.first_name} ${student.last_name}`;
		subheadingEl.textContent = `Last updated: ${new Date().toLocaleDateString()}`;

		if (!records || records.length === 0) {
			summaryEl.innerHTML = "<p>No grade entries recorded yet.</p>";
			return;
		}

		const stats = computeCategoryStats(records, gradingConfig.weights);
		const overall = computeOverall(stats, gradingConfig.weights);
		const gradeInfo = mapScoreToScale(overall.score, gradingConfig.scale);

		allRecordsForFilters = records;

		renderSummaryCard(overall, gradeInfo);
		renderCategoryTable(stats, gradingConfig.weights, gradingConfig.scale);
		applyRecordFilters();
		renderComments(comments);
	}

	function computeCategoryStats(records, weights) {
		const stats = {};

		Object.keys(weights).forEach((cat) => {
			stats[cat] = { total: 0, count: 0 };
		});

		records.forEach((r) => {
			const cat = r.category;
			if (!weights[cat]) return;
			if (r.numericScore == null) return;
			stats[cat].total += r.numericScore;
			stats[cat].count += 1;
		});

		Object.keys(stats).forEach((cat) => {
			const s = stats[cat];
			if (s.count === 0) {
				s.avg = null;
			} else {
				s.avg = s.total / s.count / 100;
			}
		});

		return stats;
	}

	function computeOverall(stats, weights) {
		let weightedSum = 0;
		let totalWeightUsed = 0;

		Object.entries(weights).forEach(([cat, w]) => {
			const s = stats[cat];
			if (!s || s.avg == null) return;
			weightedSum += s.avg * w;
			totalWeightUsed += w;
		});

		if (totalWeightUsed === 0) {
			return { score: 0, percent: 0 };
		}

		const score = weightedSum / totalWeightUsed;
		return {
			score,
			percent: Math.round(score * 100),
		};
	}

	function mapScoreToScale(score, scale) {
		const s = score || 0;
		const sorted = [...scale].sort((a, b) => b.min - a.min);
		for (const level of sorted) {
			if (s >= level.min) return level;
		}
		return sorted[sorted.length - 1];
	}

	function renderSummaryCard(overall, gradeInfo) {
		const badgeClass = `badge-grade badge-${gradeInfo.label}`;
		summaryEl.innerHTML = `
      <h3>Overall Progress</h3>
      <p>
        <span class="${badgeClass}">${gradeInfo.label}</span>
        <span style="margin-left:0.5rem;"><strong>${overall.percent}%</strong> overall</span>
      </p>
      <p class="muted">${gradeInfo.description}</p>
    `;
	}

	function renderCategoryTable(stats, weights, scale) {
		categoryTableBody.innerHTML = "";

		Object.entries(weights).forEach(([cat, w]) => {
			const s = stats[cat];
			const avg = s && s.avg != null ? s.avg : null;
			const percent = avg == null ? null : Math.round(avg * 100);
			const contrib = avg == null ? 0 : avg * w;
			const gradeInfo = avg == null ? null : mapScoreToScale(avg, scale);
			const displayName = capitalize(cat);

			const badge = gradeInfo
				? `<span class="badge-grade badge-${gradeInfo.label}">${gradeInfo.label}</span>`
				: `<span class="badge-grade badge-P">–</span>`;

			const avgText = percent == null ? "N/A" : `${percent}%`;

			const tr = document.createElement("tr");
			tr.innerHTML = `
        <td>${displayName}</td>
        <td>${avgText} ${gradeInfo ? " " + badge : ""}</td>
        <td>${Math.round(w * 100)}%</td>
        <td>${avg == null ? "0%" : Math.round(contrib * 100) + "%"}</td>
      `;
			categoryTableBody.appendChild(tr);
		});
	}

	function applyRecordFilters() {
		if (!allRecordsForFilters || !gradingConfig) return;

		let list = [...allRecordsForFilters];
		const t = recordFilterTypeSelect ? recordFilterTypeSelect.value : "all";

		if (t && t !== "all") {
			list = list.filter((r) => r.category === t);
		}

		renderRecordTable(list, gradingConfig.scale);
	}

	function renderRecordTable(records, scale) {
		progressTableBody.innerHTML = "";

		records.forEach((rec) => {
			const tr = document.createElement("tr");
			const pill = buildStatusPill(rec, scale);

			tr.innerHTML = `
        <td>${rec.date || "&mdash;"}</td>
        <td>${rec.type || "&mdash;"}</td>
        <td>${rec.title || "&mdash;"}</td>
        <td>${pill}</td>
      `;
			progressTableBody.appendChild(tr);
		});
	}

	function buildStatusPill(rec, scale) {
		if (!rec.rawValue) {
			return `<span class="status-pill status-neutral">—</span>`;
		}

		if (rec.category === "attendance") {
			const v = rec.rawValue.trim().toUpperCase();
			if (v === "Y") {
				return `<span class="status-pill status-ok">Present</span>`;
			}
			if (v === "N") {
				return `<span class="status-pill status-bad">Absent</span>`;
			}
			return `<span class="status-pill status-neutral">${rec.rawValue}</span>`;
		}

		if (rec.numericScore == null) {
			return `<span class="status-pill status-neutral">${rec.rawValue}</span>`;
		}

		const score01 = rec.numericScore / 100;
		const gi = mapScoreToScale(score01, scale);
		let cls = "status-neutral";
		if (gi.label === "E") cls = "status-ok";
		else if (gi.label === "M") cls = "status-warn";
		else if (gi.label === "P") cls = "status-bad";

		return `<span class="status-pill ${cls}">${rec.numericScore}% (${gi.label})</span>`;
	}

	function renderComments(comments) {
		if (!comments || comments.length === 0) {
			commentsCard.innerHTML = `<p class="muted">No comments recorded yet.</p>`;
			return;
		}

		const items = comments
			.map(
				(c) => `
        <div class="comment-item">
          <p><strong>${c.date || ""}</strong></p>
          <p>${c.comment}</p>
        </div>
      `
			)
			.join("");

		commentsCard.innerHTML = items;
	}
});
