/* =========================================================
   CartShare - receipt.js
   Page logic for receipt.html:
   Pulls the active room's data out of localStorage and
   renders it as a clean, printable summary.
   ========================================================= */

const FREE_DELIVERY_THRESHOLD_RECEIPT = 75; // kept in sync with dashboard.js threshold

document.addEventListener('DOMContentLoaded', () => {

  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const code = getActiveRoomCode();
  const room = code ? getRoom(code) : null;

  if (!room) {
    document.getElementById('receiptItems').innerHTML =
      '<tr><td colspan="5" class="text-center text-muted py-4">No active room/cart found. Go back and join or create a room first.</td></tr>';
    return;
  }

  // --- Meta info ---
  document.getElementById('metaRoomCode').textContent = room.code;
  document.getElementById('metaDate').textContent = new Date().toLocaleDateString();
  document.getElementById('metaMembers').textContent = room.members.map(m => m.name).join(', ');

  // --- Line items ---
  const tbody = document.getElementById('receiptItems');
  tbody.innerHTML = '';

  if (room.cart.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Cart is empty.</td></tr>';
  }

  room.cart.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td class="text-center">${item.qty}</td>
      <td class="text-end">$${item.price.toFixed(2)}</td>
      <td class="text-end">$${(item.price * item.qty).toFixed(2)}</td>
      <td>${item.addedBy}</td>
    `;
    tbody.appendChild(row);
  });

  // --- Total + delivery status ---
  const total = getCartTotal(room);
  document.getElementById('receiptTotal').textContent = `$${total.toFixed(2)}`;

  const statusBox = document.getElementById('deliveryStatus');
  if (total >= FREE_DELIVERY_THRESHOLD_RECEIPT) {
    statusBox.textContent = '✅ Free delivery threshold met.';
    statusBox.classList.add('text-success');
  } else {
    const remaining = (FREE_DELIVERY_THRESHOLD_RECEIPT - total).toFixed(2);
    statusBox.textContent = `⚠️ $${remaining} more needed for free delivery.`;
    statusBox.classList.add('text-warning');
  }
});
