const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = "c:\\Users\\admin\\Desktop\\work\\societies\\DevX\\DevX tools\\registration\\XƎN-O-THON '26_ The Offline Showdown - Official RSVP (Responses).xlsx";
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Headers:', JSON.stringify(data[0]));

// Convert to CSV
const headers = data[0];
// Let's find the indices of Name and Email columns
// If there are multiple, we'll try to find Team, Name, Email, etc.
// But first just list them.
