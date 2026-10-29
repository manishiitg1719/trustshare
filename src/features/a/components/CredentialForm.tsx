"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestCredential } from "../actions";
import { fileToDataUrl } from "@/lib/shared/images";

type CredentialOption = { id: string; name: string };

export default function CredentialForm({ credentials, defaultSelected }: { credentials: CredentialOption[]; defaultSelected?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const credentialId = String(formData.get("credentialId") ?? "");
    const file = formData.get("evidenceFile");
    const link = String(formData.get("evidenceLink") ?? "").trim();

    setLoading(true);
    setMessage(null);
    try {
      let evidence = link;
      if (file instanceof File && file.size > 0) evidence = await fileToDataUrl(file);
      const result = await requestCredential(credentialId, evidence);
      if (result.ok) {
        setMessage({ kind: "ok", text: "Submitted. A manager will review it and you will get a notification." });
        form.reset();
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const known = credentials.some((c) => c.id === defaultSelected);

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label htmlFor="credentialId" className="block text-sm font-medium">
          Credential
        </label>
        <select
          id="credentialId"
          name="credentialId"
          defaultValue={known ? defaultSelected : credentials[0]?.id}
          className="mt-1 block w-full rounded border border-gray-400 p-2"
        >
          {credentials.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="evidenceFile" className="block text-sm font-medium">
          Evidence: photo of your certificate
        </label>
        <input id="evidenceFile" type="file" name="evidenceFile" accept="image/*" className="mt-1 block w-full" />
      </div>
      <div>
        <label htmlFor="evidenceLink" className="block text-sm font-medium">
          Or a link to your certificate
        </label>
        <input
          id="evidenceLink"
          type="url"
          name="evidenceLink"
          placeholder="https://..."
          className="mt-1 block w-full rounded border border-gray-400 p-2"
        />
      </div>
      {message && (
        <p role="status" className={message.kind === "ok" ? "text-sm text-green-800" : "text-sm text-red-700"}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={loading} className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50">
        {loading ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
