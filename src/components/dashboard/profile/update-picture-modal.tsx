"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import ImageCropper from "@/components/dashboard/profile/image-cropper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function UpdatePictureModal({ open, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setImageUrl(URL.createObjectURL(file));
  }

  function handleDone() {
    setImageUrl(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Profile Picture</DialogTitle>
        </DialogHeader>

        {/* biome-ignore lint/a11y/useKeyWithClickEvents: drop zone contains a visible <Button> for keyboard users */}
        <div
          className="flex flex-col justify-center items-center p-4 border-2 hover:border-primary border-dashed rounded-lg transition cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button variant="default" size="sm" type="button">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <p className="mt-2 text-muted-foreground text-sm text-center">
            Or drop an image here
          </p>
        </div>

        {imageUrl && (
          <ImageCropper
            imageUrl={imageUrl}
            onDone={handleDone}
            onCancel={() => setImageUrl(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
