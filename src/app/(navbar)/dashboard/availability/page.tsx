import AvailabilityForm from "@/components/dashboard/availability/availability-form";

export default function AvailabilityPage() {
  return (
    <div className="pr-2 md:pr-10 pb-20 pl-2">
      <h3 className="font-bold text-2xl">Availability</h3>
      <p className="mt-2 text-muted-foreground">
        Set your availability to let patients know when they can book an
        appointment with you.
      </p>
      <AvailabilityForm />
    </div>
  );
}
