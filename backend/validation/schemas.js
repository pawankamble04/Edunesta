import { z } from "zod";
import { isValidYouTubeUrl } from "../utils/youtube.js";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const joinCodeRegex = /^TCH-[A-Z0-9]{6}$/;

const objectId = z
  .string()
  .trim()
  .regex(objectIdRegex, "Invalid ID format");

const nonEmptyString = z.string().trim().min(1, "Required");
const roleEnum = z.enum(["student", "teacher", "parent", "admin"]);
const visibilityEnum = z.enum(["all", "students", "teachers"]);
const youtubeUrlSchema = z
  .string()
  .trim()
  .url("Invalid URL")
  .max(2048)
  .refine((value) => isValidYouTubeUrl(value), {
    message: "Invalid YouTube link",
  });

const aiReviewSchema = z
  .object({
    clarityScore: z.number().min(1).max(10),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    issues: z.array(z.string()).optional(),
    improvementSuggestions: z.array(z.string()).optional(),
    reviewedAt: z.union([z.string(), z.date()]).optional(),
  })
  .strict();

export const registerSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(120),
      password: z.string().min(8).max(128),
      role: z.enum(["student", "teacher", "parent"]).optional(),
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().email().max(120),
      password: nonEmptyString.max(128),
    })
    .strict(),
});

export const googleAuthSchema = z.object({
  body: z
    .object({
      credential: nonEmptyString.max(4096),
    })
    .strict(),
});

export const objectIdParamSchema = (paramName = "id") =>
  z.object({
    params: z.object({
      [paramName]: objectId,
    }),
  });

export const createTestSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(2).max(140),
      description: z.string().trim().max(2000).optional(),
      durationMinutes: z.coerce.number().int().min(1).max(600),
      totalMarks: z.coerce.number().int().min(1).max(10000),
      subject: z.string().trim().min(2).max(50),
    })
    .strict(),
});

export const addQuestionSchema = z.object({
  params: z.object({
    testId: objectId,
  }),
  body: z
    .object({
      text: z.string().trim().min(5).max(3000),
      options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
      correctAnswer: z.coerce.number().int().min(0),
      marks: z.coerce.number().int().min(1).max(100).optional(),
      topic: z.string().trim().min(1).max(120).optional(),
      aiReview: aiReviewSchema.optional(),
    })
    .strict()
    .refine((value) => value.correctAnswer < value.options.length, {
      message: "correctAnswer index out of range",
      path: ["correctAnswer"],
    }),
});

export const updateQuestionSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      text: z.string().trim().min(5).max(3000).optional(),
      options: z.array(z.string().trim().min(1).max(500)).min(2).max(10).optional(),
      correctAnswer: z.coerce.number().int().min(0).optional(),
      marks: z.coerce.number().int().min(1).max(100).optional(),
      topic: z.string().trim().min(1).max(120).optional(),
      aiReview: aiReviewSchema.nullable().optional(),
    })
    .strict()
    .refine(
      (value) =>
        !(value.options && value.correctAnswer !== undefined) ||
        value.correctAnswer < value.options.length,
      {
        message: "correctAnswer index out of range",
        path: ["correctAnswer"],
      }
    ),
});

export const submitTestSchema = z.object({
  body: z
    .object({
      testId: objectId,
      answers: z
        .array(
          z
            .object({
              question: objectId,
              selected: z.coerce.number().int().min(0).nullable().optional(),
            })
            .strict()
        )
        .max(500),
    })
    .strict(),
});

export const uploadMaterialSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().max(2000).optional(),
      visibleTo: visibilityEnum.optional(),
    })
    .strict(),
});

export const createLectureSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(2).max(180),
      youtubeUrl: youtubeUrlSchema,
      subject: z.string().trim().min(2).max(80),
      batch: z.string().trim().max(80).optional(),
      isPublished: z.boolean().optional(),
    })
    .strict(),
});

export const updateLectureSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      title: z.string().trim().min(2).max(180).optional(),
      youtubeUrl: youtubeUrlSchema.optional(),
      subject: z.string().trim().min(2).max(80).optional(),
      batch: z.string().trim().max(80).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
});

export const updateLecturePublishSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      isPublished: z.boolean(),
    })
    .strict(),
});

export const teacherLecturesQuerySchema = z.object({
  query: z.object({
    subject: z.string().trim().min(2).max(80).optional(),
    isPublished: z.enum(["true", "false"]).optional(),
  }),
});

export const studentLecturesQuerySchema = z.object({
  query: z.object({
    subject: z.string().trim().min(2).max(80).optional(),
  }),
});

export const addTeacherSubjectSchema = z.object({
  body: z
    .object({
      subject: z.string().trim().min(2).max(50),
    })
    .strict(),
});

export const removeTeacherSubjectSchema = z.object({
  params: z.object({
    subject: z.string().trim().min(2).max(50),
  }),
});

export const teacherJoinCodeParamSchema = z.object({
  params: z.object({
    joinCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(joinCodeRegex, "Invalid join code format"),
  }),
});

export const connectToTeacherSchema = z.object({
  body: z
    .object({
      joinCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(joinCodeRegex, "Invalid join code format"),
      subject: z.string().trim().min(2).max(50),
    })
    .strict(),
});

export const connectStudentByTeacherSchema = z.object({
  body: z
    .object({
      studentEmail: z.string().trim().email().max(120),
      subject: z.string().trim().min(2).max(50),
    })
    .strict(),
});

export const parentLinkStudentSchema = z.object({
  body: z
    .object({
      code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
    })
    .strict(),
});

export const changeUserRoleSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      role: roleEnum,
    })
    .strict(),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      isActive: z.boolean(),
    })
    .strict(),
});

export const adminUsersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(120).optional(),
  }),
});

export const auditLogsQuerySchema = z.object({
  query: z.object({
    action: z.string().trim().max(120).optional(),
    target: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
});

export const cleanupStaleTestAttemptsQuerySchema = z.object({
  query: z.object({
    graceHours: z.coerce.number().int().min(0).max(24 * 365).optional(),
    limit: z.coerce.number().int().min(1).max(50000).optional(),
  }),
});
