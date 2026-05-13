const SECRET_KEY = "YOUR_SECRET_KEY"; // Ensure this matches src/lib/config.js

function doGet(e) {
  const action = e.parameter.action;
  if (!e.parameter.key || e.parameter.key !== SECRET_KEY) {
    return jsonResponse({ error: "Unauthorized" });
  }

  try {
    switch (action) {
      case "getAllData":
        return jsonResponse({
          orders: getOrders(),
          funds: getFundraising(),
          budget: getBudget(),
          members: getMembers()
        });

      case "getOrders":
        return jsonResponse(getOrders());

      case "addOrder":
        return jsonResponse(addOrderFromParams(e.parameter));

      case "updateOrderStatus":
        return jsonResponse(updateOrderStatus(e.parameter));

      case "deleteOrder":
        return jsonResponse(deleteOrder(e.parameter.uuid));

      case "getBudget":
        return jsonResponse(getBudget());

      case "getFunds":
        return jsonResponse(getFundraising());

      case "addFundraising":
      case "addFunds":
        return jsonResponse(addFundraisingFromParams(e.parameter));

      case "updateFunding":
        return jsonResponse(updateFunding(e.parameter));

      case "getMembers":
        return jsonResponse({ members: getMembers() });

      case "addMember":
        return jsonResponse(addMember(e));

      case "removeMember":
        return jsonResponse(removeMember(e));

      default:
        return jsonResponse({ error: "Invalid action: " + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  return doGet(e);
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
  
  // Column J receives formula for dynamic total
  const totalFormula = "=INDIRECT(\"D\"&ROW())*INDIRECT(\"E\"&ROW())";
  
  // Column N receives formula for sequential counting
  const nextRow = sheet.getLastRow() + 1;
  const colNFormula = `=IF(A${nextRow}<>"", COUNTIF($A$3:A${nextRow}, "<>"), "")`;
  
  // Columns: A=Item, B=Company, C=Link, D=Price, E=Quantity, F=Notes,
  //          G=Category, H=Team, I=Timestamp, J=Total, K=Status,
  //          L=Tracking, M=UUID, N=Formula, O=Ordered By
  sheet.appendRow([
    p.item||"", p.company||"", p.link||"", price, quantity, p.notes||"", 
    p.category||"", p.team||"", new Date(), totalFormula, 
    p.status||"Pending Review", p.tracking||"", uuid,
    colNFormula, p.orderedBy||""
  ]);
  return { success: true, uuid: uuid };
}

function generateShortId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1 to avoid confusion
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function updateOrderStatus(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  const rowIndex = parseInt(p.rowIndex);
  if (!rowIndex || rowIndex < 3) return { error: "Invalid row" };
  if (p.status)    sheet.getRange(rowIndex, 11).setValue(p.status);    // Column K
  if (p.tracking)  sheet.getRange(rowIndex, 12).setValue(p.tracking);  // Column L
  if (p.orderUUID) sheet.getRange(rowIndex, 13).setValue(p.orderUUID); // Column M
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
  const amount = Number(p.amount);
  sheet.appendRow([p.type||"", p.source||"", amount, new Date(), p.notes||"", p.recipient||"All"]);
  return { success: true };
}

function updateFunding(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fundraising");
  const rowIndex = parseInt(p.rowIndex);
  if (!rowIndex || rowIndex < 2) return { error: "Invalid row" };
  // Columns: A=Type, B=Source, C=Amount, D=Date, E=Notes, F=Recipient
  if (p.Type !== undefined)      sheet.getRange(rowIndex, 1).setValue(p.Type);
  if (p.Source !== undefined)    sheet.getRange(rowIndex, 2).setValue(p.Source);
  if (p.Amount !== undefined)    sheet.getRange(rowIndex, 3).setValue(Number(p.Amount) || 0);
  if (p.Date !== undefined)      sheet.getRange(rowIndex, 4).setValue(p.Date);
  if (p.Notes !== undefined)     sheet.getRange(rowIndex, 5).setValue(p.Notes);
  if (p.Recipient !== undefined) sheet.getRange(rowIndex, 6).setValue(p.Recipient);
  return { success: true };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 3) return []; // Header is on line 2, data starts on line 3
  const headers = data[1], rows = data.slice(2);
  return rows.filter(r => r.some(c => c !== "")).map((r, i) => {
    let obj = {};
    headers.forEach((h, k) => obj[h.trim()] = r[k]);
    obj.rowIndex = i + 3; 
    return obj;
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function logRequest(e) {
  console.log("Action: " + (e.parameter.action || "none") + " | Params: " + JSON.stringify(e.parameter));
}

// ── MEMBERS ─────────────────────────────────────────────────────────────────

function getMembers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Members");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var members = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[2]) continue; // Skip empty rows
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

function addMember(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Members");
  if (!sheet) {
    sheet = ss.insertSheet("Members");
    sheet.appendRow(["firstName", "lastName", "studentId", "team", "role"]);
  }

  var firstName = e.parameter.firstName || "";
  var lastName = e.parameter.lastName || "";
  var studentId = e.parameter.studentId || "";
  var team = e.parameter.team || "";
  var role = e.parameter.role || "";
  var email = e.parameter.email || "";

  // Check if student ID already exists
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) === studentId || (email && String(data[i][5]).toLowerCase() === email.toLowerCase())) {
      return { error: "Member with this Student ID or Email already exists" };
    }
  }

  sheet.appendRow([firstName, lastName, studentId, team, role, email]);
  return { success: true, message: "Member added successfully" };
}

function removeMember(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Members");
  if (!sheet) return { error: "Members sheet not found" };

  var studentId = e.parameter.studentId || "";
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) === studentId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Member removed" };
    }
  }

  return { error: "Member not found" };
}
