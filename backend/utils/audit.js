import AuditLog from "../models/AuditLog.js";

export const writeAuditLog = async ({
  action,
  actor,
  target,
  targetId,
  meta = {},
}) => {
  try {
    if (!action) return;

    await AuditLog.create({
      action,
      actor: actor
        ? {
            id: actor._id || actor.id || null,
            name: actor.name || "",
            email: actor.email || "",
            role: actor.role || "",
          }
        : undefined,
      target,
      targetId: targetId || undefined,
      meta,
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message || error);
  }
};
