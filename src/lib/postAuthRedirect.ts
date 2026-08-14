import { AppUser } from "@/types";

export function getPostAuthRedirect(profile: AppUser | null): string {
  if (!profile) return "/login";
  if (!profile.neighborhoodId) return "/choose-neighborhood";
  if (profile.verificationStatus !== "verified") return "/verify-neighborhood";
  return "/dashboard";
}
