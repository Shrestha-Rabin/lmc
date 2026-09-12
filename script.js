const input = document.getElementById("search");
const clearBtn = document.getElementById("clear");
const status = document.getElementById("status");
const app = document.getElementById("app");

let dataset = null;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlight(value, query) {
  const text = String(value ?? "");

  if (!query) {
    return escapeHtml(text);
  }

  const terms = query
    .normalize("NFC")
    .split(/\s+/u)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!terms.length) {
    return escapeHtml(text);
  }

  const pattern = terms
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const regex = new RegExp(pattern, "giu");

  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    result += `<mark>${escapeHtml(match[0])}</mark>`;
    lastIndex = regex.lastIndex;

    // Prevent infinite loops with zero-length matches.
    if (regex.lastIndex === match.index) {
      regex.lastIndex++;
    }
  }

  result += escapeHtml(text.slice(lastIndex));

  return result;
}

function rowMatchesSearch(row, query) {
  if (!query) {
    return true;
  }

  const searchText = normalizeText(row.join(" "));

  const terms = query
    .split(/\s+/u)
    .filter(Boolean);

  return terms.every(term => searchText.includes(term));
}

function renderTables() {
  app.innerHTML = "";

  dataset.tables.forEach((tableData, tableIndex) => {
    const section = document.createElement("section");
    section.className = "section";

    // Use the index as an additional reliable identifier.
    section.dataset.tableIndex = tableIndex;

    if (tableData.title) {
      const h2 = document.createElement("h2");
      h2.textContent = tableData.title;
      section.appendChild(h2);
    }

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";

    const table = document.createElement("table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    tableData.headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    tableData.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");

      tr.dataset.rowIndex = rowIndex;
      tr.dataset.searchText = normalizeText(row.join(" "));

      row.forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    section.appendChild(wrap);
    app.appendChild(section);
  });

  runSearch();
}

function runSearch() {
  if (!dataset) {
    return;
  }

  const query = normalizeText(input.value);

  let matchedRows = 0;
  let visibleTables = 0;

  document.querySelectorAll(".section").forEach((section) => {
    const tableIndex = Number(section.dataset.tableIndex);
    const tableData = dataset.tables[tableIndex];

    let tableHasMatch = false;

    section.querySelectorAll("tbody tr").forEach((row) => {
      const rowIndex = Number(row.dataset.rowIndex);
      const original = tableData.rows[rowIndex];

      const matches = rowMatchesSearch(original, query);

      row.classList.toggle("hidden", !matches);

      if (matches) {
        tableHasMatch = true;
        matchedRows++;

        const cells = row.querySelectorAll("td");

        cells.forEach((cell, i) => {
          if (query) {
            cell.innerHTML = highlight(original[i], query);
          } else {
            cell.textContent = original[i];
          }
        });
      }
    });

    section.classList.toggle("hidden", !tableHasMatch);

    if (tableHasMatch) {
      visibleTables++;
    }
  });

  if (!query) {
    status.textContent =
      `${matchedRows} items in ${dataset.tables.length} tables`;
  } else {
    status.textContent = matchedRows
      ? `${matchedRows} matched item(s) in ${visibleTables} table(s)`
      : `No items found for “${input.value}”`;
  }
}

async function loadData() {
  try {
    const files = [
      "data/business.json",
      "data/bill1.json",
      "data/bill2.json"
      // if want to add more data, load here, for example: "data/bill3.json"
    ];

    const responses = await Promise.all(
      files.map(file =>
        fetch(file, {
          cache: "no-store"
        })
      )
    );

    responses.forEach((response, index) => {
      if (!response.ok) {
        throw new Error(
          `Could not load ${files[index]}: HTTP ${response.status}`
        );
      }
    });

    const tables = await Promise.all(
      responses.map(response => response.json())
    );

    dataset = {
      tables
    };

    renderTables();

  } catch (error) {
    app.innerHTML = "";

    const message = document.createElement("div");
    message.className = "message";

    message.innerHTML =
      "<strong>Could not load JSON files.</strong><br>" +
      "Make sure all JSON files exist and the project is running through a web server.";

    app.appendChild(message);

    status.textContent = "Data could not be loaded";

    console.error(error);
  }
}

input.addEventListener("input", runSearch);

clearBtn.addEventListener("click", () => {
  input.value = "";
  runSearch();
  input.focus();
});

loadData();
