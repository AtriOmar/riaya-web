"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Speciality } from "@/services/types";

type Props = {
  specialities: Speciality[];
  value?: string;
  onChange: (value: string) => void;
};

export default function SpecialitySelect({
  specialities,
  value,
  onChange,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="Select a speciality" />
      </SelectTrigger>
      <SelectContent>
        {specialities.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
