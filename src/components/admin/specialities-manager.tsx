"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import DataTable, { type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	createSpeciality,
	deleteSpeciality,
	getSpecialities,
	updateSpeciality,
} from "@/services";
import type { Speciality } from "@/services/types";

export default function SpecialitiesManager() {
	const { data: specialities, mutate } = useSWR(
		"admin-specialities",
		getSpecialities,
	);
	const [newEnName, setNewEnName] = useState("");
	const [newFrName, setNewFrName] = useState("");
	const [newArName, setNewArName] = useState("");
	const [newSlug, setNewSlug] = useState("");
	const [adding, setAdding] = useState(false);

	const [editItem, setEditItem] = useState<Speciality | null>(null);
	const [editEnName, setEditEnName] = useState("");
	const [editFrName, setEditFrName] = useState("");
	const [editArName, setEditArName] = useState("");
	const [editSlug, setEditSlug] = useState("");

	const [deleteItem, setDeleteItem] = useState<Speciality | null>(null);
	const [reassignTo, setReassignTo] = useState("");

	const getSpecialityLabel = (s: Speciality) =>
		s.enName ?? s.frName ?? s.arName ?? "—";

	async function handleAdd() {
		if (!newEnName.trim() || !newFrName.trim() || !newArName.trim()) return;
		setAdding(true);
		try {
			await createSpeciality({
				enName: newEnName.trim(),
				frName: newFrName.trim(),
				arName: newArName.trim(),
				slug: newSlug.trim() || undefined,
			});
			toast.success("Speciality added");
			setNewEnName("");
			setNewFrName("");
			setNewArName("");
			setNewSlug("");
			mutate();
		} catch {
			toast.error("Failed to add speciality");
		} finally {
			setAdding(false);
		}
	}

	async function handleEdit() {
		if (
			!editItem ||
			!editEnName.trim() ||
			!editFrName.trim() ||
			!editArName.trim()
		)
			return;
		try {
			await updateSpeciality(editItem.id, {
				enName: editEnName.trim(),
				frName: editFrName.trim(),
				arName: editArName.trim(),
				slug: editSlug.trim() || undefined,
			});
			toast.success("Speciality updated");
			setEditItem(null);
			mutate();
		} catch {
			toast.error("Failed to update speciality");
		}
	}

	async function handleDelete() {
		if (!deleteItem || !reassignTo) return;
		try {
			await deleteSpeciality(deleteItem.id, Number(reassignTo));
			toast.success("Speciality deleted");
			setDeleteItem(null);
			setReassignTo("");
			mutate();
		} catch {
			toast.error("Failed to delete speciality");
		}
	}

	const columns: Column<Speciality>[] = [
		{ key: "enName", header: "English Name", cell: (row) => row.enName ?? "—" },
		{ key: "frName", header: "French Name", cell: (row) => row.frName ?? "—" },
		{ key: "arName", header: "Arabic Name", cell: (row) => row.arName ?? "—" },
		{ key: "slug", header: "Slug", cell: (row) => row.slug ?? "—" },
		{
			key: "actions",
			header: "Actions",
			className: "text-right",
			cell: (row) => (
				<div className="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setEditItem(row);
							setEditEnName(row.enName ?? "");
							setEditFrName(row.frName ?? "");
							setEditArName(row.arName ?? "");
							setEditSlug(row.slug ?? "");
						}}
					>
						<Pencil className="w-3 h-3" />
						Edit
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setDeleteItem(row)}
					>
						<Trash2 className="w-3 h-3" />
						Delete
					</Button>
				</div>
			),
		},
	];

	return (
		<div className="space-y-4">
			{/* Edit Dialog */}
			<Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Speciality</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<Label>English Name</Label>
						<Input
							value={editEnName}
							onChange={(e) => setEditEnName(e.target.value)}
						/>
						<Label>French Name</Label>
						<Input
							value={editFrName}
							onChange={(e) => setEditFrName(e.target.value)}
						/>
						<Label>Arabic Name</Label>
						<Input
							value={editArName}
							onChange={(e) => setEditArName(e.target.value)}
						/>
						<Label>Slug (optional)</Label>
						<Input
							value={editSlug}
							onChange={(e) => setEditSlug(e.target.value)}
						/>
						<Button onClick={handleEdit} className="w-full">
							Save
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Dialog */}
			<Dialog
				open={!!deleteItem}
				onOpenChange={(v) => !v && setDeleteItem(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Delete Speciality:{" "}
							{deleteItem ? getSpecialityLabel(deleteItem) : "—"}
						</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						Doctors with this speciality will be reassigned. Choose a new
						speciality:
					</p>
					<Select value={reassignTo} onValueChange={setReassignTo}>
						<SelectTrigger>
							<SelectValue placeholder="Select speciality" />
						</SelectTrigger>
						<SelectContent>
							{(specialities ?? [])
								.filter((s) => s.id !== deleteItem?.id)
								.map((s) => (
									<SelectItem key={s.id} value={String(s.id)}>
										{getSpecialityLabel(s)}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<Button
						variant="destructive"
						onClick={handleDelete}
						className="w-full"
					>
						Delete
					</Button>
				</DialogContent>
			</Dialog>

			<DataTable
				columns={columns}
				data={specialities ?? []}
				keyExtractor={(row) => row.id}
				emptyMessage="No specialities found."
			/>

			{/* Add form */}
			<div className="gap-3 grid md:grid-cols-2">
				<div className="grow">
					<Label>English Name</Label>
					<Input
						placeholder="e.g. Cardiology"
						value={newEnName}
						onChange={(e) => setNewEnName(e.target.value)}
					/>
				</div>
				<div className="grow">
					<Label>French Name</Label>
					<Input
						placeholder="e.g. Cardiologie"
						value={newFrName}
						onChange={(e) => setNewFrName(e.target.value)}
					/>
				</div>
				<div className="grow">
					<Label>Arabic Name</Label>
					<Input
						placeholder="e.g. Amrad Al Qalb"
						value={newArName}
						onChange={(e) => setNewArName(e.target.value)}
					/>
				</div>
				<div className="grow">
					<Label>Slug (optional)</Label>
					<Input
						placeholder="e.g. cardiology"
						value={newSlug}
						onChange={(e) => setNewSlug(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleAdd()}
					/>
				</div>
			</div>
			<div className="flex justify-end">
				<Button onClick={handleAdd} disabled={adding}>
					<Plus className="w-4 h-4" />
					Add
				</Button>
			</div>
		</div>
	);
}
