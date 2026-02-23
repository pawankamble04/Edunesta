import User from "../models/User.js";

const CODE_PREFIX = "TCH-";
const CODE_LENGTH = 6;
const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const randomCodePart = () => {
  let value = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ALPHANUM.length);
    value += ALPHANUM[index];
  }
  return value;
};

export const generateUniqueTeacherJoinCode = async () => {
  while (true) {
    const teacherJoinCode = `${CODE_PREFIX}${randomCodePart()}`;
    const existing = await User.exists({ teacherJoinCode });
    if (!existing) return teacherJoinCode;
  }
};
