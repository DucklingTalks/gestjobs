import { z } from "zod";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "Enter a valid email address.",
  )
  .transform((value) => value || null);

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    if (!value) return true;

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid HTTP(S) URL.")
  .transform((value) => value || null);

export const contactIdSchema = z.string().uuid("Invalid contact.");

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: optionalEmail,
  phone: optionalText(50),
  linkedin_url: optionalHttpUrl,
  notes: optionalText(2_000),
});

export type ContactInput = z.infer<typeof contactSchema>;
