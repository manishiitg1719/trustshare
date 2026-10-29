// Role switcher: uses the shared switchUser action, so no client JS is needed.
import type { User } from "@prisma/client";
import { switchUser } from "@/lib/shared/session-actions";
import { Avatar, Icon, RolePill, ROLE_COLOR, roleLabel } from "@/components/ui";

export function RoleSwitcher({ users, currentUserId }: { users: User[]; currentUserId?: string }) {
  const current = users.find((u) => u.id === currentUserId);
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl border border-line bg-surface py-1.5 pl-1.5 pr-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Act as (switch persona)</span>
        {current ? <Avatar name={current.name} role={current.role} /> : <span className="avatar bg-ink-3"><Icon name="user" size={14} /></span>}
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold">{current?.name ?? "Signed out"}</span>
          <span className="flex items-center gap-1 text-[11px] text-ink-3">
            {current && <span className="dot" style={{ background: ROLE_COLOR[current.role] }} />}
            {current ? `${roleLabel(current.role)} · ${current.userType.charAt(0) + current.userType.slice(1).toLowerCase()}` : "Pick a persona"}
          </span>
        </span>
        <Icon name="chevron" size={14} strokeWidth={2} className="text-ink-2 transition group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-[380px] rounded-2xl border border-line bg-surface p-3 shadow-lg">
        <div className="label mb-2 px-1">Act as</div>
        <ul className="space-y-1">
          {users.map((u) => {
            const on = u.id === currentUserId;
            return (
              <li key={u.id}>
                <form action={switchUser}>
                  <input type="hidden" name="next" value="/start" />
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left font-normal ${on ? "border-brand-line bg-brand-soft" : "border-transparent hover:bg-surface-2"}`}
                    aria-current={on ? "true" : undefined}
                  >
                    <Avatar name={u.name} role={u.role} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        {u.name} <RolePill role={u.role} />
                      </span>
                      {u.persona && <span className="block truncate text-[11.5px] text-ink-2">{u.persona}</span>}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
          <li className="mt-1 border-t border-line pt-1">
            <form action={switchUser}>
              <input type="hidden" name="next" value="/start" />
              <input type="hidden" name="userId" value="" />
              <button className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2">Sign out</button>
            </form>
          </li>
        </ul>
      </div>
    </details>
  );
}
