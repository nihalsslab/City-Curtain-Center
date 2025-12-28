// CONFIGURATION
const SHEET_ID = "13Ej--5FmdzD2xlDncgiqIaotw1XbYWe2Andc8pNPtOo";
const FOLDER_ID = "1P5QGFDTcHPVTW_oqBUiDT9PwriTLOvRF";

// SHEET NAMES
const TABS = {
  PRODUCTS: "Products",
  SALES: "Sales",
  ACCOUNTING: "Accounting"
};

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getProducts") return getProducts();
  if (action === "getSales") return getSales();
  if (action === "getAccounting") return getAccounting();
  if (action === "getStats") return getStats();
  if (action === "debug") return debug();
  
  return response({ error: "Invalid Action" });
}

function debug() {
  try {
     const sheet = getSheet(TABS.PRODUCTS);
     const lastRow = sheet.getLastRow();
     const data = lastRow > 1 ? sheet.getRange(2, 1, Math.min(3, lastRow-1), sheet.getLastColumn()).getValues() : [];
     
     return response({
       status: "Online",
       sheetId: SHEET_ID,
       productSheetName: sheet.getName(),
       lastRow: lastRow,
       sampleData: data
     });
  } catch(e) {
     return response({ error: e.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = e.parameter.action;
    
    if (action === "addProduct") return addProduct(data);
    if (action === "addSale") return addSale(data);
    if (action === "addTransaction") return addTransaction(data);
    if (action === "restockProduct") return restockProduct(data);
    if (action === "updateSale") return updateSale(data);
    if (action === "deleteSale") return deleteSale(data);
    
    return response({ error: "Invalid Action" });
  } catch (err) {
    return response({ error: err.toString() });
  }
}

// --- ACTIONS ---

// --- ACTIONS ---

function getProducts() {
  const sheet = getSheet(TABS.PRODUCTS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return response([]);
  
  // Force read 8 columns to ensure we catch ImageURL(5) and PurchasePrice(7)
  const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  
  const products = rows.map(r => ({
    id: r[0],
    name: r[1],
    description: r[2],
    price: r[3], // Sale Price
    stock: r[4],
    imageUrl: r[5] ? String(r[5]) : "", // Ensure string
    createdAt: r[6],
    purchasePrice: r[7] || 0
  }));
  return response(products);
}

function addProduct(data) {
  const sheet = getSheet(TABS.PRODUCTS);
  
  let imageUrl = "";
  if (data.imageBase64) {
    imageUrl = uploadImage(data.imageBase64, data.mimeType, data.name);
  }
  
  const id = data.id || "ID-" + Math.floor(10000 + Math.random() * 90000); // Try to use provided ID or random
  const timestamp = new Date().toISOString();
  
  sheet.appendRow([
    id,
    data.name,
    data.description,
    data.price,       // Sale Price
    data.stock,
    imageUrl,
    timestamp,
    data.purchasePrice || 0 // New Field
  ]);

  // NEW: Add Expense Entry for Stock Purchase
  const cost = Number(data.purchasePrice || 0) * Number(data.stock || 0);
  if (cost > 0) {
      const accSheet = getSheet(TABS.ACCOUNTING);
      accSheet.appendRow([
          Utilities.getUuid(),
          timestamp,
          "Expense",
          "Stock Purchase: " + data.name,
          cost,
          "Initial Stock Purchase"
      ]);
  }
  
  return response({ success: true, id: id, imageUrl: imageUrl });
}

function getSales() {
  const rows = getSheetData(TABS.SALES);
  // Map rows
  const sales = rows.map(r => ({
    id: r[0],
    date: r[1],
    clientId: r[2],
    clientName: r[3],
    clientNumber: r[4],
    itemId: r[5],
    itemName: r[6],
    type: r[7],
    amount: r[8],
    advance: r[9],
    balance: r[10]
  }));
  return response(sales);
}

function addSale(data) {
  const sheet = getSheet(TABS.SALES);
  const id = data.id || Utilities.getUuid();
  const date = new Date().toISOString();
  
  let joinedItemNames = "";
  let joinedItemIds = "";
  let totalAmount = 0;

  if (data.items && Array.isArray(data.items)) {
    // 1. Process Items (Update Stock & Build Strings)
    const names = [];
    const ids = [];
    
    data.items.forEach(item => {
      // Stock Update
      if (item.itemId) {
        updateStock(item.itemId, -1 * (item.quantity || 1));
      }
      // Strings
      names.push(`${item.itemName} (x${item.quantity})`);
      ids.push(item.itemId);
      
      // Safety: Ensure we use the total calculated by frontend or sum here
      // The frontend sends 'amount' as the Grand Total in the root object for multi-item
    });
    
    joinedItemNames = names.join(", ");
    joinedItemIds = ids.join(", ");
    totalAmount = data.amount; // Grand Total passed from frontend
    
  } else {
    // Single Item Fallback
    if (data.itemId) updateStock(data.itemId, -1);
    joinedItemNames = data.itemName;
    joinedItemIds = data.itemId;
    totalAmount = data.amount;
  }
  
  // 2. Append Single Row
  sheet.appendRow([
    id,
    date,
    data.clientId || "",
    data.clientName,
    data.clientNumber,
    joinedItemIds,
    joinedItemNames,
    data.type,
    totalAmount,
    data.advance || 0,
    data.balance || 0
  ]);
  
  return response({ success: true, id: id });
}

function getAccounting() {
  const rows = getSheetData(TABS.ACCOUNTING);
  return response(rows.map(r => ({
    id: r[0],
    date: r[1],
    type: r[2], // Income / Expense
    category: r[3],
    amount: r[4],
    description: r[5]
  })));
}

function addTransaction(data) {
  const sheet = getSheet(TABS.ACCOUNTING);
  const id = data.id || Utilities.getUuid();
  const date = new Date().toISOString();
  
  sheet.appendRow([
    id,
    date,
    data.type,
    data.category,
    data.amount,
    data.description
  ]);
  
  return response({ success: true, id: id });
}

function restockProduct(data) {
  // data: { id, stockToAdd, purchasePrice, itemName }
  updateStock(data.id, Number(data.stockToAdd));
  
  // Add Expense
  const cost = Number(data.purchasePrice || 0) * Number(data.stockToAdd || 0);
  if (cost > 0) {
      const accSheet = getSheet(TABS.ACCOUNTING);
      const timestamp = new Date().toISOString();
      accSheet.appendRow([
          Utilities.getUuid(),
          timestamp,
          "Expense",
          "Restock: " + (data.itemName || data.id),
          cost,
          "Restock Entry"
      ]);
  }
  return response({ success: true });
}

function updateSale(data) {
  // data: { id, paymentAmount }
  const sheet = getSheet(TABS.SALES);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
     if (rows[i][0] == data.id) {
        const currentBalance = Number(rows[i][10]); // Balance Col K (index 10)
        let newAdvance = Number(rows[i][9]) + Number(data.paymentAmount);
        let newBalance = currentBalance - Number(data.paymentAmount);
        
        if (newBalance < 0) newBalance = 0; // Safety
        
        // Update Advance (Col J -> index 9) and Balance (Col K -> index 10)
        sheet.getRange(i+1, 10).setValue(newAdvance);
        sheet.getRange(i+1, 11).setValue(newBalance);
        
        return response({ success: true, newBalance: newBalance });
     }
  }
  return response({ error: "Sale not found" });
}

function deleteSale(data) {
    const sheet = getSheet(TABS.SALES);
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] == data.id) {
            const itemIdsStr = rows[i][5]; // Item IDs "id1, id2"
            const itemNamesStr = rows[i][6]; // "Name (xQty), ..."
            
            // 1. Refill Stock
            if (itemNamesStr) {
                const parts = itemNamesStr.split(", ");
                const idParts = itemIdsStr.split(", ");
                
                parts.forEach((part, idx) => {
                   // Extract quantity found in (xNUM)
                   const match = part.match(/\(x(\d+)\)$/);
                   const qty = match ? Number(match[1]) : 1;
                   const id = idParts[idx] || idParts[0]; // Fallback
                   
                   if (id) updateStock(id, qty); // Add back
                });
            }
            
            // 2. Delete Row
            sheet.deleteRow(i+1);
            return response({ success: true });
        }
    }
    return response({ error: "Sale not found" });
}

// --- STATS & STATEMENT ---

function getStats() {
  const sales = getSheetData(TABS.SALES);
  const accounting = getSheetData(TABS.ACCOUNTING);
  const products = getSheetData(TABS.PRODUCTS);
  
  // 1. Process Daily Data
  // Map: "YYYY-MM-DD" -> { income: 0, expense: 0 }
  const dailyMap = {};

  const addVal = (dateStr, type, val) => {
     // Extract YYYY-MM-DD
     let d = "Unknown";
     try { d = new Date(dateStr).toISOString().split('T')[0]; } catch(e){}
     if(!dailyMap[d]) dailyMap[d] = { income: 0, expense: 0 };
     if(type==='inc') dailyMap[d].income += Number(val);
     if(type==='exp') dailyMap[d].expense += Number(val);
  };

  // Sales -> Income
  // Only include if NOT Advance OR (Advance AND Balance <= 0)
  sales.forEach(r => {
      const type = r[7];
      const balance = Number(r[10]);
      const amount = r[8];
      
      if (type === 'Advance' && balance > 0) {
          // Skip, not finished yet
      } else {
          addVal(r[1], 'inc', amount);
      }
  });
  
  // Accounting -> Income / Expense
  accounting.forEach(r => {
     if(r[2] === 'Income') addVal(r[1], 'inc', r[4]);
     if(r[2] === 'Expense') addVal(r[1], 'exp', r[4]);
  });
  
  // Products -> Expense logic removed to prevent dynamic expense changes on sale.
  // Expenses are now recorded in Accounting sheet at purchase time.

  // 2. Aggregate Totals
  let totalIncome = 0;
  let totalExpense = 0;
  
  // Convert Map to Array for Sheet & Chart
  const history = Object.keys(dailyMap).sort().map(date => {
     const inc = dailyMap[date].income;
     const exp = dailyMap[date].expense;
     totalIncome += inc;
     totalExpense += exp;
     return [date, inc, exp, inc - exp];
  });

  // 3. Update "Statement" Sheet
  updateStatementSheet(history);

  return response({
    income: totalIncome,
    expense: totalExpense,
    netProfit: totalIncome - totalExpense,
    history: history // [[Date, Inc, Exp, Profit], ...]
  });
}

function updateStatementSheet(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("Statement");
  if (!sheet) {
    sheet = ss.insertSheet("Statement");
    sheet.appendRow(["Date", "Total Income", "Total Expense", "Net Profit"]);
    sheet.setFrozenRows(1);
  }
  
  // Clear old data and write new
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
     sheet.getRange(2, 1, lastRow-1, 4).clearContent();
  }
  
  if (data.length > 0) {
     sheet.getRange(2, 1, data.length, 4).setValues(data);
  }
}



// --- HELPERS ---

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add Headers automatically if new
    if (name === TABS.PRODUCTS) sheet.appendRow(["ID", "Name", "Description", "Price", "Stock", "ImageURL", "CreatedAt"]);
    if (name === TABS.SALES) sheet.appendRow(["ID", "Date", "ClientID", "ClientName", "ClientNumber", "ItemID", "ItemName", "Type", "Amount", "Advance", "Balance"]);
    if (name === TABS.ACCOUNTING) sheet.appendRow(["ID", "Date", "Type", "Category", "Amount", "Description"]);
  }
  return sheet;
}

function getSheetData(name) {
  const sheet = getSheet(name);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // No data, just header
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

function updateStock(productId, delta) {
  const sheet = getSheet(TABS.PRODUCTS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == productId) {
      const currentStock = Number(data[i][4]);
      sheet.getRange(i + 1, 5).setValue(currentStock + delta);
      break;
    }
  }
}

function uploadImage(base64Data, mimeType, fileName) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Return the requested format
  return "https://lh3.googleusercontent.com/d/" + file.getId(); 
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
