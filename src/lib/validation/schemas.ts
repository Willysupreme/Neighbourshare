import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  neighborhoodId: z.string().min(1, "Select a neighborhood"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verificationSchema = z.object({
  neighborhoodId: z.string().min(1),
  code: z.string().trim().min(4, "Enter the verification code"),
});
export type VerificationInput = z.infer<typeof verificationSchema>;

export const itemSchema = z.object({
  name: z.string().trim().min(2, "Item name is required").max(100),
  category: z.enum([
    "power_tools",
    "hand_tools",
    "lawn_garden",
    "cleaning",
    "ladders_access",
    "other",
  ]),
  description: z.string().trim().min(10, "Please add a short description (10+ characters)").max(1000),
  condition: z.enum(["excellent", "good", "fair", "needs_repair"]),
  pickupInstructions: z.string().trim().max(500).optional(),
  imageUrls: z.array(z.string().url()).max(5, "Up to 5 photos per item").optional(),
});
export type ItemInput = z.infer<typeof itemSchema>;

export const bookingRequestSchema = z
  .object({
    itemId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const damageReportSchema = z.object({
  bookingId: z.string().min(1),
  description: z.string().trim().min(10, "Please describe the issue (10+ characters)").max(1000),
  severity: z.enum(["minor", "moderate", "severe"]),
});
export type DamageReportInput = z.infer<typeof damageReportSchema>;

export const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;
