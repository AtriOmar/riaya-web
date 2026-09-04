"use client";

import { Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import type { GetApiSpecialities200Item } from "@/services/generated/api.schemas";
import {
	deleteApiSpecialities,
	postApiSpecialities,
	putApiSpecialities,
	useGetApiSpecialities,
} from "@/services/generated/miscellaneous/miscellaneous";

export default function SpecialitiesManager() {
	const { data: specialities, mutate } = useGetApiSpecialities();
	const [newEnName, setNewEnName] = useState("");
	const [newFrName, setNewFrName] = useState("");
	const [newArName, setNewArName] = useState("");
	const [newSlug, setNewSlug] = useState("");
	const [adding, setAdding] = useState(false);

	const [editItem, setEditItem] = useState<GetApiSpecialities200Item | null>(
		null,
	);
	const [editEnName, setEditEnName] = useState("");
	const [editFrName, setEditFrName] = useState("");
	const [editArName, setEditArName] = useState("");
	const [editSlug, setEditSlug] = useState("");

	const [deleteItem, setDeleteItem] =
		useState<GetApiSpecialities200Item | null>(null);
	const [reassignTo, setReassignTo] = useState("");

	const getSpecialityLabel = (s: GetApiSpecialities200Item) =>
		s.enName ?? s.frName ?? s.arName ?? "—";

	async function handleAdd() {
		if (!newEnName.trim() || !newFrName.trim() || !newArName.trim()) return;
		setAdding(true);
		try {
			await postApiSpecialities({
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
			await putApiSpecialities({
				id: editItem.id,
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
			await deleteApiSpecialities({
				id: deleteItem.id,
				newSpecialityId: parseInt(reassignTo, 10),
			});
			toast.success("Speciality deleted");
			setDeleteItem(null);
			setReassignTo("");
			mutate();
		} catch {
			toast.error("Failed to delete speciality");
		}
	}

	const columns: Column<GetApiSpecialities200Item>[] = [
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
						variant="ghost"
						size="icon"
						title="Edit"
						onClick={() => {
							setEditItem(row);
							setEditEnName(row.enName ?? "");
							setEditFrName(row.frName ?? "");
							setEditArName(row.arName ?? "");
							setEditSlug(row.slug ?? "");
						}}
					>
						<Pencil className="w-4 h-4 text-muted-foreground" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						title="Delete"
						onClick={() => setDeleteItem(row)}
					>
						<Trash2 className="w-4 h-4 text-destructive/80 hover:text-destructive" />
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
				keyExtractor={(row) => String(row.id)}
				emptyMessage={
					<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
						<Inbox className="mb-4 w-12 h-12 opacity-50" />
						<span className="font-semibold text-foreground">
							No specialities found
						</span>
						<span className="mt-1 text-sm">
							Try adjusting your filters or search terms
						</span>
					</div>
				}
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
