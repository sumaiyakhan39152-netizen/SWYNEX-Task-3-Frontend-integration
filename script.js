const API_URL = "http://127.0.0.1:5000/tasks";

let allTasks = [];
let activeFilter = "all";
let searchQuery = "";

const $ = id => document.getElementById(id);

function isCompleted(task) {
    return String(task.status || "").toLowerCase() === "completed";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#039;"
    })[char]);
}

function showMessage(message, success = true) {
    let box = $("messageBox");

    if (!box) {
        box = document.createElement("div");
        box.id = "messageBox";
        box.style.cssText =
            "position:fixed;top:20px;right:20px;padding:14px 20px;" +
            "background:#25213b;color:white;border-radius:10px;z-index:9999;";
        document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.borderLeft = success
        ? "4px solid #28a879"
        : "4px solid #e05252";
    box.style.display = "block";

    setTimeout(() => box.style.display = "none", 3000);
}

// LOAD TASKS
async function loadTasks() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Failed to load tasks");

        const data = await response.json();
        allTasks = Array.isArray(data) ? data : (data.tasks || []);

        updateDashboard();
        renderTasks();
        renderRecentTasks();
        renderSubjects();

    } catch (error) {
        console.error(error);
        showMessage("Backend connection failed.", false);

        if ($("taskList")) {
            $("taskList").innerHTML =
                '<p class="empty-state">Unable to load tasks.</p>';
        }
    }
}

// ADD TASK
async function addTask(title, subject) {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, subject })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Add failed");

        showMessage("Task added successfully!");
        await loadTasks();
        return true;

    } catch (error) {
        showMessage(error.message, false);
        return false;
    }
}

// COMPLETE / UNDO
async function toggleTask(id) {
    const task = allTasks.find(item => String(item.id) === String(id));
    if (!task) return showMessage("Task not found.", false);

    const newStatus = isCompleted(task) ? "Pending" : "Completed";

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Update failed");

        showMessage("Task updated successfully!");
        await loadTasks();

    } catch (error) {
        console.error(error);
        showMessage(error.message, false);
    }
}

// DELETE TASK
async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Delete failed");

        showMessage("Task deleted successfully!");
        await loadTasks();

    } catch (error) {
        showMessage(error.message, false);
    }
}

window.toggleTask = toggleTask;
window.deleteTask = deleteTask;

// FILTER + SEARCH
function getVisibleTasks() {
    return allTasks.filter(task => {
        const matchesFilter =
            activeFilter === "all" ||
            (activeFilter === "pending" && !isCompleted(task)) ||
            (activeFilter === "completed" && isCompleted(task));

        const text = (
            String(task.title || "") + " " +
            String(task.subject || "")
        ).toLowerCase();

        return matchesFilter && text.includes(searchQuery);
    });
}

function renderTasks() {
    const container = $("taskList");
    if (!container) return;

    const visibleTasks = getVisibleTasks();

    if (visibleTasks.length === 0) {
        container.innerHTML =
            '<p class="empty-state">No matching tasks found.</p>';
        return;
    }

    container.innerHTML = visibleTasks.map(task => {
        const completed = isCompleted(task);

        return `
            <div class="task-card">
                <div class="task-info">
                    <h3>${escapeHTML(task.title)}</h3>
                    <p>${escapeHTML(task.subject || "General")}</p>
                    <span class="task-status ${completed ? "completed" : "pending"}">
                        ${completed ? "Completed" : "Pending"}
                    </span>
                </div>

                <div class="task-actions">
                    <button type="button" class="complete-btn"
                        onclick="toggleTask(${Number(task.id)})">
                        ${completed ? "Undo" : "Complete"}
                    </button>

                    <button type="button" class="delete-btn"
                        onclick="deleteTask(${Number(task.id)})">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// FILTER BUTTONS
function setupFilters() {
    const buttons = document.querySelectorAll(
        "button, [role='button'], a"
    );

    buttons.forEach(button => {
        const label = button.textContent.trim().toLowerCase();

        if (!["all", "pending", "completed"].includes(label)) return;

        button.addEventListener("click", event => {
            event.preventDefault();

            activeFilter = label;
            renderTasks();

            buttons.forEach(item => {
                const itemLabel = item.textContent.trim().toLowerCase();
                if (["all", "pending", "completed"].includes(itemLabel)) {
                    item.classList.toggle("active", item === button);
                }
            });
        });
    });
}

// RECENT TASKS
function renderRecentTasks() {
    const container = $("recentTasks");
    if (!container) return;

    const recent = [...allTasks].slice(-5).reverse();

    if (recent.length === 0) {
        container.innerHTML =
            '<p class="empty-state">No recent tasks yet.</p>';
        return;
    }

    container.innerHTML = recent.map(task => `
        <div class="task-card">
            <div class="task-info">
                <h3>${escapeHTML(task.title)}</h3>
                <p>${escapeHTML(task.subject || "General")}</p>
            </div>
            <span class="task-status ${isCompleted(task) ? "completed" : "pending"}">
                ${isCompleted(task) ? "Completed" : "Pending"}
            </span>
        </div>
    `).join("");
}

// DASHBOARD COUNTS
function updateDashboard() {
    const total = allTasks.length;
    const completed = allTasks.filter(isCompleted).length;
    const pending = total - completed;
    const progress = total ? Math.round(completed / total * 100) : 0;

    if ($("totalTasks")) $("totalTasks").textContent = total;
    if ($("completedTasks")) $("completedTasks").textContent = completed;
    if ($("pendingTasks")) $("pendingTasks").textContent = pending;
    if ($("progressText")) $("progressText").textContent = progress + "%";
    if ($("progressBar")) $("progressBar").style.width = progress + "%";
}

// ANALYTICS
function renderSubjects() {
    const container = $("subjectList") || $("subjectsList");
    if (!container) return;

    const subjects = {};

    allTasks.forEach(task => {
        const subject = task.subject || "General";
        subjects[subject] = (subjects[subject] || 0) + 1;
    });

    const entries = Object.entries(subjects);

    if (!entries.length) {
        container.innerHTML =
            '<p class="empty-state">No analytics available yet.</p>';
        return;
    }

    container.innerHTML = entries.map(([subject, count]) => `
        <div class="subject-item">
            <span>${escapeHTML(subject)}</span>
            <strong>${count} tasks</strong>
        </div>
    `).join("");
}

// SEARCH
function setupSearch() {
    const input = $("searchInput");
    if (!input) return;

    input.addEventListener("input", () => {
        searchQuery = input.value.toLowerCase().trim();
        renderTasks();
    });
}

// CREATE TASK FORM
function setupCreateForm() {
    const form = $("createTaskForm") || $("taskForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const titleInput = $("taskTitle") ||
            $("titleInput") ||
            form.querySelector('[name="title"]');

        const subjectInput = $("taskSubject") ||
            $("subjectInput") ||
            form.querySelector('[name="subject"]');

        const title = titleInput?.value.trim();
        const subject = subjectInput?.value.trim();

        if (!title || !subject) {
            showMessage("Please enter title and subject.", false);
            return;
        }

        if (await addTask(title, subject)) {
            form.reset();
        }
    });
}

// DARK MODE
function setupDarkMode() {
    const button = $("darkModeToggle");
    if (!button) return;

    if (localStorage.getItem("studyflow-dark") === "true") {
        document.body.classList.add("dark-mode");
    }

    button.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");

        localStorage.setItem(
            "studyflow-dark",
            document.body.classList.contains("dark-mode")
        );
    });
}

// START
document.addEventListener("DOMContentLoaded", () => {
    setupCreateForm();
    setupSearch();
    setupFilters();
    setupDarkMode();
    loadTasks();
});