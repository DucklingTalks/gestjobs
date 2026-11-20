import { z } from "zod";

/** Interview limits and transcript shape, shared by the chat UI and the server. */

export const MAX_CANDIDATE_ANSWERS = 15;
export const MIN_ANSWERS_TO_SUMMARIZE = 2;
export const MAX_MESSAGE_LENGTH = 2_000;
export const MAX_PROPOSED_STRENGTHS = 12;

export const interviewMessageSchema = z.object({
  role: z.enum(["interviewer", "candidate"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export type InterviewMessage = z.infer<typeof interviewMessageSchema>;

export const transcriptSchema = z
  .array(interviewMessageSchema)
  .max(MAX_CANDIDATE_ANSWERS * 2 + 2)
  .refine((messages) => candidateAnswers(messages) <= MAX_CANDIDATE_ANSWERS, {
    message: "The interview is already at its limit. Review the proposed strengths.",
  });

export function candidateAnswers(messages: InterviewMessage[]): number {
  return messages.filter((message) => message.role === "candidate").length;
}
