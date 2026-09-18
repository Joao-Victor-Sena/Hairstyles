const nodemailer = require("nodemailer");

function getTransporter() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  if (required.some((key) => !process.env[key])) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendRecoveryEmail({ to, temporaryPassword }) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("SMTP nao configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS.");
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Sua senha temporaria | Hairstyles",
    text: [
      "Recebemos uma solicitacao de recuperacao de senha.",
      "",
      `Sua senha temporaria e: ${temporaryPassword}`,
      "Entre na sua conta e altere a senha assim que possivel.",
      "",
      "Se voce nao fez esta solicitacao, ignore este e-mail.",
    ].join("\n"),
  });
}

module.exports = { sendRecoveryEmail };
