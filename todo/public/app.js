const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");
const tagFilter = document.getElementById("tag-filter");
const tagListEl = document.getElementById("tag-list");

let currentTagFilter = null;
let allTodos = [];
let draggedItem = null;

function extractTags(title) {
  const matches = title.match(/#[a-zA-Z0-9_-]+/g);
  return matches ? matches.map(tag => tag.slice(1)) : [];
}

function filterByTag(tag) {
  currentTagFilter = tag;
  fetchTodos();
}

function clearFilter() {
  currentTagFilter = null;
  fetchTodos();
}

async function fetchTodos() {
  const response = await fetch("/api/todos");
  allTodos = await response.json();

  renderTagList();

  let displayTodos = allTodos;
  if (currentTagFilter) {
    displayTodos = allTodos.filter(todo =>
      (todo.tags || extractTags(todo.title)).includes(currentTagFilter)
    );
  }
  renderTodos(displayTodos);
}

function renderTagList() {
  const tagCounts = {};

  allTodos.forEach(todo => {
    const tags = todo.tags || extractTags(todo.title);
    tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const sortedTags = Object.keys(tagCounts).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  tagListEl.innerHTML = "";

  if (sortedTags.length === 0) {
    const emptyMsg = document.createElement("li");
    emptyMsg.textContent = "No tags yet";
    emptyMsg.style.color = "#999";
    emptyMsg.style.cursor = "default";
    tagListEl.appendChild(emptyMsg);
    return;
  }

  sortedTags.forEach(tag => {
    const li = document.createElement("li");
    if (currentTagFilter === tag) {
      li.className = "active";
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "tag-name";
    nameSpan.textContent = `#${tag}`;

    const countSpan = document.createElement("span");
    countSpan.className = "tag-count";
    countSpan.textContent = tagCounts[tag];

    li.appendChild(nameSpan);
    li.appendChild(countSpan);

    li.addEventListener("click", () => {
      if (currentTagFilter === tag) {
        currentTagFilter = null;
      } else {
        currentTagFilter = tag;
      }
      fetchTodos();
    });

    tagListEl.appendChild(li);
  });
}

function renderTodos(todos) {
  todoList.innerHTML = "";

  // Update filter indicator
  tagFilter.innerHTML = "";
  if (currentTagFilter) {
    const filterText = document.createElement("span");
    filterText.innerHTML = `Filtering by: <strong>#${currentTagFilter}</strong>`;
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => {
      currentTagFilter = null;
      fetchTodos();
    });
    tagFilter.appendChild(filterText);
    tagFilter.appendChild(clearBtn);
    tagFilter.classList.remove("hidden");
  } else {
    tagFilter.classList.add("hidden");
  }

  if (todos.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  const canDrag = !currentTagFilter;

  todos.forEach((todo) => {
    const li = document.createElement("li");
    li.className = `todo-item${todo.completed ? " completed" : ""}`;
    li.dataset.id = todo.id;

    // Drag handle
    const dragHandle = document.createElement("span");
    dragHandle.className = "drag-handle";
    dragHandle.textContent = "\u2261";
    if (canDrag) {
      li.draggable = true;
      li.addEventListener("dragstart", handleDragStart);
      li.addEventListener("dragend", handleDragEnd);
      li.addEventListener("dragover", handleDragOver);
      li.addEventListener("drop", handleDrop);
      li.addEventListener("dragenter", handleDragEnter);
      li.addEventListener("dragleave", handleDragLeave);
    } else {
      dragHandle.classList.add("disabled");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => toggleTodo(todo.id, !todo.completed));

    const titleContainer = document.createElement("span");
    titleContainer.className = "todo-title";
    titleContainer.addEventListener("dblclick", () => startEdit(li, todo));

    // Extract text without tags and render separately
    const tags = todo.tags || extractTags(todo.title);
    const textWithoutTags = todo.title.replace(/#[a-zA-Z0-9_-]+/g, "").trim();

    const textSpan = document.createElement("span");
    textSpan.className = "todo-text";
    textSpan.textContent = textWithoutTags;
    titleContainer.appendChild(textSpan);

    // Render tags as clickable badges
    tags.forEach((tag) => {
      const tagSpan = document.createElement("span");
      tagSpan.className = "tag";
      tagSpan.textContent = `#${tag}`;
      tagSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        filterByTag(tag);
      });
      titleContainer.appendChild(tagSpan);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "\u00d7";
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    li.appendChild(dragHandle);
    li.appendChild(checkbox);
    li.appendChild(titleContainer);
    li.appendChild(deleteBtn);
    todoList.appendChild(li);
  });
}

async function addTodo(title) {
  const response = await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (response.ok) {
    fetchTodos();
  }
}

async function toggleTodo(id, completed) {
  const response = await fetch(`/api/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });

  if (response.ok) {
    fetchTodos();
  }
}

async function deleteTodo(id) {
  const response = await fetch(`/api/todos/${id}`, {
    method: "DELETE",
  });

  if (response.ok) {
    fetchTodos();
  }
}

async function editTodo(id, title) {
  const response = await fetch(`/api/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (response.ok) {
    fetchTodos();
  }
}

function startEdit(todoItem, todo) {
  const titleContainer = todoItem.querySelector(".todo-title");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = todo.title;

  let saving = false;

  const saveEdit = () => {
    if (saving) return;
    saving = true;
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== todo.title) {
      editTodo(todo.id, newTitle);
    } else {
      fetchTodos();
    }
  };

  const cancelEdit = () => {
    fetchTodos();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  });

  input.addEventListener("blur", saveEdit);

  titleContainer.innerHTML = "";
  titleContainer.appendChild(input);
  input.focus();
  input.select();
}

function handleDragStart(e) {
  draggedItem = this;
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function handleDragEnd() {
  this.classList.remove("dragging");
  draggedItem = null;
  document.querySelectorAll(".todo-item").forEach(item => {
    item.classList.remove("drag-over");
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleDragEnter(e) {
  e.preventDefault();
  if (this !== draggedItem) {
    this.classList.add("drag-over");
  }
}

function handleDragLeave() {
  this.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");

  if (this === draggedItem) return;

  const items = Array.from(todoList.querySelectorAll(".todo-item"));
  const draggedIndex = items.indexOf(draggedItem);
  const dropIndex = items.indexOf(this);

  if (draggedIndex < dropIndex) {
    this.parentNode.insertBefore(draggedItem, this.nextSibling);
  } else {
    this.parentNode.insertBefore(draggedItem, this);
  }

  saveOrder();
}

async function saveOrder() {
  const items = Array.from(todoList.querySelectorAll(".todo-item"));
  const orderedIds = items.map(item => parseInt(item.dataset.id, 10));

  await fetch("/api/todos/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });

  // Update allTodos to reflect new order
  const response = await fetch("/api/todos");
  allTodos = await response.json();
}

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = todoInput.value.trim();
  if (title) {
    addTodo(title);
    todoInput.value = "";
  }
});

fetchTodos();
