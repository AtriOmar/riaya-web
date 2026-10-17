"use client";

import { Inbox, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import DataTable, { type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FilterSearch } from "@/components/ui/filter-controls";
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
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetApiSpecialities200Item } from "@/services/generated/api.schemas";
import {
	deleteApiSpecialities,
	postApiSpecialities,
	putApiSpecialities,
	useGetApiSpecialities,
} from "@/services/generated/miscellaneous/miscellaneous";

type FormState = {
	enName: string;
	frName: string;
	arName: string;
	slug: string;
};

const EMPTY_FORM: FormState = { enName: "", frName: "", arName: "", slug: "" };

const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
	return useSyncExternalStore(
		(cb) => {
			const mq = window.matchMedia(DESKTOP_QUERY);
			mq.addEventListener("change", cb);
			return () => mq.removeEventListener("change", cb);
		},
		() => window.matchMedia(DESKTOP_QUERY).matches,
		() => false,
	);
}

export default function SpecialitiesManager() {
	const { data: specialities, mutate, isLoading } = useGetApiSpecialities();
	const [search, setSearch] = useState("");

	// Right sidebar (always visible on desktop, a sheet on small screens).
	// `editItem === null` means "add", otherwise "edit".
	const isDesktop = useIsDesktop();
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editItem, setEditItem] = useState<GetApiSpecialities200Item | null>(
		null,
	);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [saving, setSaving] = useState(false);

	const [deleteItem, setDeleteItem] =
		useState<GetApiSpecialities200Item | null>(null);
	const [reassignTo, setReassignTo] = useState("");

	const getSpecialityLabel = (s: GetApiSpecialities200Item) =>
		s.enName ?? s.frName ?? s.arName ?? "—";

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return specialities ?? [];
		return (specialities ?? []).filter((s) =>
			[s.enName, s.frName, s.arName, s.slug].some((v) =>
				v?.toLowerCase().includes(q),
			),
		);
	}, [specialities, search]);

	const canSave =
		form.enName.trim() && form.frName.trim() && form.arName.trim() && !saving;

	function setField(key: keyof FormState, value: string) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	function resetForm() {
		setEditItem(null);
		setForm(EMPTY_FORM);
	}

	function openAdd() {
		resetForm();
		setSheetOpen(true);
	}

	function openEdit(row: GetApiSpecialities200Item) {
		setEditItem(row);
		setForm({
			enName: row.enName ?? "",
			frName: row.frName ?? "",
			arName: row.arName ?? "",
			slug: row.slug ?? "",
		});
		if (!isDesktop) setSheetOpen(true);
	}

	async function handleSave() {
		if (!canSave) return;
		setSaving(true);
		const payload = {
			enName: form.enName.trim(),
			frName: form.frName.trim(),
			arName: form.arName.trim(),
			slug: form.slug.trim() || undefined,
		};
		try {
			if (editItem) {
				await putApiSpecialities({ id: editItem.id, ...payload });
				toast.success("Speciality updated");
			} else {
				await postApiSpecialities(payload);
				toast.success("Speciality added");
			}
			setSheetOpen(false);
			resetForm();
			mutate();
		} catch {
			toast.error(
				editItem ? "Failed to update speciality" : "Failed to add speciality",
			);
		} finally {
			setSaving(false);
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
		{
			key: "enName",
			header: "Speciality",
			skeleton: <Skeleton className="h-4 w-36" />,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<div className="flex justify-center items-center bg-primary/10 rounded-lg size-9 text-primary shrink-0">
						<Stethoscope className="size-4" />
					</div>
					<div className="min-w-0">
						<div className="font-medium truncate">{row.enName ?? "—"}</div>
						{row.slug && (
							<div className="text-muted-foreground text-xs truncate">
								{row.slug}
							</div>
						)}
					</div>
				</div>
			),
		},
		{
			key: "frName",
			header: "French",
			skeleton: <Skeleton className="h-4 w-28" />,
			cell: (row) => row.frName ?? "—",
		},
		{
			key: "arName",
			header: "Arabic",
			skeleton: <Skeleton className="h-4 w-28" />,
			cell: (row) => (
				<span dir="rtl" className="inline-block">
					{row.arName ?? "—"}
				</span>
			),
		},
		{
			key: "actions",
			header: "",
			className: "text-right w-24",
			skeleton: (
				<div className="flex justify-end gap-1">
					<Skeleton className="size-8 rounded-md" />
					<Skeleton className="size-8 rounded-md" />
				</div>
			),
			cell: (row) => (
				<div className="flex justify-end gap-1">
					<Button
						variant="ghost"
						size="icon"
						title="Edit"
						onClick={() => openEdit(row)}
					>
						<Pencil className="size-4 text-muted-foreground" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						title="Delete"
						onClick={() => setDeleteItem(row)}
					>
						<Trash2 className="size-4 text-destructive/80 hover:text-destructive" />
					</Button>
				</div>
			),
		},
	];

	const renderForm = (prefix: string) => (
		<form
			className="flex flex-col flex-1 gap-4 px-4 lg:px-0"
			onSubmit={(e) => {
				e.preventDefault();
				handleSave();
			}}
		>
			<div className="space-y-1.5">
				<Label htmlFor={`${prefix}-sp-en`}>English name</Label>
				<Input
					id={`${prefix}-sp-en`}
					placeholder="e.g. Cardiology"
					value={form.enName}
					onChange={(e) => setField("enName", e.target.value)}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor={`${prefix}-sp-fr`}>French name</Label>
				<Input
					id={`${prefix}-sp-fr`}
					placeholder="e.g. Cardiologie"
					value={form.frName}
					onChange={(e) => setField("frName", e.target.value)}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor={`${prefix}-sp-ar`}>Arabic name</Label>
				<Input
					id={`${prefix}-sp-ar`}
					dir="rtl"
					placeholder="مثال: أمراض القلب"
					value={form.arName}
					onChange={(e) => setField("arName", e.target.value)}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor={`${prefix}-sp-slug`}>
					Slug <span className="text-muted-foreground">(optional)</span>
				</Label>
				<Input
					id={`${prefix}-sp-slug`}
					placeholder="e.g. cardiology"
					value={form.slug}
					onChange={(e) => setField("slug", e.target.value)}
				/>
			</div>
			<SheetFooter className="mt-auto px-0 lg:border-t-0">
				<Button type="submit" disabled={!canSave}>
					{saving ? "Saving…" : editItem ? "Save changes" : "Add speciality"}
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						setSheetOpen(false);
						resetForm();
					}}
				>
					{editItem ? "Cancel edit" : "Cancel"}
				</Button>
			</SheetFooter>
		</form>
	);

	const title = editItem ? "Edit speciality" : "Add speciality";
	const description = editItem
		? "Update the names shown to patients and on the phone."
		: "Add a speciality in all three languages.";

	return (
		<div className="items-start gap-6 lg:grid lg:grid-cols-[1fr_20rem]">
			<div className="space-y-4 min-w-0">
				<div className="flex sm:flex-row flex-col sm:items-center gap-3">
					<FilterSearch
						value={search}
						onChange={setSearch}
						placeholder="Search specialities…"
					/>
					<Badge variant="secondary" className="self-start sm:self-auto">
						{filtered.length}{" "}
						{filtered.length === 1 ? "speciality" : "specialities"}
					</Badge>
					<Button onClick={openAdd} className="h-10 sm:ml-auto lg:hidden">
						<Plus className="size-4" />
						Add speciality
					</Button>
				</div>

				{/* Small screens: add/edit sidebar as a sheet */}
				<Sheet open={sheetOpen && !isDesktop} onOpenChange={setSheetOpen}>
					<SheetContent side="right">
						<SheetHeader className="border-b">
							<SheetTitle>{title}</SheetTitle>
							<SheetDescription>{description}</SheetDescription>
						</SheetHeader>
						{renderForm("sheet")}
					</SheetContent>
				</Sheet>

				{/* Delete Dialog */}
				<Dialog
					open={!!deleteItem}
					onOpenChange={(v) => !v && setDeleteItem(null)}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								Delete speciality:{" "}
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
							disabled={!reassignTo}
							className="w-full"
						>
							Delete
						</Button>
					</DialogContent>
				</Dialog>

				<DataTable
					columns={columns}
					data={filtered}
					isLoading={isLoading}
					keyExtractor={(row) => String(row.id)}
					emptyMessage={
						<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
							<Inbox className="mb-4 w-12 h-12 opacity-50" />
							<span className="font-semibold text-foreground">
								{search ? "No matching specialities" : "No specialities yet"}
							</span>
							<span className="mt-1 mb-4 text-sm">
								{search
									? "Try a different search term"
									: "Add your first speciality to get started"}
							</span>
							{!search && (
								<Button size="sm" onClick={openAdd}>
									<Plus className="size-4" />
									Add speciality
								</Button>
							)}
						</div>
					}
				/>
			</div>

			{/* Desktop: permanent right sidebar */}
			<aside className="hidden lg:block top-4 sticky bg-card p-5 border rounded-xl">
				<div className="mb-5">
					<h2 className="font-semibold">{title}</h2>
					<p className="mt-1 text-muted-foreground text-sm">{description}</p>
				</div>
				{renderForm("aside")}
			</aside>
		</div>
	);
}
