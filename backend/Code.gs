const scriptProperties = PropertiesService.getScriptProperties();
const SECRET_KEY = scriptProperties.getProperty('SECRET_KEY');

function doGet(e) {
  return txtResponse({ error: "GET not supported. Use POST." });
}

function doPost(e) {
  let p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (_) {
    return txtResponse({ error: "Invalid JSON body" });
  }

  if (!p.key || p.key !== SECRET_KEY) {
    return txtResponse({ error: "Unauthorized" });
  }

  try {
    switch (p.action) {
      case "getAllData":
        return txtResponse({
          orders: getOrders(),
          funds: getFundraising(),
          budget: getBudget(),
          members: getMembers()
        });
      case "getOrders":
        return txtResponse(getOrders());
      case "addOrder":
        return txtResponse(addOrderFromParams(p));
      case "updateOrderStatus":
        return txtResponse(updateOrderStatus(p));
      case "deleteOrder":
        return txtResponse(deleteOrder(p.uuid));
      case "getBudget":
        return txtResponse(getBudget());
      case "getFunds":
        return txtResponse(getFundraising());
      case "addFundraising":
      case "addFunds":
        return txtResponse(addFundraisingFromParams(p));
      case "updateFunding":
        return txtResponse(updateFunding(p));
      case "getMembers":
        return txtResponse({ members: getMembers() });
      case "addMember":
        return txtResponse(addMember(p));
      case "removeMember":
        return txtResponse(removeMember(p));
      default:
        return txtResponse({ error: "Invalid action: " + p.action });
    }
  } catch (err) {
    return txtResponse({ error: err.toString() });
  }
}

// ── ORDERS ──────────────────────────────────────────────────────────────────

function getOrders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  if (!sheet) return [];
  return sheetToObjects(sheet);
}

function addOrderFromParams(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  const price = Number(p.price) || 0;
  const quantity = Number(p.quantity) || 1;
  const uuid = p.uuid || generateShortId();
  const totalFormula = "=INDIRECT(\"D\"&ROW())*INDIRECT(\"E\"&ROW())";
  const nextRow = sheet.getLastRow() + 1;
  const colNFormula = `=IF(A${nextRow}<>"", COUNTIF($A$3:A${nextRow}, "<>"), "")`;
  sheet.appendRow([
    p.item||"", p.company||"", p.link||"", price, quantity, p.notes||"",
    p.category||"", p.team||"", new Date(), totalFormula,
    p.status||"Pending Review", p.tracking||"", uuid,
    colNFormula, p.orderedBy||""
  ]);
  return { success: true, uuid };
}

function generateShortId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function updateOrderStatus(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  const rowIndex = parseInt(p.rowIndex);
  if (!rowIndex || rowIndex < 3) return { error: "Invalid row" };
  if (p.status)    sheet.getRange(rowIndex, 11).setValue(p.status);
  if (p.tracking)  sheet.getRange(rowIndex, 12).setValue(p.tracking);
  if (p.orderUUID) sheet.getRange(rowIndex, 13).setValue(p.orderUUID);
  return { success: true };
}

function deleteOrder(uuid) {
  if (!uuid) return { error: "UUID required" };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  const data = sheet.getDataRange().getValues();
  for (let i = 2; i < data.length; i++) {
    if (data[i][12] == uuid) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: "ID not found" };
}

// ── BUDGETS ──────────────────────────────────────────────────────────────────

function getBudget() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Budgets");
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const headers = data[0], categories = headers.slice(1), result = {};
  categories.forEach(cat => result[cat] = {});
  for (let i = 1; i < data.length; i++) {
    const row = data[i], parent = row[0];
    if (!parent) continue;
    for (let j = 1; j < headers.length; j++) {
      let val = row[j];
      result[headers[j]][parent] = (val === "" || isNaN(val)) ? val : Number(val);
    }
  }
  return result;
}

// ── FUNDRAISING ─────────────────────────────────────────────────────────────

function getFundraising() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fundraising");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0], rows = data.slice(1);
  return rows.filter(r => r.some(c => c !== "")).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h.trim()] = r[i]);
    return obj;
  });
}

function addFundraisingFromParams(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fundraising");
  sheet.appendRow([p.type||"", p.source||"", Number(p.amount), new Date(), p.notes||"", p.recipient||"All"]);
  return { success: true };
}

function updateFunding(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fundraising");
  const rowIndex = parseInt(p.rowIndex);
  if (!rowIndex || rowIndex < 2) return { error: "Invalid row" };
  if (p.Type !== undefined)      sheet.getRange(rowIndex, 1).setValue(p.Type);
  if (p.Source !== undefined)    sheet.getRange(rowIndex, 2).setValue(p.Source);
  if (p.Amount !== undefined)    sheet.getRange(rowIndex, 3).setValue(Number(p.Amount) || 0);
  if (p.Date !== undefined)      sheet.getRange(rowIndex, 4).setValue(p.Date);
  if (p.Notes !== undefined)     sheet.getRange(rowIndex, 5).setValue(p.Notes);
  if (p.Recipient !== undefined) sheet.getRange(rowIndex, 6).setValue(p.Recipient);
  return { success: true };
}

// ── MEMBERS ─────────────────────────────────────────────────────────────────

function getMembers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Members");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const members = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[2]) continue;
    members.push({
      firstName: row[0] || "",
      lastName: row[1] || "",
      studentId: String(row[2] || ""),
      team: row[3] || "",
      role: row[4] || "",
      email: row[5] || ""
    });
  }
  return members;
}

function addMember(p) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Members");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Members");
    sheet.appendRow(["firstName", "lastName", "studentId", "team", "role", "email"]);
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === p.studentId ||
        (p.email && String(data[i][5]).toLowerCase() === p.email.toLowerCase())) {
      return { error: "Member with this Student ID or Email already exists" };
    }
  }
  sheet.appendRow([p.firstName||"", p.lastName||"", p.studentId||"", p.team||"", p.role||"", p.email||""]);
  return { success: true };
}

function removeMember(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Members");
  if (!sheet) return { error: "Members sheet not found" };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === p.studentId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: "Member not found" };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 3) return [];
  const headers = data[1], rows = data.slice(2);
  return rows.filter(r => r.some(c => c !== "")).map((r, i) => {
    let obj = {};
    headers.forEach((h, k) => obj[h.trim()] = r[k]);
    obj.rowIndex = i + 3;
    return obj;
  });
}

function txtResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.TEXT);
Y}
