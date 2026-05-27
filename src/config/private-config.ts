import "server-only";
import { z } from "zod";

const privateConfigSchema = z.object({
  neynarApiKey: z.string(),
});

export const privateConfig = privateConfigSchema.parse({
  neynarApiKey: process.env.NEYNAR_API_KEY || "",
});
