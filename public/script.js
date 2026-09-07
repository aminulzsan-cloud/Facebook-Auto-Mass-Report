/* ===== GLOBALS ===== */
const { faker } = window; // from CDN
let currentOrderId = null;
let selectedCrypto = 'BTC';
let statusPollInterval = null;

/* ===== SCROLL REVEAL ===== */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ===== SMOOTH SCROLL ===== */
document.querySelectorAll('[data-scroll]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector(btn.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ===== WATCHING NOW BADGE ===== */
function updateWatchingCount() {
  const count = Math.floor(Math.random() * 9) + 12; // 12-20
  document.getElementById('watchingCount').textContent = count;
}
updateWatchingCount();
setInterval(updateWatchingCount, 30000);

/* ===== SOCIAL PROOF POPUPS (FAKER) ===== */
const socialToast = document.getElementById('socialToast');
let socialTimeout = null;

function showSocialProof() {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const city = faker.location.city();
  const minutesAgo = Math.floor(Math.random() * 55) + 2;
  const timeStr = minutesAgo < 60 ? `${minutesAgo} min ago` : `${Math.floor(minutesAgo / 60)}h ago`;

  const initials = (firstName[0] + lastName[0]).toUpperCase();

  document.getElementById('toastAvatar').textContent = initials;
  document.getElementById('toastName').textContent = `${firstName} from ${city}`;
  document.getElementById('toastMessage').textContent = `purchased this ${timeStr}`;

  // Random avatar color
  const colors = ['#a46f5d', '#7b9b83', '#5f6179', '#9a6f62', '#758683', '#514843'];
  document.getElementById('toastAvatar').style.background = colors[Math.floor(Math.random() * colors.length)];

  socialToast.classList.add('show');

  clearTimeout(socialTimeout);
  socialTimeout = setTimeout(() => {
    socialToast.classList.remove('show');
  }, 4500);
}

// First popup after 5 seconds, then random 8-15s intervals
setTimeout(() => {
  showSocialProof();
  setInterval(() => {
    const delay = (Math.random() * 7 + 8) * 1000;
    setTimeout(showSocialProof, delay);
  }, 15000);
}, 5000);

/* ===== FAKER REVIEWS ===== */
function generateFakeReviews() {
  const reviews = [
    {
      name: faker.person.fullName(),
      initials: '',
      title: 'Ethical Hacker',
      location: faker.location.city(),
      rating: 5,
      comment: "This tool completely changed the game for me. Within minutes, I had everything set up and running. The background execution is seamless — it just works.",
      featured: true,
      verified: true,
      color: '#514843',
    },
    {
      name: faker.person.fullName(),
      initials: '',
      title: 'Security Researcher',
      location: faker.location.city(),
      rating: 5,
      comment: "The cookie auth system is brilliant. No passwords, no hassle. Just paste and go. Support via Telegram is also incredibly responsive.",
      featured: false,
      verified: true,
      color: '#758683',
    },
    {
      name: faker.person.fullName(),
      initials: '',
      title: 'Freelancer',
      location: faker.location.city(),
      rating: 5,
      comment: "I was skeptical at first, but after my first run with 100 rounds, I was convinced. Fast, reliable, and the setup guide made everything dead simple.",
      featured: false,
      verified: false,
      color: '#9a6f62',
    },
  ];

  // Generate initials
  reviews.forEach((r) => {
    const parts = r.name.split(' ');
    r.initials = parts.map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  });

  const grid = document.getElementById('reviewGrid');
  grid.innerHTML = reviews
    .map(
      (r) => `
    <article class="review-card${r.featured ? ' featured' : ''} reveal">
      ${r.featured ? '<span class="quote-mark">\u201C</span>' : '<div class="stars">\u2605\u2605\u2605\u2605\u2605</div>'}
      <blockquote>${r.featured ? '' : '\u201C'}${r.comment}${r.featured ? '' : '\u201D'}</blockquote>
      <div class="review-person">
        <span class="person-avatar" style="background:${r.color}">${r.initials}</span>
        <div>
          <strong>${r.name}</strong>
          <small>${r.title} \u00B7 ${r.location}</small>
        </div>
        ${r.verified ? '<span class="verified-badge">VERIFIED</span>' : ''}
      </div>
    </article>
  `
    )
    .join('');

  // Observe new reveals
  grid.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
}

generateFakeReviews();

/* ===== CRYPTO PAYMENT FLOW ===== */

// Crypto tab selection
document.querySelectorAll('.crypto-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.crypto-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    selectedCrypto = tab.dataset.crypto;
  });
});

// Step 1 -> Step 2: Create order
document.getElementById('startPayBtn').addEventListener('click', async () => {
  const email = document.getElementById('buyerEmail').value.trim();
  if (!email || !email.includes('@')) {
    document.getElementById('buyerEmail').style.borderColor = '#e74c3c';
    document.getElementById('buyerEmail').focus();
    return;
  }

  const btn = document.getElementById('startPayBtn');
  btn.textContent = 'Creating order...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, crypto: selectedCrypto }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to create order');
      btn.innerHTML = 'Proceed to Payment <span>\u2192</span>';
      btn.disabled = false;
      return;
    }

    currentOrderId = data.orderId;

    // Show step 2
    document.getElementById('selectedCrypto').textContent = selectedCrypto;
    document.getElementById('walletAddress').textContent = data.walletAddress;
    showStep(2);
  } catch (err) {
    alert('Network error. Please try again.');
    btn.innerHTML = 'Proceed to Payment <span>\u2192</span>';
    btn.disabled = false;
  }
});

// Step 2 -> Step 3: Submit TX hash
document.getElementById('submitTxBtn').addEventListener('click', async () => {
  const txHash = document.getElementById('txHashInput').value.trim();
  if (!txHash || txHash.length < 10) {
    document.getElementById('txHashInput').style.borderColor = '#e74c3c';
    document.getElementById('txHashInput').focus();
    return;
  }

  const btn = document.getElementById('submitTxBtn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/orders/${currentOrderId}/tx`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to submit TX');
      btn.innerHTML = "I've Sent Payment <span>\u2192</span>";
      btn.disabled = false;
      return;
    }

    // Show step 3 with status
    document.getElementById('statusOrderId').textContent = currentOrderId.slice(-8);
    updateStatusDisplay(data.status, data.blockchainStatus);
    showStep(3);

    // Start polling
    startStatusPolling();
  } catch (err) {
    alert('Network error. Please try again.');
    btn.innerHTML = "I've Sent Payment <span>\u2192</span>";
    btn.disabled = false;
  }
});

// Copy wallet address
document.getElementById('copyWallet').addEventListener('click', () => {
  const address = document.getElementById('walletAddress').textContent;
  navigator.clipboard.writeText(address).then(() => {
    const feedback = document.getElementById('copyFeedback');
    feedback.classList.add('show');
    setTimeout(() => feedback.classList.remove('show'), 2000);
  });
});

// Refresh status
document.getElementById('refreshStatus').addEventListener('click', async () => {
  if (!currentOrderId) return;
  const btn = document.getElementById('refreshStatus');
  btn.innerHTML = 'Checking... <span>\u21BB</span>';

  try {
    const res = await fetch(`/api/orders/${currentOrderId}/status`);
    const data = await res.json();
    updateStatusDisplay(data.status, data.blockchainStatus, data.confirmations);
  } catch (err) {
    console.error('Status check failed:', err);
  }

  btn.innerHTML = 'Refresh Status <span>\u21BB</span>';
});

/* ===== HELPERS ===== */
function showStep(step) {
  document.querySelectorAll('.pay-step').forEach((s) => s.classList.remove('active'));
  document.getElementById(`payStep${step}`).classList.add('active');
}

function updateStatusDisplay(status, blockchainStatus, confirmations) {
  const statusMap = {
    pending_payment: { icon: '\u23F3', title: 'Awaiting Payment', msg: 'Send crypto to the wallet address and submit your TX hash.' },
    payment_submitted: { icon: '\uD83D\uDD0D', title: 'Payment Submitted', msg: "We're checking the blockchain for your transaction. This may take a few minutes." },
    verified: { icon: '\u2705', title: 'Payment Verified', msg: 'Your payment has been detected on the blockchain! Admin will approve your order shortly.' },
    approved: { icon: '\uD83C\uDF89', title: 'Order Approved!', msg: "Check your email for the download link. If you don't see it, check spam or contact us on Telegram." },
    delivered: { icon: '\uD83D\uDCE6', title: 'Delivered', msg: 'Your tool has been downloaded. Need help? Contact us on Telegram.' },
    rejected: { icon: '\u274C', title: 'Order Rejected', msg: 'Payment could not be verified. Contact us on Telegram for help.' },
  };

  const info = statusMap[status] || statusMap.pending_payment;
  document.getElementById('statusIcon').textContent = info.icon;
  document.getElementById('statusTitle').textContent = info.title;
  document.getElementById('statusMessage').textContent = info.msg;
  document.getElementById('statusValue').textContent = status.replace(/_/g, ' ').toUpperCase();
  document.getElementById('blockchainValue').textContent = blockchainStatus
    ? `${blockchainStatus}${confirmations ? ` (${confirmations} conf.)` : ''}`
    : 'N/A';

  // Stop polling if terminal
  if (['approved', 'delivered', 'rejected'].includes(status)) {
    clearInterval(statusPollInterval);
  }
}

function startStatusPolling() {
  clearInterval(statusPollInterval);
  statusPollInterval = setInterval(async () => {
    if (!currentOrderId) return;
    try {
      const res = await fetch(`/api/orders/${currentOrderId}/status`);
      const data = await res.json();
      updateStatusDisplay(data.status, data.blockchainStatus, data.confirmations);
    } catch (err) {
      console.error('Polling failed:', err);
    }
  }, 15000);
}
