/* ===== ADMIN PANEL JAVASCRIPT ===== */

let adminToken = localStorage.getItem('adminToken') || null;
let currentFilter = '';
let refreshTimer = null;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    showDashboard();
  }

  // Filter tab clicks
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.status;
      fetchOrders();
    });
  });
});

// ---- Auth ----
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Login failed.';
      return;
    }

    adminToken = data.token;
    localStorage.setItem('adminToken', adminToken);
    showDashboard();
  } catch (err) {
    errorEl.textContent = 'Network error. Is the server running?';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function logout() {
  adminToken = null;
  localStorage.removeItem('adminToken');
  clearInterval(refreshTimer);
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  fetchStats();
  fetchOrders();

  // Auto-refresh every 30 seconds
  refreshTimer = setInterval(() => {
    fetchStats();
    fetchOrders();
  }, 30000);
}

// ---- API Helpers ----
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };
}

async function apiGet(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) {
    logout();
    throw new Error('Session expired');
  }
  return res.json();
}

async function apiPut(url, body = {}) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  if (res.status === 401) {
    logout();
    throw new Error('Session expired');
  }
  return res.json();
}

// ---- Stats ----
async function fetchStats() {
  try {
    const stats = await apiGet('/api/admin/stats');
    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statNeedsAttention').textContent = stats.needsAttention || 0;
    document.getElementById('statApproved').textContent = stats.approved || 0;
    document.getElementById('statDelivered').textContent = stats.delivered || 0;
    document.getElementById('statRevenue').textContent = `$${stats.revenue || 0}`;
  } catch (err) {
    console.error('Stats fetch failed:', err);
  }
}

// ---- Orders ----
async function fetchOrders() {
  try {
    const query = currentFilter ? `?status=${currentFilter}` : '';
    const orders = await apiGet(`/api/admin/orders${query}`);
    renderOrders(orders);
  } catch (err) {
    console.error('Orders fetch failed:', err);
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById('ordersBody');

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No orders found</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const id = order._id;
    const shortId = id.slice(-8);
    const txShort = order.txHash ? order.txHash.slice(0, 16) + '...' : '—';
    const statusBadge = getStatusBadge(order.status);
    const date = new Date(order.createdAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let actions = '';
    if (['payment_submitted', 'verified'].includes(order.status)) {
      actions = `
        <button class="btn btn--success btn--sm" onclick="viewOrder('${id}')">View</button>
      `;
    } else {
      actions = `
        <button class="btn btn--ghost btn--sm" onclick="viewOrder('${id}')">View</button>
      `;
    }

    return `
      <tr>
        <td><span class="tx-hash" title="${id}">${shortId}</span></td>
        <td>${order.email}</td>
        <td><strong>${order.crypto}</strong></td>
        <td>$${order.amount}</td>
        <td><span class="tx-hash" title="${order.txHash || ''}">${txShort}</span></td>
        <td>${statusBadge}</td>
        <td>${date}</td>
        <td class="table-actions">${actions}</td>
      </tr>
    `;
  }).join('');
}

function getStatusBadge(status) {
  const map = {
    'pending_payment': ['badge--pending', 'Pending'],
    'payment_submitted': ['badge--submitted', 'Submitted'],
    'verified': ['badge--verified', 'Verified'],
    'approved': ['badge--approved', 'Approved'],
    'delivered': ['badge--delivered', 'Delivered'],
    'rejected': ['badge--rejected', 'Rejected'],
  };
  const [cls, label] = map[status] || ['badge--pending', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ---- View Order ----
async function viewOrder(orderId) {
  try {
    const data = await apiGet(`/api/admin/orders/${orderId}`);
    const order = data.order;
    const bc = data.blockchainInfo;

    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');

    let bcHtml = '';
    if (bc) {
      bcHtml = `
        <div class="blockchain-info">
          <div class="blockchain-info__title">Blockchain Info</div>
          <div class="detail-row">
            <span class="detail-row__label">Status</span>
            <span class="detail-row__value">${bc.status || bc.found ? 'Found' : 'Not found'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-row__label">Confirmations</span>
            <span class="detail-row__value">${bc.confirmations || 0}</span>
          </div>
          ${bc.amount !== null && bc.amount !== undefined ? `
          <div class="detail-row">
            <span class="detail-row__label">Amount</span>
            <span class="detail-row__value">${bc.amount}</span>
          </div>` : ''}
          ${bc.message ? `
          <div class="detail-row">
            <span class="detail-row__label">Note</span>
            <span class="detail-row__value">${bc.message}</span>
          </div>` : ''}
          ${bc.tronscanUrl ? `
          <div class="detail-row">
            <span class="detail-row__label">Verify</span>
            <span class="detail-row__value"><a href="${bc.tronscanUrl}" target="_blank" style="color:var(--coral)">View on Tronscan →</a></span>
          </div>` : ''}
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div class="detail-row">
        <span class="detail-row__label">Order ID</span>
        <span class="detail-row__value" style="font-family:var(--font-mono);font-size:11px">${order._id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Email</span>
        <span class="detail-row__value">${order.email}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Crypto</span>
        <span class="detail-row__value">${order.crypto}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Amount</span>
        <span class="detail-row__value">$${order.amount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Wallet</span>
        <span class="detail-row__value" style="font-family:var(--font-mono);font-size:11px">${order.walletAddress}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">TX Hash</span>
        <span class="detail-row__value" style="font-family:var(--font-mono);font-size:11px">${order.txHash || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Status</span>
        <span class="detail-row__value">${getStatusBadge(order.status)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Blockchain</span>
        <span class="detail-row__value">${getStatusBadge(order.blockchainStatus || 'pending')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Created</span>
        <span class="detail-row__value">${new Date(order.createdAt).toLocaleString()}</span>
      </div>
      ${order.rejectionReason ? `
      <div class="detail-row">
        <span class="detail-row__label">Rejection Reason</span>
        <span class="detail-row__value" style="color:var(--red)">${order.rejectionReason}</span>
      </div>` : ''}
      ${order.downloadCount ? `
      <div class="detail-row">
        <span class="detail-row__label">Downloads</span>
        <span class="detail-row__value">${order.downloadCount}</span>
      </div>` : ''}
      ${bcHtml}
    `;

    // Footer actions
    if (['payment_submitted', 'verified', 'pending_payment'].includes(order.status)) {
      modalFooter.innerHTML = `
        <button class="btn btn--danger" onclick="rejectOrder('${order._id}')">✕ Reject</button>
        <button class="btn btn--success" onclick="approveOrder('${order._id}')">✓ Approve & Send Email</button>
      `;
    } else if (order.status === 'approved') {
      modalFooter.innerHTML = `<span style="font-size:12px;color:var(--green)">✓ Already approved. Email sent.</span>`;
    } else if (order.status === 'delivered') {
      modalFooter.innerHTML = `<span style="font-size:12px;color:var(--green)">✓ Delivered. Downloaded ${order.downloadCount || 0} time(s).</span>`;
    } else if (order.status === 'rejected') {
      modalFooter.innerHTML = `<span style="font-size:12px;color:var(--red)">✕ Order rejected.</span>`;
    } else {
      modalFooter.innerHTML = '';
    }

    document.getElementById('orderModal').style.display = 'flex';
  } catch (err) {
    console.error('View order failed:', err);
    alert('Failed to load order details.');
  }
}

function closeModal() {
  document.getElementById('orderModal').style.display = 'none';
}

// ---- Approve / Reject ----
async function approveOrder(orderId) {
  if (!confirm('Approve this order and send the download email?')) return;

  try {
    const data = await apiPut(`/api/admin/orders/${orderId}/approve`);
    alert(data.message || 'Order approved!');
    closeModal();
    fetchStats();
    fetchOrders();
  } catch (err) {
    alert('Failed to approve order.');
    console.error(err);
  }
}

async function rejectOrder(orderId) {
  const reason = prompt('Rejection reason (optional):') || 'Payment could not be verified.';

  try {
    const data = await apiPut(`/api/admin/orders/${orderId}/reject`, { reason });
    alert(data.message || 'Order rejected.');
    closeModal();
    fetchStats();
    fetchOrders();
  } catch (err) {
    alert('Failed to reject order.');
    console.error(err);
  }
}
