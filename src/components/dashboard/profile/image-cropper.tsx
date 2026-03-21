"use client";

import { Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadBlobToR2 } from "@/lib/upload";
import { updateProfilePicture } from "@/services";

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2d context");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to create blob"));
        else resolve(blob);
      },
      "image/jpeg",
      0.9,
    );
  });
}

type Props = {
  imageUrl: string;
  onDone: () => void;
  onCancel: () => void;
};

export default function ImageCropper({ imageUrl, onDone, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleSave() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageUrl, croppedAreaPixels);
      const cdnUrl = await uploadBlobToR2(
        blob,
        "profile.jpg",
        "profile-pictures",
      );
      await updateProfilePicture(cdnUrl);
      toast.success("Profile picture updated");
      onDone();
    } catch {
      toast.error("Failed to update profile picture");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="relative h-[250px] overflow-hidden rounded-lg">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>
      <div className="flex justify-center gap-2 mt-4">
        <Button onClick={handleSave} disabled={saving}>
          <Upload className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="destructive" onClick={onCancel}>
          <X className="w-4 h-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
