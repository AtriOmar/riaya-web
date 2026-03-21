import NewPatientForm from "@/components/dashboard/patients/new-patient-form";

export default function NewPatientPage() {
  return (
    <div className="pr-2 md:pr-10 pb-20 pl-2">
      <h3 className="mb-4 font-bold text-2xl">New Patient</h3>
      <NewPatientForm />
    </div>
  );
}
