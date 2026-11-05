// app.js - CampusEats Frontend Logic
// Fetches item catalogue via GET /items and creates new records via POST /items

document.addEventListener('DOMContentLoaded', () => {
  const itemsContainer = document.getElementById('items-container');
  const itemsBadge = document.getElementById('items-badge');
  const addItemForm = document.getElementById('add-item-form');
  const refreshBtn = document.getElementById('refresh-btn');
  const alertBanner = document.getElementById('alert-banner');
  const lookupBtn = document.getElementById('lookup-btn');
  const lookupIdInput = document.getElementById('lookup-id');
  const lookupResult = document.getElementById('lookup-result');

  // Helper: Display floating notification banner
  function showAlert(message, type = 'success', durationMs = 4500) {
    alertBanner.className = `alert-banner ${type}`;
    alertBanner.innerHTML = `
      <span>${type === 'success' ? '✅' : '⚠️'} ${message}</span>
      <button style="background:none;border:none;cursor:pointer;font-size:16px;" onclick="this.parentElement.style.display='none'">&times;</button>
    `;
    alertBanner.style.display = 'flex';

    clearTimeout(alertBanner.dataset.timeoutId);
    const timeoutId = setTimeout(() => {
      alertBanner.style.display = 'none';
    }, durationMs);
    alertBanner.dataset.timeoutId = timeoutId;
  }

  // 1. Fetch all items (GET /items)
  async function fetchItems() {
    try {
      itemsContainer.innerHTML = '<div class="loading-state">Refreshing catalogue...</div>';
      const response = await fetch('/items');

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const items = await response.json();
      renderItems(items);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      itemsContainer.innerHTML = `
        <div class="empty-state">
          <p>⚠️ Failed to load catalogue: ${err.message}</p>
          <button class="btn btn-outline" style="margin-top:10px;" onclick="location.reload()">Retry</button>
        </div>
      `;
      itemsBadge.textContent = 'Error';
    }
  }

  // Helper: Render items into cards
  function renderItems(items) {
    itemsBadge.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;

    if (!items || items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="empty-state">
          <p>No items found in the catalogue. Add one using the form on the left!</p>
        </div>
      `;
      return;
    }

    itemsContainer.innerHTML = items.map(item => `
      <article class="item-card" data-id="${item.id}">
        <div>
          <div class="item-card-top">
            <span class="item-id-pill">#${item.id}</span>
            <span class="item-category-tag">${escapeHtml(item.category || 'General')}</span>
          </div>
          <h3 class="item-name">${escapeHtml(item.name)}</h3>
        </div>
        <div class="item-card-bottom">
          <span class="item-price">₹${Number(item.price).toFixed(0)}</span>
          <span class="badge ${item.available ? 'badge-available' : 'badge-unavailable'}">
            ${item.available ? '● Available' : '○ Sold Out'}
          </span>
        </div>
      </article>
    `).join('');
  }

  // 2. Submit form to create new item (POST /items)
  addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('item-name');
    const priceInput = document.getElementById('item-price');
    const categoryInput = document.getElementById('item-category');
    const availableInput = document.getElementById('item-available');
    const submitBtn = document.getElementById('submit-btn');

    const name = nameInput.value.trim();
    const price = priceInput.value !== '' ? Number(priceInput.value) : undefined;
    const category = categoryInput.value;
    const available = availableInput.checked;

    // Quick client-side check to assist user
    if (!name || price === undefined || isNaN(price)) {
      showAlert('Please fill in both Name and Price.', 'error');
      return;
    }

    const payload = { name, price, category, available };

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Adding...</span>';

      const response = await fetch('/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 201) {
        showAlert(`Item "${data.name}" added successfully! (HTTP 201 Created)`, 'success');
        addItemForm.reset();
        document.getElementById('item-available').checked = true;
        // Refresh items list
        await fetchItems();
      } else if (response.status === 422) {
        showAlert(`Validation Failed (HTTP 422): ${data.error || 'Invalid payload'}`, 'error');
      } else {
        showAlert(`Error (HTTP ${response.status}): ${data.error || 'Server error'}`, 'error');
      }
    } catch (err) {
      console.error('POST /items failed:', err);
      showAlert(`Network error: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Add to Menu Catalogue</span><span class="btn-arrow">&rarr;</span>';
    }
  });

  // 3. Single Item Lookup (GET /items/:id)
  lookupBtn.addEventListener('click', async () => {
    const id = lookupIdInput.value.trim();
    if (!id) {
      lookupResult.innerHTML = '<div class="lookup-card error">Please enter an item ID.</div>';
      return;
    }

    try {
      lookupResult.innerHTML = '<div class="lookup-card">Fetching item #' + escapeHtml(id) + '...</div>';
      const response = await fetch(`/items/${encodeURIComponent(id)}`);
      const data = await response.json();

      if (response.status === 200) {
        lookupResult.innerHTML = `
          <div class="lookup-card success">
            <strong>HTTP 200 OK:</strong> #${data.id} - <strong>${escapeHtml(data.name)}</strong> (₹${data.price}) &bull;
            <em>${data.available ? 'In Stock' : 'Out of Stock'}</em> [${escapeHtml(data.category || 'General')}]
          </div>
        `;
      } else if (response.status === 404) {
        lookupResult.innerHTML = `
          <div class="lookup-card error">
            <strong>HTTP 404 Not Found:</strong> ${escapeHtml(data.error || 'Item not found')}
          </div>
        `;
      } else {
        lookupResult.innerHTML = `
          <div class="lookup-card error">
            <strong>HTTP ${response.status}:</strong> ${escapeHtml(data.error || 'Unexpected response')}
          </div>
        `;
      }
    } catch (err) {
      lookupResult.innerHTML = `<div class="lookup-card error">Request failed: ${escapeHtml(err.message)}</div>`;
    }
  });

  // Refresh button event listener
  refreshBtn.addEventListener('click', () => {
    fetchItems();
  });

  // Helper: Basic HTML escaping to prevent XSS
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load
  fetchItems();
});
