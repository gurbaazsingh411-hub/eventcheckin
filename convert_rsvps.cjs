const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = "c:\\Users\\admin\\Desktop\\work\\societies\\DevX\\DevX tools\\registration\\XƎN-O-THON '26_ The Offline Showdown - Official RSVP (Responses).xlsx";
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Read data starting from the second row (skipping the main header if needed)
// Wait, sheet_to_json with no options uses first row as keys.
const data = XLSX.utils.sheet_to_json(worksheet);

const participants = [];

function addParticipant(name, email) {
  if (name && typeof name === 'string' && name.trim().toLowerCase() !== "n/a" && name.trim() !== "") {
    if (email && typeof email === 'string' && email.trim().toLowerCase() !== "n/a" && email.trim() !== "") {
      participants.push({ Name: name.trim(), Email: email.trim() });
    }
  }
}

for (const row of data) {
  addParticipant(row["Team Leader Full Name"], row["Leaders Email ID"]);
  addParticipant(row["Member 2 : Name"], row["Member 2 : Email Id"]);
  addParticipant(row["Member 3: Name (If not any write N/A)"], row["Member 3 : Email Id (If not any write N/A)"]);
  addParticipant(row["Member 4: Name (If not any write N/A)"], row["Member 4: Email Id (If not any write N/A)"]);
}

// Convert to CSV
let csvContent = "Name,Email\n";
for (const p of participants) {
  // Escape double quotes and commas
  const nameSafe = p.Name.replace(/"/g, '""');
  const emailSafe = p.Email.replace(/"/g, '""');
  csvContent += `"${nameSafe}","${emailSafe}"\n`;
}

const outPath = path.join(__dirname, 'real_participants.csv');
fs.writeFileSync(outPath, csvContent, 'utf8');

console.log(`Created real_participants.csv with ${participants.length} participants.`);
