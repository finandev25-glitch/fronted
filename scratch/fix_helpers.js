import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const helperPath = path.join(__dirname, "../src/features/deposits/components/depositDetailModalHelpers.jsx");

let code = fs.readFileSync(helperPath, "utf-8");
const badStart = code.indexOf("export const formatPhoneForYCloud");
if(badStart !== -1) {
  code = code.substring(0, badStart);
}

const append = `
export const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return "";
  return phone.replace(/\\D/g, "");
};

export const formatPhoneForYCloud = (phone) => {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return "";
  return formatted.startsWith("+") ? formatted : \`+\${formatted}\`;
};

export const buildYCloudMessagePayload = ({ configId, to, text, replyMessageId, forceReply = false }) => {
  const payload = {
    to,
    text,
    channel: "whatsapp",
    config_id: configId
  };

  if (replyMessageId) {
    payload.context = {
      message_id: replyMessageId
    };
  }

  return payload;
};

export const buildConfirmationMessage = ({ empresa, banco, fechaDeposito, operacion, moneda, monto }) => {
  const sym = moneda === "USD" ? "$" : "S/";
  return \`✅ *DEPÓSITO CONFIRMADO*

🏢 *Empresa:* \${empresa}
🏦 *Banco:* \${banco}
📅 *Fecha:* \${fechaDeposito}
🔢 *Operación:* \${operacion}
💰 *Monto:* \${sym} \${monto}\`;
};

export const buildRejectionMessage = (reason) => {
  return \`❌ *DEPÓSITO RECHAZADO*

⚠️ *Su depósito no ha sido aprobado*

📝 *Motivo del rechazo:*
\${reason}\`;
};
`;

fs.writeFileSync(helperPath, code + append, "utf-8");
