"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteAppointment, updateAppointment } from "@/services";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
});

type FormValues = z.infer<typeof schema>;

export type CalendarEvent = {
  id: number;
  title: React.ReactNode;
  start: Date;
  end: Date;
  name: string;
  description?: string;
  status: string;
  patient?: { firstName: string | null; lastName: string | null } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onSuccess: () => void;
};

export default function EditAppointmentModal({
  open,
  onClose,
  event,
  onSuccess,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (event) {
      reset({ name: event.name, description: event.description ?? "" });
    }
  }, [event, reset]);

  async function onSubmit(values: FormValues) {
    if (!event) return;
    try {
      await updateAppointment({
        id: event.id,
        name: values.name,
        description: values.description,
      });
      toast.success("Appointment updated");
      onClose();
      onSuccess();
    } catch {
      toast.error("Failed to update appointment");
    }
  }

  async function handleDelete() {
    if (!event) return;
    try {
      await deleteAppointment(event.id);
      toast.success("Appointment deleted");
      onClose();
      onSuccess();
    } catch {
      toast.error("Failed to delete appointment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Edit Appointment</DialogTitle>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </DialogHeader>

        {event && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <CalendarDays className="w-5 h-5" />
            <span className="font-medium">
              {event.start.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                weekday: "short",
                year: "numeric",
              })}
            </span>
            <span>|</span>
            <span>
              From:{" "}
              <span className="px-2 py-0.5 border rounded">
                {event.start.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
            <span>
              To:{" "}
              <span className="px-2 py-0.5 border rounded">
                {event.end.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          </div>
        )}

        {event?.patient && (
          <div>
            <Label>Patient</Label>
            <div className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-sm">
              {event.patient.firstName} {event.patient.lastName}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="mt-1 text-destructive text-sm">
                {errors.name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
