"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createResource, updateResource, archiveResource } from "../actions";
import type { ResourceInput } from "../actions";
import { fileToDataUrl } from "@/lib/shared/images";

export type ResourceFormData = ResourceInput & { id?: string };

const DEFAULTS: ResourceInput = {
  name: "",
  type: "EQUIPMENT",
  description: "",
  location: "",
  photoUrl: "",
  managerId: "",
  riskLevel: "LOW",
  requiresSupervisor: false,
  externalAllowed: true,
  usageRules: "",
  maxHoursPerBooking: 4,
  monthlyHourQuota: 20,
  cooldownDays: 0,
  openHour: 9,
  closeHour: 18,
  openDays: [1, 2, 3, 4, 5],
  checklist: ["Powers on", "No visible damage"],
  credentialIds: [],
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const input = "mt-1 block w-full rounded border border-gray-400 px-3 py-2";
const label = "block text-sm font-medium text-gray-800";

export default function ResourceForm({
  initialData,
  credentials,
  managers,
  canPublish,
}: {
  initialData?: ResourceFormData;
  credentials: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = { ...DEFAULTS, ...initialData };
  const [photoUrl, setPhotoUrl] = useState(start.photoUrl);
  const [openDays, setOpenDays] = useState<number[]>(start.openDays);
  const [checklist, setChecklist] = useState<string[]>(start.checklist.length ? start.checklist : [""]);
  const [credentialIds, setCredentialIds] = useState<string[]>(start.credentialIds);

  const editingId = initialData?.id;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhotoUrl(await fileToDataUrl(file));
    } catch {
      setError("Could not read that photo. Try another image.");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "");
    const num = (k: string) => Number(fd.get(k));

    const data: ResourceInput = {
      name: text("name"),
      type: text("type"),
      description: text("description"),
      location: text("location"),
      photoUrl,
      managerId: text("managerId"),
      riskLevel: text("riskLevel"),
      requiresSupervisor: fd.get("requiresSupervisor") === "on",
      externalAllowed: fd.get("externalAllowed") === "on",
      usageRules: text("usageRules"),
      maxHoursPerBooking: num("maxHoursPerBooking"),
      monthlyHourQuota: num("monthlyHourQuota"),
      cooldownDays: num("cooldownDays"),
      openHour: num("openHour"),
      closeHour: num("closeHour"),
      openDays,
      checklist,
      credentialIds,
    };

    setLoading(true);
    setError(null);
    try {
      const result = editingId ? await updateResource(editingId, data) : await createResource(data);
      if (result.ok) {
        router.push("/owner/resources");
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (!editingId || !window.confirm("Archive this resource? It will disappear from search.")) return;
    const result = await archiveResource(editingId);
    if (result.ok) {
      router.push("/owner/resources");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 rounded border bg-white p-4 sm:p-6">
      {!canPublish && (
        <p role="alert" className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          Your owner account is waiting for admin verification. You cannot publish resources yet.
        </p>
      )}

      <div>
        <label htmlFor="name" className={label}>Name</label>
        <input id="name" name="name" defaultValue={start.name} required className={input} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className={label}>Type</label>
          <select id="type" name="type" defaultValue={start.type} className={input}>
            <option value="SPACE">Space</option>
            <option value="EQUIPMENT">Equipment</option>
            <option value="DEVICE">Device</option>
            <option value="TOOL">Tool</option>
          </select>
        </div>
        <div>
          <label htmlFor="riskLevel" className={label}>Risk level</label>
          <select id="riskLevel" name="riskLevel" defaultValue={start.riskLevel} className={input}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className={label}>Description</label>
        <textarea id="description" name="description" defaultValue={start.description} required rows={3} className={input} />
      </div>

      <div>
        <label htmlFor="location" className={label}>Location</label>
        <input id="location" name="location" defaultValue={start.location} required className={input} />
      </div>

      <div>
        <label htmlFor="photoFile" className={label}>Photo (upload)</label>
        <input id="photoFile" type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} className="mt-1 block w-full" />
        <label htmlFor="photoUrl" className={`${label} mt-3`}>Or paste a photo URL</label>
        <input
          id="photoUrl"
          type="url"
          value={photoUrl.startsWith("data:") ? "" : photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://..."
          className={input}
        />
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Resource preview" className="mt-2 h-32 rounded object-cover" />
        )}
      </div>

      <div>
        <label htmlFor="managerId" className={label}>Manager</label>
        <select id="managerId" name="managerId" defaultValue={start.managerId} className={input}>
          <option value="">No specific manager (all managers can review)</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requiresSupervisor" defaultChecked={start.requiresSupervisor} /> Requires a supervisor
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="externalAllowed" defaultChecked={start.externalAllowed} /> Open to external users (startups)
        </label>
      </div>

      <div>
        <label htmlFor="usageRules" className={label}>Usage rules</label>
        <textarea id="usageRules" name="usageRules" defaultValue={start.usageRules} rows={3} className={input} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="maxHoursPerBooking" className={label}>Max hours per booking</label>
          <input id="maxHoursPerBooking" type="number" min={1} name="maxHoursPerBooking" defaultValue={start.maxHoursPerBooking} required className={input} />
        </div>
        <div>
          <label htmlFor="monthlyHourQuota" className={label}>Monthly hour quota</label>
          <input id="monthlyHourQuota" type="number" min={1} name="monthlyHourQuota" defaultValue={start.monthlyHourQuota} required className={input} />
        </div>
        <div>
          <label htmlFor="cooldownDays" className={label}>Cooldown (days)</label>
          <input id="cooldownDays" type="number" min={0} name="cooldownDays" defaultValue={start.cooldownDays} required className={input} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="openHour" className={label}>Opens at (hour, 0-23)</label>
          <input id="openHour" type="number" min={0} max={23} name="openHour" defaultValue={start.openHour} required className={input} />
        </div>
        <div>
          <label htmlFor="closeHour" className={label}>Closes at (hour, 1-24)</label>
          <input id="closeHour" type="number" min={1} max={24} name="closeHour" defaultValue={start.closeHour} required className={input} />
        </div>
      </div>

      <fieldset>
        <legend className={label}>Open days</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={openDays.includes(i)} onChange={() => setOpenDays(toggle(openDays, i))} /> {d}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Condition checklist (checked at check-in and return)</legend>
        <ul className="mt-1 space-y-2">
          {checklist.map((item, i) => (
            <li key={i} className="flex gap-2">
              <label htmlFor={`check-${i}`} className="sr-only">Checklist item {i + 1}</label>
              <input
                id={`check-${i}`}
                value={item}
                onChange={(e) => setChecklist(checklist.map((c, j) => (j === i ? e.target.value : c)))}
                className="block w-full rounded border border-gray-400 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}
                className="rounded border border-gray-400 px-3 text-sm hover:bg-gray-100"
                aria-label={`Remove checklist item ${i + 1}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setChecklist([...checklist, ""])} className="mt-2 text-sm text-blue-700 underline">
          + Add item
        </button>
      </fieldset>

      <fieldset>
        <legend className={label}>Required credentials</legend>
        <div className="mt-1 space-y-1">
          {credentials.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={credentialIds.includes(c.id)} onChange={() => setCredentialIds(toggle(credentialIds, c.id))} /> {c.name}
            </label>
          ))}
          {credentials.length === 0 && <p className="text-sm text-gray-600">No credentials exist yet.</p>}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t pt-4">
        <button
          type="submit"
          disabled={loading || !canPublish}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : editingId ? "Save changes" : "Publish resource"}
        </button>
        {editingId && (
          <button type="button" onClick={handleArchive} className="rounded border border-red-700 px-4 py-2 text-red-700 hover:bg-red-50">
            Archive
          </button>
        )}
      </div>
    </form>
  );
}
