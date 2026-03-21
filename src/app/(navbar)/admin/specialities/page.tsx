import SpecialitiesManager from "@/components/admin/specialities-manager";

export default function AdminSpecialitiesPage() {
  return (
    <div className="pr-2 md:pr-10 pb-20 pl-2">
      <h3 className="mb-4 font-bold text-2xl">Specialities</h3>
      <SpecialitiesManager />
    </div>
  );
}
