import { api } from './api.js';

const state = {
  products: [],
  sales: [],
  accounting: [],
  currentPage: 'home'
};

const content = document.getElementById('content');
const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');
const navButtons = document.querySelectorAll('.links button');

async function init() {
  // Auto-connect if URL is hardcoded in api.js
  if (!localStorage.getItem('gas_api_url') && api.baseUrl && !api.baseUrl.includes("REPLACE")) {
    console.log("Auto-connecting to hardcoded URL...");
    api.setBaseUrl(api.baseUrl);
  }

  const savedUrl = localStorage.getItem('gas_api_url');
  if (!savedUrl) {
    showConfigModal();
  } else {
    renderPage('home');
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPage(btn.dataset.page);
    });
  });

  closeModal.addEventListener('click', hideModal);
}

// --- RENDER ---
async function renderPage(page) {
  state.currentPage = page;
  content.innerHTML = '<p style="text-align:center; padding:3rem; color:#888;"><span class="material-icons-round" style="font-size:48px;">hourglass_top</span><br>Loading...</p>';
  window.scrollTo(0, 0);

  try {
    switch (page) {
      case 'home':
        await loadProducts();
        content.innerHTML = renderHome();
        attachHomeEvents();
        break;
      case 'sales':
        await Promise.all([loadProducts(), loadSales()]);
        content.innerHTML = renderSalesPage();
        attachSalesEvents();
        break;
      case 'accounting':
        await loadAccounting();
        content.innerHTML = renderAccountingPage();
        attachAccountingEvents();
        break;
      case 'statement':
        // Load ALL data for statement to make merged list
        await Promise.all([loadProducts(), loadSales(), loadAccounting()]);
        const stats = await api.getStats();
        content.innerHTML = renderStatementPage(stats);
        attachStatementEvents();
        break;
      default:
        content.innerHTML = '<h2>Page Not Found</h2>';
    }
  } catch (err) {
    content.innerHTML = `<div class="card" style="text-align:center; color:red;">
      <h3><span class="material-icons-round">error</span> Error</h3>
      <p>${err.message}</p>
      <button onclick="window.location.reload()" class="primary-btn"><span class="material-icons-round">refresh</span> Retry</button>
    </div>`;
  }
}

async function loadProducts() {
  try { state.products = await api.getProducts(); }
  catch (e) { console.error(e); }
}
async function loadSales() { state.sales = await api.getSales(); }
async function loadAccounting() { state.accounting = await api.getAccounting(); }

// --- TEMPLATES ---

// 1. HOME
function renderHome() {
  const cards = state.products.map(p => `
    <div class="product-card">
      <div class="product-image">
        ${p.imageUrl ? `<img src="${p.imageUrl}" style="max-width:100%; max-height:100%;" onerror="this.parentElement.innerHTML='<span class=\'material-icons-round\' style=\'font-size:48px; color:#ddd;\'>broken_image</span>'">` : '<span class="material-icons-round" style="font-size:48px; color:#ddd;">image</span>'}
      </div>
      <div style="padding:0.8rem;">
        <div style="font-weight:700; margin-bottom:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
        <div style="color:var(--primary); font-weight:700;">$${p.price}</div>
        <div style="font-size:0.8rem; color:#666; margin-top:0.2rem;">Available: ${p.stock}</div>
        <div style="margin-top:0.5rem; text-align:right;">
             <button class="restock-btn" data-id="${p.id}" data-name="${p.name}" data-purchase="${p.purchasePrice}" style="background:none; border:none; cursor:pointer; color:var(--primary);" title="Restock">
                <span class="material-icons-round">add_circle</span>
             </button>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h2><span class="material-icons-round">inventory_2</span> Product List</h2>
      </div>
      
      <div class="grid-gallery" style="padding-bottom:80px;">
        ${cards.length ? cards : '<p>No products found.</p>'}
      </div>

      <button id="add-product-btn" class="fab">
        <span class="material-icons-round">add</span>
      </button>
    </div>
  `;
}

function attachHomeEvents() {
  document.getElementById('add-product-btn')?.addEventListener('click', showAddProductModal);

  // Restock Events
  document.querySelectorAll('.restock-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showRestockModal(btn.dataset);
    });
  });
}

// 2. SALES
function renderSalesPage() {
  const historyRows = state.sales.slice(-10).reverse().map(s => {
    const isAdv = s.type === 'Advance';
    return `
    <div style="border-bottom:1px solid #eee; padding:0.8rem 0; display:flex; gap:10px; align-items:center;">
      <div style="background:${isAdv ? '#e67e22' : 'var(--primary)'}; color:white; padding:8px; border-radius:50%; display:flex;">
        <span class="material-icons-round" style="font-size:20px;">${isAdv ? 'receipt_long' : 'shopping_bag'}</span>
      </div>
      <div style="flex:1;">
        <div style="font-weight:600;">${s.clientName}</div>
        <div style="font-size:0.8rem; color:#888;">${new Date(s.date).toLocaleDateString()} • ${s.itemName}</div>
      </div>
      <div style="text-align:right;">
         <div style="font-weight:700;">$${s.amount}</div>
         ${isAdv ? `
             <div style="font-size:0.75rem; color:#e67e22;">
                ${s.balance <= 0 ? 'Completed' : `Bal: $${s.balance}`}
             </div>
             ${s.balance > 0 ? `
                 <div style="margin-top:5px; display:flex; gap:5px; justify-content:flex-end;">
                     <button class="edit-sale-btn" data-id="${s.id}" data-balance="${s.balance}" data-total="${s.amount}" style="background:#fff3e0; border:none; border-radius:4px; cursor:pointer;" title="Pay Balance">
                        <span class="material-icons-round" style="font-size:16px; color:#e67e22;">edit</span>
                     </button>
                     <button class="del-sale-btn" data-id="${s.id}" style="background:#ffebee; border:none; border-radius:4px; cursor:pointer;" title="Delete & Refund Stock">
                        <span class="material-icons-round" style="font-size:16px; color:red;">delete</span>
                     </button>
                 </div>
             ` : ''}
         ` : ''}
      </div>
    </div>
  `}).join('');

  const renderMultiItemForm = (formId, type) => `
      <form id="${formId}">
          <input type="hidden" name="type" value="${type}">
          
          <label>Client Details</label>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:1rem;">
             <input type="text" name="clientName" placeholder="Name" required>
             <input type="text" name="clientNumber" placeholder="Number (Optional)" ${type === 'Advance' ? 'required' : ''}> 
          </div>

          <label>Items</label>
          <div class="items-container" id="items-${formId}">
             <!-- Dynamic Rows -->
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
             <button type="button" class="add-item-btn" data-target="items-${formId}" style="background:#eee; color:#333; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.8rem;">+ Add Item</button>
             <div style="font-size:1.2rem; font-weight:700;">Total: $<span class="grand-total">0</span></div>
          </div>

          ${type === 'Advance' ? `
            <label>Payment</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:1rem;">
               <div>
                 <small>Total Bill</small>
                 <input type="number" name="amount" class="final-amount" readonly style="background:#f9f9f9;">
               </div>
               <div>
                 <small>Advance Paid</small>
                 <input type="number" name="advance" placeholder="$" required>
               </div>
            </div>
          ` : ''}
          
          <button type="submit" class="primary-btn" style="${type === 'Advance' ? 'background:#e67e22' : ''}"><span class="material-icons-round">${type === 'Advance' ? 'bookmark' : 'check_circle'}</span> ${type === 'Advance' ? 'Book Order' : 'Complete Sale'}</button>
      </form>
  `;

  return `
    <div style="max-width:600px; margin:0 auto;">
      <!-- Toggle Tabs -->
      <div style="display:flex; background:#eee; border-radius:12px; padding:4px; margin-bottom:1rem;">
         <button id="tab-direct" class="tab-btn active" style="flex:1; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:600; background:white; color:var(--primary);">Direct Sale</button>
         <button id="tab-advance" class="tab-btn" style="flex:1; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:600; background:transparent; color:#666;">Advance Booking</button>
      </div>

      <!-- FORM 1: DIRECT SALE -->
      <div id="wrapper-direct" class="card">
        <h2><span class="material-icons-round">shopping_bag</span> Direct Sale</h2>
        ${renderMultiItemForm('direct-sale-form', 'Sale')}
      </div>

      <!-- FORM 2: ADVANCE BOOKING -->
      <div id="wrapper-advance" class="card hidden">
        <h2><span class="material-icons-round">receipt_long</span> Advance Booking</h2>
        ${renderMultiItemForm('advance-sale-form', 'Advance')}
      </div>

      <div class="card">
        <h3><span class="material-icons-round">history</span> Recent Activity</h3>
        ${historyRows}
      </div>
    </div>
  `;
}

function attachSalesEvents() {
  const tabDirect = document.getElementById('tab-direct');
  const tabAdvance = document.getElementById('tab-advance');
  const wrapDirect = document.getElementById('wrapper-direct');
  const wrapAdvance = document.getElementById('wrapper-advance');

  // History Actions
  document.querySelectorAll('.edit-sale-btn').forEach(btn => {
    btn.addEventListener('click', () => showPaymentModal(btn.dataset));
  });

  document.querySelectorAll('.del-sale-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm("Are you sure? This will delete the sale and RESTOCK items.")) {
        btn.disabled = true;
        const res = await api.deleteSale({ id: btn.dataset.id });
        if (res.success) renderPage('sales');
        else alert("Error: " + JSON.stringify(res));
      }
    });
  });

  // Tabs
  tabDirect.addEventListener('click', () => {
    tabDirect.classList.add('active'); tabDirect.style.background = 'white'; tabDirect.style.color = 'var(--primary)';
    tabAdvance.classList.remove('active'); tabAdvance.style.background = 'transparent'; tabAdvance.style.color = '#666';
    wrapDirect.classList.remove('hidden'); wrapAdvance.classList.add('hidden');
  });
  tabAdvance.addEventListener('click', () => {
    tabAdvance.classList.add('active'); tabAdvance.style.background = 'white'; tabAdvance.style.color = '#e67e22';
    tabDirect.classList.remove('active'); tabDirect.style.background = 'transparent'; tabDirect.style.color = '#666';
    wrapAdvance.classList.remove('hidden'); wrapDirect.classList.add('hidden');
  });

  // --- GENERIC MULTI-ITEM LOGIC ---
  const setupForm = (formId) => {
    const form = document.getElementById(formId);
    const container = form.querySelector('.items-container');
    const addBtn = form.querySelector('.add-item-btn');
    const totalSpan = form.querySelector('.grand-total');
    const finalAmountInput = form.querySelector('.final-amount'); // For Advance logic

    const updateGrandTotal = () => {
      let total = 0;
      container.querySelectorAll('.p-price').forEach(inp => total += Number(inp.value));
      totalSpan.textContent = total;
      if (finalAmountInput) finalAmountInput.value = total;
    };

    const addItem = () => {
      const div = document.createElement('div');
      div.className = 'item-row';
      // Changed to column layout for better mobile space
      div.style.cssText = "display:flex; flex-direction:column; gap:5px; margin-bottom:10px; padding:10px; border:1px solid #eee; border-radius:8px; background:#fff;";

      div.innerHTML = `
          <!-- Row 1: Item Select -->
          <div style="width:100%;">
             <select class="p-select" style="width:100%; margin:0; font-weight:600;" required>
                 <option value="">-- Select Item --</option>
                 ${state.products.map(p => `<option value="${p.id}" data-price="${p.price}" data-name="${p.name}" data-stock="${p.stock}">${p.name} (Stock: ${p.stock})</option>`).join('')}
             </select>
          </div>
          
          <!-- Row 2: Controls -->
          <div style="display:flex; align-items:center; justifyContent:space-between; gap:10px;">
              <!-- Stepper -->
              <div style="display:flex; align-items:center;">
                 <button type="button" class="qty-btn-minus" style="width:36px; height:36px; border:1px solid #ddd; background:#f5f5f5; border-radius:6px 0 0 6px; font-weight:bold; cursor:pointer;">-</button>
                 <input type="number" class="p-qty" value="1" min="1" style="width:50px; height:36px; margin:0; text-align:center; border:1px solid #ddd; border-left:none; border-right:none; font-weight:600;" placeholder="Qty">
                 <button type="button" class="qty-btn-plus" style="width:36px; height:36px; border:1px solid #ddd; background:#f5f5f5; border-radius:0 6px 6px 0; font-weight:bold; cursor:pointer;">+</button>
              </div>

              <!-- Price & Remove -->
              <div style="display:flex; align-items:center; gap:5px; flex:1; justify-content:flex-end;">
                  <span style="font-weight:600; color:#666;">$</span>
                  <input type="number" class="p-price" value="0" style="width:70px; margin:0; text-align:right; font-weight:600;" placeholder="0">
                  <button type="button" class="rm-btn" style="background:#ffebee; border:none; color:red; width:36px; height:36px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:5px;">
                    <span class="material-icons-round" style="font-size:18px;">delete</span>
                  </button>
              </div>
          </div>
        `;

      const sel = div.querySelector('.p-select');
      const qty = div.querySelector('.p-qty');
      const prc = div.querySelector('.p-price');
      const minus = div.querySelector('.qty-btn-minus');
      const plus = div.querySelector('.qty-btn-plus');

      div.querySelector('.rm-btn').addEventListener('click', () => {
        if (container.children.length > 1) { div.remove(); updateGrandTotal(); }
      });

      const recalcRow = () => {
        const opt = sel.selectedOptions[0];

        // Check for duplicates
        if (sel.value) {
          const allSelects = container.querySelectorAll('.p-select');
          for (const otherSel of allSelects) {
            if (otherSel !== sel && otherSel.value === sel.value) {
              alert("This item is already added! Please increase the quantity instead.");
              sel.value = ""; // Reset
              prc.value = 0;
              updateGrandTotal();
              return;
            }
          }
        }

        if (opt && opt.dataset.price && sel.value) {
          // Stock Validation
          const maxStock = Number(opt.dataset.stock) || 0;
          let currentQty = Number(qty.value);

          if (currentQty > maxStock) {
            alert(`Only ${maxStock} items available in stock!`);
            qty.value = maxStock;
            currentQty = maxStock;
          }

          prc.value = Number(opt.dataset.price) * currentQty;
        } else {
          prc.value = 0;
        }
        updateGrandTotal();
      };

      minus.addEventListener('click', () => {
        let val = Number(qty.value) || 1;
        if (val > 1) { qty.value = val - 1; recalcRow(); }
      });
      plus.addEventListener('click', () => {
        let val = Number(qty.value) || 0;
        qty.value = val + 1; recalcRow();
      });

      sel.addEventListener('change', recalcRow);
      qty.addEventListener('input', recalcRow);
      prc.addEventListener('input', updateGrandTotal);

      container.appendChild(div);
    };

    // Init
    addItem();
    addBtn.addEventListener('click', addItem);

    // Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Processing...";

      const items = [];
      container.querySelectorAll('.item-row').forEach(row => {
        const sel = row.querySelector('.p-select');
        const qty = row.querySelector('.p-qty');
        const prc = row.querySelector('.p-price');
        items.push({
          itemId: sel.value,
          itemName: sel.selectedOptions[0]?.dataset.name || "Unknown",
          quantity: Number(qty.value),
          amount: Number(prc.value)
        });
      });

      const total = Number(totalSpan.textContent);

      const data = {
        type: fd.get('type'),
        clientName: fd.get('clientName'),
        clientNumber: fd.get('clientNumber'),
        items: items,
        amount: total // Total Bill
      };

      if (fd.get('advance')) {
        data.advance = fd.get('advance');
        data.balance = total - Number(data.advance);
      }

      const res = await api.addSale(data);
      if (res.success) renderPage('sales');
      else { alert("Error " + JSON.stringify(res)); btn.disabled = false; btn.textContent = "Retry"; }
    });
  };

  setupForm('direct-sale-form');
  setupForm('advance-sale-form');
}

// 3. ACCOUNTING
function renderAccountingPage() {
  const rows = state.accounting.slice(-10).reverse().map(t => {
    const isInc = t.type === 'Income';
    return `
    <div style="border-bottom:1px solid #eee; padding:0.8rem 0; display:flex; gap:10px; align-items:center;">
       <div style="background:${isInc ? '#c8e6c9' : '#ffcdd2'}; padding:8px; border-radius:50%; color:${isInc ? 'green' : 'red'};">
          <span class="material-icons-round">${isInc ? 'arrow_downward' : 'arrow_upward'}</span>
       </div>
      <div style="flex:1;">
        <div style="font-weight:600;">${t.category}</div>
        <div style="font-size:0.8rem; color:#888;">${new Date(t.date).toLocaleDateString()}</div>
      </div>
      <div style="font-weight:700; color:${isInc ? 'green' : 'red'};">
        ${isInc ? '+' : '-'}$${t.amount}
      </div>
    </div>
  `}).join('');

  return `
    <div style="max-width:600px; margin:0 auto;">
      <div class="card">
        <h2><span class="material-icons-round">account_balance</span> Add Entry</h2>
        <form id="accounting-form">
          <select name="type" style="margin-bottom:1rem;">
             <option value="Expense">Expense</option>
             <option value="Income">Income</option>
          </select>
          <input type="text" name="category" placeholder="Category" required>
          <input type="number" name="amount" placeholder="Amount ($)" required>
          <input type="text" name="description" placeholder="Description">
          <button type="submit" class="primary-btn"><span class="material-icons-round">add</span> Add</button>
        </form>
      </div>
      <div class="card">
        <h3><span class="material-icons-round">list</span> History</h3>
        ${rows}
      </div>
    </div>
  `;
}

function attachAccountingEvents() {
  const form = document.getElementById('accounting-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = "...";
    await api.addTransaction({
      type: form.type.value, category: form.category.value,
      amount: form.amount.value, description: form.description.value
    });
    renderPage('accounting');
  });
}

// 4. STATEMENT (Updated)
function renderStatementPage(stats) {
  // Merge lists for "Statement List"
  const allTx = [
    ...state.sales.map(s => ({ ...s, dateObj: new Date(s.date), category: 'Sale: ' + s.itemName, isIncome: true })),
    ...state.accounting.map(a => ({ ...a, dateObj: new Date(a.date), isIncome: a.type === 'Income' }))
  ].sort((a, b) => b.dateObj - a.dateObj); // Newest first

  const txRows = allTx.map(t => `
    <tr>
      <td>${t.dateObj.toLocaleDateString()}</td>
      <td>
        <div style="font-weight:600;">${t.category}</div>
        ${t.clientName ? `<div style="font-size:0.8rem; color:#666;">${t.clientName}</div>` : ''}
      </td>
      <td style="text-align:right; color:${t.isIncome ? 'green' : 'red'}; font-weight:700;">
        ${t.isIncome ? '+' : '-'}${t.amount}
      </td>
    </tr>
  `).join('');

  return `
    <div id="print-area">
        <div class="card" style="text-align:center; border:2px solid var(--primary);">
           <h2 style="justify-content:center; border:none; margin-bottom:0.5rem;">Financial Statement</h2>
           <p style="color:#666; margin-bottom:1.5rem;">Total Profit Calculation</p>
           
           <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:1rem;">
              <div style="background:#e8f5e9; padding:1rem; border-radius:8px;">
                 <div style="font-size:0.9rem; color:green;">Total Income</div>
                 <div style="font-size:1.4rem; font-weight:800; color:green;">$${stats.income}</div>
                 <div style="font-size:0.7rem; color:#555;">(Sales + Acc. Income)</div>
              </div>
              <div style="background:#ffebee; padding:1rem; border-radius:8px;">
                 <div style="font-size:0.9rem; color:red;">Total Expense</div>
                 <div style="font-size:1.4rem; font-weight:800; color:red;">$${stats.expense}</div>
                 <div style="font-size:0.7rem; color:#555;">(Purchases + Acc. Exp)</div>
              </div>
           </div>
           
           <div style="background:#f9fbe7; padding:1rem; border-radius:8px; border:1px solid #c0ca33;">
              <div style="font-size:1.1rem; color:#827717;">Net Profit</div>
              <div style="font-size:2.5rem; font-weight:900; color:#33691e;">$${stats.netProfit}</div>
           </div>
        </div>

        <div class="card">
           <div style="display:flex; justify-content:space-between; align-items:center;">
             <h3>Transaction History</h3>
             <button id="download-pdf" style="background:#333; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.8rem;">
                <span class="material-icons-round" style="font-size:16px; vertical-align:middle;">download</span> PDF
             </button>
           </div>
           <div style="overflow-x:auto;">
             <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
               <thead style="background:#f5f5f5;">
                 <tr>
                   <th style="padding:10px; text-align:left;">Date</th>
                   <th style="padding:10px; text-align:left;">Details</th>
                   <th style="padding:10px; text-align:right;">Amount</th>
                 </tr>
               </thead>
               <tbody>
                 ${txRows}
               </tbody>
             </table>
           </div>
        </div>
    </div>
  `;
}

function attachStatementEvents() {
  document.getElementById('download-pdf')?.addEventListener('click', () => {
    window.print(); // Simple PDF export via browser
  });
}

// MODAL (Product Form)
function showAddProductModal() {
  // Matching user's image design for Modal
  modalBody.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
       <h2 style="margin:0; font-size:1.2rem;">Stock Form</h2>
    </div>
    
    <form id="add-prod">
       <!-- Image Upload Area -->
       <label style="display:block; font-size:0.9rem; color:#666; margin-bottom:5px;">Image*</label>
       <label style="border:1px dashed #ccc; border-radius:8px; height:120px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; background:#fafafa; margin-bottom:1rem;">
          <span class="material-icons-round" style="font-size:32px; color:#999;">photo_camera</span>
          <span style="font-size:0.8rem; color:#999;">Click to upload</span>
          <input type="file" id="p-img" accept="image/*" style="display:none;">
       </label>

       <label style="font-size:0.9rem; color:#666;">Name</label>
       <input type="text" name="name" style="margin-bottom:1rem;">

       <label style="font-size:0.9rem; color:#666;">Description</label>
       <textarea name="description" rows="3" style="width:100%; border:1px solid #ccc; border-radius:8px; padding:10px; margin-bottom:1rem; font-family:inherit;"></textarea>

       <!-- Pricing -->
       <label style="font-size:0.9rem; color:#666;">Purchase Price*</label>
       <div style="display:flex; align-items:center; margin-bottom:1rem;">
          <span style="padding:0.8rem; background:#eee; border:1px solid #ccc; border-right:none; border-radius:8px 0 0 8px;">Rs</span>
          <input type="number" name="purchasePrice" value="0" style="margin:0; border-radius:0 8px 8px 0;">
       </div>

       <label style="font-size:0.9rem; color:#666;">Sale Price*</label>
       <div style="display:flex; align-items:center; margin-bottom:1rem;">
          <span style="padding:0.8rem; background:#eee; border:1px solid #ccc; border-right:none; border-radius:8px 0 0 8px;">Rs</span>
          <input type="number" name="salePrice" value="0" style="margin:0; border-radius:0 8px 8px 0;">
       </div>

       <label style="font-size:0.9rem; color:#666;">Item Count*</label>
       <div style="display:flex; align-items:center; margin-bottom:1rem; gap:10px;">
           <button type="button" id="stock-minus" style="width:40px; height:40px; border-radius:8px; border:1px solid #ccc; background:#f5f5f5; font-size:1.2rem; cursor:pointer;">-</button>
           <input type="number" id="stock-input" name="stock" value="1" style="text-align:center; width:60px; margin:0; font-size:1.1rem; font-weight:600;">
           <button type="button" id="stock-plus" style="width:40px; height:40px; border-radius:8px; border:1px solid #ccc; background:#f5f5f5; font-size:1.2rem; cursor:pointer;">+</button>
       </div>
       
       <label style="font-size:0.9rem; color:#666;">Item ID*</label>
       <input type="text" name="itemId" value="ID-${Math.floor(10000 + Math.random() * 90000)}" readonly style="background:#f9f9f9; color:#888;">

       <button class="primary-btn" style="background:#2563eb;">Save Item</button>
    </form>
  `;
  modalOverlay.classList.remove('hidden');

  // Stepper Logic
  const sInput = document.getElementById('stock-input');
  document.getElementById('stock-minus').addEventListener('click', () => {
    let val = Number(sInput.value) || 0;
    if (val > 0) sInput.value = val - 1;
  });
  document.getElementById('stock-plus').addEventListener('click', () => {
    let val = Number(sInput.value) || 0;
    sInput.value = val + 1;
  });

  document.getElementById('add-prod').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    btn.textContent = "Uploading..."; btn.disabled = true;

    // Image
    let base64 = "", mime = "";
    const file = document.getElementById('p-img').files[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { alert("File > 4MB"); btn.disabled = false; return; }
      try { base64 = await toBase64(file); mime = file.type; } catch (err) { }
    }

    const res = await api.addProduct({
      name: form.name.value,
      description: form.description.value,
      price: form.salePrice.value,          // Map 'Sale Price' to standard 'price'
      purchasePrice: form.purchasePrice.value, // New Field
      stock: form.stock.value,
      id: form.itemId.value,                // Pass generated ID
      imageBase64: base64,
      mimeType: mime
    });

    if (res.success) { hideModal(); renderPage('home'); }
    else { alert("Error " + JSON.stringify(res)); btn.disabled = false; }
  });
}


function showRestockModal(data) {
  modalBody.innerHTML = `
      <h3>Restock: ${data.name}</h3>
      <form id="restock-form">
          <label>Quantity to Add</label>
          <input type="number" name="qty" min="1" required style="margin-bottom:1rem;">
          
          <label>Purchase Price (Per Item) for Expense</label>
          <input type="number" name="price" value="${data.purchase || 0}" required style="margin-bottom:1rem;">
          
          <button class="primary-btn">Update Stock</button>
      </form>
    `;
  modalOverlay.classList.remove('hidden');

  document.getElementById('restock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = "...";
    const qty = e.target.qty.value;
    const price = e.target.price.value;

    await api.restockProduct({ id: data.id, stockToAdd: qty, purchasePrice: price, itemName: data.name });
    hideModal();
    renderPage('home');
  });
}

function showPaymentModal(data) {
  modalBody.innerHTML = `
      <h3>Pay Balance</h3>
      <p>Total: $${data.total} | Balance: <span style="color:red; font-weight:bold;">$${data.balance}</span></p>
      
      <form id="pay-form">
          <label>Payment Amount</label>
          <input type="number" name="amount" max="${data.balance}" required style="margin-bottom:1rem;">
          <button class="primary-btn">Submit Payment</button>
      </form>
    `;
  modalOverlay.classList.remove('hidden');

  document.getElementById('pay-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = "...";

    await api.updateSale({ id: data.id, paymentAmount: e.target.amount.value });
    hideModal();
    renderPage('sales');
  });
}

function showConfigModal() {
  modalBody.innerHTML = `
    <h3>Connect</h3>
    <form id="con-form">
      <input id="url" placeholder="Web App URL" required>
      <button class="primary-btn">Connect</button>
    </form>
  `;
  modalOverlay.classList.remove('hidden');
  document.getElementById('con-form').addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('url').value;
    if (u) { api.setBaseUrl(u); hideModal(); renderPage('home'); }
  });
}
function hideModal() { modalOverlay.classList.add('hidden'); }

const toBase64 = file => new Promise((r, j) => {
  const fr = new FileReader(); fr.readAsDataURL(file);
  fr.onload = () => r(fr.result.split(',')[1]); fr.onerror = j;
});

init();
