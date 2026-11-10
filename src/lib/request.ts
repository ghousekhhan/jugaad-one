import { z } from "zod";

export const exampleRequest = {
  text: "Paneer makhani under ₹350, within 5 km, fastest delivery.",
  category: "food",
  budget: "350",
  distance: "5",
  priority: "fastest",
  location: "",
  language: "en-IN",
} as const;

export const blankRequest = {
  text: "",
  category: "",
  budget: "",
  distance: "",
  priority: "",
  location: "",
  language: "en-IN",
} as const;

export type RequestDraft = Record<keyof typeof blankRequest, string>;
export const categories = ["food", "rides"] as const;
export const languages = ["en-IN", "hi-IN", "te-IN"] as const;

const optionalPositiveNumber = (label: string) => z.string().trim().refine(
  (value) => value === "" || (/^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0),
  `Enter a positive ${label} with up to two decimal places.`,
);

export const requestSchema = z.object({
  text: z.string().trim().min(1, "Enter a request or load the example.").max(1000, "Use 1,000 characters or fewer."),
  category: z.enum(["", ...categories]),
  budget: optionalPositiveNumber("budget"),
  distance: optionalPositiveNumber("distance"),
  priority: z.enum(["", "fastest", "lowest-price"]),
  location: z.string().trim().max(120, "Use 120 characters or fewer for the location."),
  language: z.enum(languages),
});

export type SavedRequest = z.infer<typeof requestSchema>;

export const requestLanguages = {
  "en-IN": { label: "English", script: "en" },
  "hi-IN": { label: "Hindi", script: "hi" },
  "te-IN": { label: "Telugu", script: "te" },
} as const;
