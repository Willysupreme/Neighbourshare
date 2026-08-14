/**
 * Client-side image upload via Cloudinary's unsigned upload API.
 *
 * Used instead of Firebase Storage (§22/§54 technical note): Firebase
 * Cloud Storage requires the project to be on the Blaze (billing-enabled)
 * plan, even though usage would very likely stay within the free tier for
 * an MVP-scale app. Cloudinary's free tier (~25 monthly credits, roughly
 * 25GB of combined storage/bandwidth) requires no billing details and
 * covers MVP-scale photo uploads comfortably. This is documented as an
 * external integration in the architecture docs rather than treated as
 * Firebase Storage with a different name.
 *
 * The upload happens directly from the browser to Cloudinary using an
 * UNSIGNED upload preset - no API secret is ever present in client code,
 * and our own server never touches the image bytes.
 */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class ImageUploadError extends Error {}

export function validateImageFile(file: File): void {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageUploadError("Please upload a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ImageUploadError("Images must be under 5MB.");
  }
}

export async function uploadImageToCloudinary(file: File): Promise<string> {
  validateImageFile(file);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new ImageUploadError(
      "Image uploads aren't configured yet. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and " +
        "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your environment."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "neighborshare");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ImageUploadError(body?.error?.message ?? "Image upload failed. Please try again.");
  }

  const data = await res.json();
  return data.secure_url as string;
}

export async function uploadImagesToCloudinary(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadImageToCloudinary(file));
  }
  return urls;
}
