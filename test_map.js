import fs from "fs";
const data = fs.readFileSync("./src/features/deposits/api/depositsApi.js", "utf-8");
console.log(data.substring(0, 100));
