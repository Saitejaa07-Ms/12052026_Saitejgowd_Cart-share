/* =========================================================
   CartShare - dashboard.js
   Page logic for dashboard.html:
   - Guards the page (must be logged in)
   - Handles room create/join
   - Renders product gallery + category filter
   - Renders cart sidebar + delivery progress
   - Renders activity feed
   - Wires up cross-tab "real-time" sync
   ========================================================= */

const FREE_DELIVERY_THRESHOLD = 75; // matches the $75 example in the brief

let currentUser = null;
let activeRoomCode = null;

document.addEventListener('DOMContentLoaded', () => {

  // --- Auth guard: bounce back to login if no session exists ---
  currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('userGreeting').textContent = `Hi, ${currentUser.name}`;
  document.getElementById('userGreeting').classList.remove('d-none');

  // --- Populate category dropdown dynamically from PRODUCTS ---
  const categories = [...new Set(PRODUCTS.map(p => p.category))];
  const categorySelect = document.getElementById('categoryFilter');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
  categorySelect.addEventListener('change', renderGallery);

  // --- If we already have an active room saved (e.g. page refresh), resume it ---
  const savedCode = getActiveRoomCode();
  if (savedCode && getRoom(savedCode)) {
    enterRoom(savedCode);
  }

  // --- Room gate buttons ---
  document.getElementById('createRoomBtn').addEventListener('click', () => {
    const room = createRoom(currentUser);
    enterRoom(room.code);
  });

  document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
    const errorBox = document.getElementById('joinError');
    errorBox.textContent = '';

    if (!code) {
      errorBox.textContent = 'Please enter a room code.';
      return;
    }
    const room = joinRoom(code, currentUser);
    if (!room) {
      errorBox.textContent = 'No room found with that code.';
      return;
    }
    enterRoom(code);
  });

  // --- Cross-tab live sync: re-render whenever another tab changes this room ---
  onRoomUpdated(() => {
    renderCart();
    renderActivity();
    showToast('Room updated by a teammate.');
  });

});

/* ---------- ROOM ENTRY ---------- */

function enterRoom(code) {
  activeRoomCode = code;
  setActiveRoomCode(code);

  document.getElementById('roomGate').classList.add('d-none');
  document.getElementById('appArea').classList.remove('d-none');

  const badge = document.getElementById('roomBadge');
  badge.textContent = `Room: ${code}`;
  badge.classList.remove('d-none');
  badge.style.cursor = 'pointer';
  badge.title = 'Click to copy room code';
  badge.onclick = () => {
    navigator.clipboard.writeText(code);
    showToast('Room code copied to clipboard!');
  };

  renderGallery();
  renderCart();
  renderActivity();
}

/* ---------- PRODUCT GALLERY ---------- */

function renderGallery() {
  const gallery = document.getElementById('productGallery');
  const filter = document.getElementById('categoryFilter').value;
  gallery.innerHTML = '';

  const visibleProducts = filter === 'all'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === filter);

  visibleProducts.forEach(product => {
    const col = document.createElement('div');
    col.className = 'col-sm-6 col-md-4';
    col.innerHTML = `
      <div class="product-card h-100 shadow-sm">
        <div class="product-emoji">${product.img}</div>
        <div class="fw-semibold">${product.name}</div>
        <div class="text-muted small mb-2">${product.category}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span class="fw-bold">$${product.price.toFixed(2)}</span>
          <button class="btn btn-sm btn-primary" data-id="${product.id}">+ Add</button>
        </div>
      </div>
    `;
    col.querySelector('button').addEventListener('click', () => {
      addToCart(activeRoomCode, product, currentUser);
      renderCart();
      renderActivity();
    });
    gallery.appendChild(col);
  });
}

/* ---------- CART SIDEBAR ---------- */

function renderCart() {
  const room = getRoom(activeRoomCode);
  if (!room) return;

  const cartItemsBox = document.getElementById('cartItems');
  cartItemsBox.innerHTML = '';

  if (room.cart.length === 0) {
    cartItemsBox.innerHTML = '<p class="text-muted small">No items yet. Add something from the catalog!</p>';
  }

  room.cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item d-flex justify-content-between align-items-center mb-2';
    row.innerHTML = `
      <div>
        <div class="small fw-semibold">${item.name}</div>
        <div class="text-muted" style="font-size:0.75rem;">added by ${item.addedBy}</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-outline-secondary" data-id="${item.productId}">−</button>
        <span>${item.qty}</span>
        <span class="fw-semibold" style="min-width:50px; text-align:right;">$${(item.price * item.qty).toFixed(2)}</span>
      </div>
    `;
    row.querySelector('button').addEventListener('click', () => {
      removeFromCart(activeRoomCode, item.productId, currentUser);
      renderCart();
      renderActivity();
    });
    cartItemsBox.appendChild(row);
  });

  const total = getCartTotal(room);
  document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;

  // Delivery threshold progress bar
  const pct = Math.min(100, Math.round((total / FREE_DELIVERY_THRESHOLD) * 100));
  document.getElementById('deliveryBar').style.width = pct + '%';
  document.getElementById('deliveryPct').textContent = pct + '%';

  const note = document.getElementById('deliveryNote');
  if (total >= FREE_DELIVERY_THRESHOLD) {
    note.textContent = '🎉 Free delivery unlocked!';
  } else {
    note.textContent = `$${(FREE_DELIVERY_THRESHOLD - total).toFixed(2)} more for free delivery.`;
  }
}

/* ---------- ACTIVITY FEED ---------- */

function renderActivity() {
  const room = getRoom(activeRoomCode);
  if (!room) return;

  const feed = document.getElementById('activityFeed');
  feed.innerHTML = '';

  room.activity.forEach(entry => {
    const line = document.createElement('div');
    line.className = 'activity-entry';
    line.innerHTML = `<span class="text-muted" style="font-size:0.7rem;">${entry.time}</span><br>${entry.message}`;
    feed.appendChild(line);
  });
}

/* ---------- TOAST NOTIFICATIONS ---------- */

function showToast(message) {
  document.getElementById('toastBody').textContent = message;
  const toastEl = document.getElementById('liveToast');
  const toast = new bootstrap.Toast(toastEl, { delay: 2500 });
  toast.show();
}
