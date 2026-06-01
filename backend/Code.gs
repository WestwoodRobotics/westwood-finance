const scriptProperties = PropertiesService.getScriptProperties();
const GOOGLE_CLIENT_ID = scriptProperties.getProperty('GOOGLE_CLIENT_ID');

function verifyGoogleToken(idToken) {
  if (!idToken) return null;
  try {
    const res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    const payload = JSON.parse(res.getContentText());
    if (payload.aud !== GOOGLE_CLIENT_ID) return null;
    if (payload.email_verified !== true && payload.email_verified !== 'true') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function getMemberByEmail(email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const lower = email.toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][5]).toLowerCase() === lower) {
      return {
        firstName: data[i][0], lastName: data[i][1],
        studentId: String(data[i][2]), team: data[i][3],
        role: data[i][4], email: data[i][5]
      };
    }
  }
  return null;
}

function isAdmin(email) {
  const m = getMemberByEmail(email);
  return m && (m.role || '').trim().toLowerCase() === 'admin';
}

function isApprovedMember(email) {
  const m = getMemberByEmail(email);
  if (!m) return false;
  const role = (m.role || '').trim().toLowerCase();
  return role !== '' && role !== 'unauthorized';
}

function sanitizeCell(val) {
  if (typeof val === 'string' && /^[=+\-@]/.test(val)) return "'" + val;
  return val;
}

function doGet() {
  return txtResponse({ error: 'GET not supported. Use POST.' });
}

function doPost(e) {
  let p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (_) {
    return txtResponse({ error: 'Invalid JSON body' });
  }

  const caller = verifyGoogleToken(p.idToken);
  if (!caller) return txtResponse({ error: 'Unauthorized' });

  const ADMIN_ACTIONS = new Set([
    'addMember', 'removeMember', 'deleteOrder',
    'updateOrderStatus', 'updateFunding', 'addFundraising', 'addFunds'
  ]);
  const MEMBER_ACTIONS = new Set(['addOrder']);

  if (ADMIN_ACTIONS.has(p.action) && !isAdmin(caller.email)) {
    return txtResponse({ error: 'Forbidden' });
  }
  if (MEMBER_ACTIONS.has(p.action) && !isApprovedMember(caller.email)) {
    return txtResponse({ error: 'Forbidden' });
  }

  try {
    switch (p.action) {
      case 'getAllData':
        return txtResponse({
          orders: getOrders(),
          funds: getFundraising(),
          budget: getBudget(),
          members: getMembers()
        });
      case 'getOrders':    return txtResponse(getOrders());
      case 'addOrder':     return txtResponse(addOrderFromParams(p));
      case 'updateOrderStatus': return txtResponse(updateOrderStatus(p));
      case 'deleteOrder':  return txtResponse(deleteOrder(p.uuid));
      case 'getBudget':    return txtResponse(getBudget());
      case 'getFunds':     return txtResponse(getFundraising());
      case 'addFundraising':
      case 'addFunds':     return txtResponse(addFundraisingFromParams(p));
      case 'updateFunding': return txtResponse(updateFunding(p));
      case 'getMembers':   return txtResponse({ members: getMembers() });
      case 'addMember':    return txtResponse(addMember(p));
      case 'removeMember': return txtResponse(removeMember(p));
      case 'registerSelf': return txtResponse(registerSelf(p, caller.email));
      default:
        return txtResponse({ error: 'Invalid action: ' + p.action });
    }
  } catch (err) {
    return txtResponse({ error: err.toString() });
  }
}

// ── ORDERS ───────────────────────────────────────────────────────────────────

function getOrders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
  if (!sheet) return [];
  return sheetToObjects(sheet);
}

function addOrderFromParams(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
  const price = Number(p.price) || 0;
  const quantity = Number(p.quantity) || 1;
  const uuid = p.uuid || generateShortId();
  const totalFormula = '=INDIRECT("D"&ROW())*INDIRECT("E"&ROW())';
  const nextRow = sheet.getLastRow() + 1;
  const colNFormula = `=IF(A${nextRow}<>"", COUNTIF($A$3:A${nextRow}, "<>"), "")`;
  sheet.appendRow([
    sanitizeCell(p.item||''), sanitizeCell(p.company||''), sanitizeCell(p.link||''),
    price, quantity, sanitizeCell(p.notes||''),
    sanitizeCell(p.category||''), sanitizeCell(p.team||''), new Date(), totalFormula,
    sanitizeCell(p.status||'Pending Review'), sanitizeCell(p.tracking||''), uuid,
    colNFormula, sanitizeCell(p.orderedBy||'')
  ]);
  return { success: true, uuid };
}

function updateOrderStatus(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
  const rowIndex = parseInt(p.rowIndex);
  if (!rowIndex || rowIndex < 3 || rowIndex > sheet.getLastRow()) return { error: 'Invalid row' };
  const existingUUID = String(sheet.getRange(rowIndex, 13).getValue());
  if (!p.orderUUID || existingUUID !== String(p.orderUUID)) return { error: 'Row mismatch' };
  if (p.status)   sheet.getRange(rowIndex, 11).setValue(sanitizeCell(p.status));
  if (p.tracking) sheet.getRange(rowIndex, 12).setValue(sanitizeCell(p.tracking));
  return { success: true };
}

function deleteOrder(uuid) {
  if (!uuid) return { error: 'UUID required' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
  const data = sheet.getDataRange().getValues();
  for (let i = 2; i < data.length; i++) {
    if (data[i][12] == uuid) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'ID not found' };
}

function generateShortId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ── BUDGETS ──────────────────────────────────────────────────────────────────

function getBudget() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Budgets');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const headers = data[0], categories = headers.slice(1), result = {};
  categories.forEach(cat => result[cat] = {});
  for (let i = 1; i < data.length; i++) {
    const row = data[i], parent = row[0];
    if (!parent) continue;
    for (let j = 1; j < headers.length; j++) {
      const val = row[j];
      result[headers[j]][parent] = (val === '' || isNaN(val)) ? val : Number(val);
    }
  }
  return result;
}

// ── FUNDRAISING ──────────────────────────────────────────────────────────────

function getFundraising() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fundraising');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0], rows = data.slice(1);
  return rows.filter(r => r.some(c => c !== '')).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = r[i]);
    return obj;
  });
}

function addFundraisingFromParams(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fundraising');
  sheet.appendRow([
    sanitizeCell(p.type||''), sanitizeCell(p.source||''),
    Number(p.amount), new Date(),
    sanitizeCell(p.notes||''), sanitizeCell(p.recipient||'All')
  ]);
  return { success: true };
}

function updateFunding(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fundraising');
  const rowIndex = parseInt(p.rowIndex);
  if (!rowIndex || rowIndex < 2 || rowIndex > sheet.getLastRow()) return { error: 'Invalid row' };
  if (p.Type !== undefined)      sheet.getRange(rowIndex, 1).setValue(sanitizeCell(String(p.Type)));
  if (p.Source !== undefined)    sheet.getRange(rowIndex, 2).setValue(sanitizeCell(String(p.Source)));
  if (p.Amount !== undefined)    sheet.getRange(rowIndex, 3).setValue(Number(p.Amount) || 0);
  if (p.Date !== undefined)      sheet.getRange(rowIndex, 4).setValue(sanitizeCell(String(p.Date)));
  if (p.Notes !== undefined)     sheet.getRange(rowIndex, 5).setValue(sanitizeCell(String(p.Notes)));
  if (p.Recipient !== undefined) sheet.getRange(rowIndex, 6).setValue(sanitizeCell(String(p.Recipient)));
  return { success: true };
}

// ── MEMBERS ──────────────────────────────────────────────────────────────────

function getMembers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const members = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[2]) continue;
    members.push({
      firstName: row[0] || '', lastName: row[1] || '',
      studentId: String(row[2] || ''), team: row[3] || '',
      role: row[4] || '', email: row[5] || ''
    });
  }
  return members;
}

function addMember(p) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Members');
    sheet.appendRow(['firstName', 'lastName', 'studentId', 'team', 'role', 'email']);
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === p.studentId ||
        (p.email && String(data[i][5]).toLowerCase() === p.email.toLowerCase())) {
      return { error: 'Member with this Student ID or Email already exists' };
    }
  }
  sheet.appendRow([
    sanitizeCell(p.firstName||''), sanitizeCell(p.lastName||''),
    sanitizeCell(p.studentId||''), sanitizeCell(p.team||''),
    sanitizeCell(p.role||''), sanitizeCell(p.email||'')
  ]);
  return { success: true };
}

function registerSelf(p, callerEmail) {
  if ((p.email || '').toLowerCase() !== callerEmail.toLowerCase()) {
    return { error: 'Email mismatch' };
  }
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Members');
    sheet.appendRow(['firstName', 'lastName', 'studentId', 'team', 'role', 'email']);
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === p.studentId ||
        (p.email && String(data[i][5]).toLowerCase() === p.email.toLowerCase())) {
      return { error: 'Already registered' };
    }
  }
  sheet.appendRow([
    sanitizeCell(p.firstName||''), sanitizeCell(p.lastName||''),
    sanitizeCell(p.studentId||''), sanitizeCell(p.team||''),
    '', sanitizeCell(p.email||'')
  ]);
  return { success: true };
}

function removeMember(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) return { error: 'Members sheet not found' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === p.studentId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Member not found' };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 3) return [];
  const headers = data[1], rows = data.slice(2);
  return rows.filter(r => r.some(c => c !== '')).map((r, i) => {
    const obj = {};
    headers.forEach((h, k) => obj[h.trim()] = r[k]);
    obj.rowIndex = i + 3;
    return obj;
  });
}

function txtResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.TEXT);
}
