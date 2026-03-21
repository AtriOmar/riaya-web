"use client";

import moment from "moment";
import { useCallback, useMemo, useState } from "react";
import {
  Calendar as BigCalendar,
  momentLocalizer,
  type View,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "sonner";
import useSWR from "swr";
import { CubeLoader } from "@/components/loaders";
import { getAppointments, updateAppointment } from "@/services";
import AddAppointmentModal from "./add-appointment-modal";
import EditAppointmentModal, {
  type CalendarEvent,
} from "./edit-appointment-modal";

const localizer = momentLocalizer(moment);

export default function AppointmentsCalendar() {
  const {
    data: appointments,
    isLoading,
    mutate,
  } = useSWR("appointments", () => getAppointments());

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>("week");
  const [newRange, setNewRange] = useState<{ start: Date; end: Date } | null>(
    null,
  );
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  const events: CalendarEvent[] = useMemo(
    () =>
      (appointments ?? [])
        .filter((a) => a.start && a.end)
        .map((a) => ({
          id: a.id,
          title: (
            <p className="text-[11px]! leading-tight">
              <span className="font-medium">
                {a.patient?.firstName ?? ""} {a.patient?.lastName ?? ""}
              </span>{" "}
              — {a.name}
            </p>
          ),
          start: new Date(a.start ?? ""),
          end: new Date(a.end ?? ""),
          name: a.name ?? "",
          description: a.description ?? "",
          status: a.status ?? "confirmed",
          patient: a.patient,
        })),
    [appointments],
  );

  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      const roundedStart = new Date(
        Math.round(start.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
      );
      const roundedEnd = new Date(
        Math.round(end.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
      );

      const isOverlap = events.some(
        (e) => roundedStart < e.end && roundedEnd > e.start,
      );
      if (isOverlap) {
        toast.error("Cannot schedule overlapping appointments");
        return;
      }
      setNewRange({ start: roundedStart, end: roundedEnd });
    },
    [events],
  );

  const _handleMoveEvent = useCallback(
    async ({
      event,
      start,
      end,
    }: {
      event: CalendarEvent;
      start: Date;
      end: Date;
    }) => {
      const roundedStart = new Date(
        Math.round(start.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
      );
      const roundedEnd = new Date(
        Math.round(end.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
      );

      if (roundedEnd <= roundedStart) return;

      const isOverlap = events.some(
        (e) =>
          e.id !== event.id && roundedStart < e.end && roundedEnd > e.start,
      );
      if (isOverlap) {
        toast.error("Cannot move to an overlapping time slot");
        return;
      }

      try {
        await updateAppointment({
          id: event.id,
          start: roundedStart.toISOString(),
          end: roundedEnd.toISOString(),
        });
        toast.success("Appointment moved");
        mutate();
      } catch {
        toast.error("Failed to move appointment");
      }
    },
    [events, mutate],
  );

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (event.status === "pending") {
      return {
        className:
          "!bg-yellow-600 hover:!bg-yellow-700 !transition !duration-200 !z-10",
      };
    }
    return {
      className:
        "!bg-primary hover:!bg-primary/90 !transition !duration-200 !z-10",
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <CubeLoader />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mt-4">
      <div className="min-w-[600px]">
        <AddAppointmentModal
          open={!!newRange}
          onClose={() => setNewRange(null)}
          range={newRange}
          onSuccess={() => mutate()}
        />
        <EditAppointmentModal
          open={!!editEvent}
          onClose={() => setEditEvent(null)}
          event={editEvent}
          onSuccess={() => mutate()}
        />
        <BigCalendar
          localizer={localizer}
          events={events}
          date={currentDate}
          onNavigate={setCurrentDate}
          view={currentView}
          onView={setCurrentView}
          defaultView="week"
          views={["month", "week", "day", "agenda"]}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(event) => setEditEvent(event as CalendarEvent)}
          step={30}
          timeslots={1}
          min={new Date(0, 0, 0, 8, 0)}
          max={new Date(0, 0, 0, 20, 0)}
          toolbar
          eventPropGetter={eventPropGetter}
          style={{ height: 700 }}
        />
      </div>
    </div>
  );
}
