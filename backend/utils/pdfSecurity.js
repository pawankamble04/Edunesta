import crypto from "crypto";
import path from "path";

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

export const isPdfMimeType = (mimeType) =>
  String(mimeType || "").trim().toLowerCase() === "application/pdf";

export const hasPdfExtension = (filename) =>
  path.extname(String(filename || "").trim()).toLowerCase() === ".pdf";

export const isPdfSignatureValid = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < PDF_SIGNATURE.length) {
    return false;
  }
  return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
};

export const createSecurePdfFilename = () =>
  `${Date.now()}-${crypto.randomBytes(16).toString("hex")}.pdf`;
