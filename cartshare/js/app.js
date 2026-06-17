/* =========================================================
   CartShare - app.js
   Core shared logic: Auth + LocalStorage helpers
   (Room, cart, and activity functions will be added in
   later steps as we build dashboard.html and receipt.html)
   ========================================================= */

const STORAGE_KEYS = {
  USERS: 'cartshare_users',
  CURRENT_USER: 'cartshare_current_user'
};

/* ---------- USER ACCOUNT HELPERS ---------- */

// Get all registered users from localStorage (returns array)
function getUsers() {
  const raw = localStorage.getItem(STORAGE_KEYS.USERS);
  return raw ? JSON.parse(raw) : [];
}

// Save the full users array back to localStorage
function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

/* ---------- SESSION HELPERS ---------- */

// Get the currently logged-in user (or null if nobody is logged in)
function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return raw ? JSON.parse(raw) : null;
}

// Log a user in: store their info as the "current session"
function setCurrentUser(user) {
  // Never store the password in the session object for safety/cleanliness
  const sessionUser = { id: user.id, name: user.name, email: user.email };
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(sessionUser));
}

// Log the current user out
function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  window.location.href = 'index.html';
}

/* =========================================================
   ROOM MANAGEMENT
   A "room" is a shared cart + activity log that multiple
   users can join using a short code. Rooms are stored as
   one object per room under key: cartshare_room_<CODE>
   ========================================================= */

// Generate a short, readable room code, e.g. "X7K2P9"
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing O/0/I/1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function roomKey(code) {
  return 'cartshare_room_' + code.toUpperCase();
}

// Create a brand new room, owned by the given user, return the room object
function createRoom(user) {
  const code = generateRoomCode();
  const room = {
    code,
    createdBy: user.id,
    members: [{ id: user.id, name: user.name }],
    cart: [],          // array of cart line items
    activity: []        // array of activity log entries
  };
  saveRoom(room);
  logActivity(code, `${user.name} created the room.`);
  return room;
}

// Join an existing room by code. Returns the room object, or null if not found.
function joinRoom(code, user) {
  const room = getRoom(code);
  if (!room) return null;

  const alreadyMember = room.members.some(m => m.id === user.id);
  if (!alreadyMember) {
    room.members.push({ id: user.id, name: user.name });
    saveRoom(room);
    logActivity(code, `${user.name} joined the room.`);
  }
  return room;
}

// Fetch a room object by code (or null if it doesn't exist)
function getRoom(code) {
  const raw = localStorage.getItem(roomKey(code));
  return raw ? JSON.parse(raw) : null;
}

// Save a room object back to localStorage
function saveRoom(room) {
  localStorage.setItem(roomKey(room.code), JSON.stringify(room));
}

// Remember which room the current browser tab/user is "in"
function setActiveRoomCode(code) {
  localStorage.setItem('cartshare_active_room', code);
}

function getActiveRoomCode() {
  return localStorage.getItem('cartshare_active_room');
}

/* =========================================================
   CART ACTIONS
   Cart items live inside the room object: room.cart = [...]
   Each item: { id, name, price, qty, addedBy }
   ========================================================= */

// Add a product to the room's cart (or bump quantity if it's already there)
function addToCart(code, product, user) {
  const room = getRoom(code);
  if (!room) return null;

  const existing = room.cart.find(item => item.productId === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    room.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
      addedBy: user.name
    });
  }

  saveRoom(room);
  logActivity(code, `${user.name} added "${product.name}" to the cart.`);
  return room;
}

// Decrease quantity (or remove entirely if it hits 0)
function removeFromCart(code, productId, user) {
  const room = getRoom(code);
  if (!room) return null;

  const item = room.cart.find(i => i.productId === productId);
  if (!item) return room;

  item.qty -= 1;
  const removedCompletely = item.qty <= 0;
  if (removedCompletely) {
    room.cart = room.cart.filter(i => i.productId !== productId);
  }

  saveRoom(room);
  logActivity(
    code,
    removedCompletely
      ? `${user.name} removed "${item.name}" from the cart.`
      : `${user.name} reduced "${item.name}" quantity.`
  );
  return room;
}

// Calculate the total cost of everything currently in the cart
function getCartTotal(room) {
  return room.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/* =========================================================
   ACTIVITY LOG
   A simple time-stamped feed of what everyone in the room
   has done. Stored as part of the room object.
   ========================================================= */

function logActivity(code, message) {
  const room = getRoom(code);
  if (!room) return;

  room.activity.unshift({
    message,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  // Keep the log from growing forever
  room.activity = room.activity.slice(0, 50);
  saveRoom(room);
}

/* =========================================================
   CROSS-TAB SYNC
   The browser fires a "storage" event in OTHER tabs/windows
   whenever localStorage changes in THIS tab. We listen for
   that event to simulate real-time collaboration between
   multiple "users" (browser tabs) in the same room.
   ========================================================= */

function onRoomUpdated(callback) {
  window.addEventListener('storage', (e) => {
    const activeCode = getActiveRoomCode();
    if (!activeCode) return;
    if (e.key === roomKey(activeCode)) {
      callback();
    }
  });
}
