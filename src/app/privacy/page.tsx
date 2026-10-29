export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded border bg-white p-6">
      <h1 className="text-2xl font-bold">Privacy</h1>
      <ul className="list-disc space-y-3 pl-5 text-gray-800">
        <li>
          <strong>What we store:</strong> your name, email, role, credentials and the evidence you upload for them, your bookings, condition
          reports, incidents, penalties, notifications, and a permanent audit history of decisions.
        </li>
        <li>
          <strong>Who can see it:</strong> users see their own bookings. Owners and managers see bookings of the resources they look after.
          Admins see everything.
        </li>
        <li>
          <strong>Photos:</strong> photos are only visible to the user of the booking and to staff.
        </li>
        <li>
          <strong>Demo data:</strong> this is a demo. All people, resources and emails are fictional, and no email is actually sent.
        </li>
        <li>
          <strong>AI:</strong> AI suggestions never decide anything. A person always makes the final call on reviews, incidents and penalties.
        </li>
      </ul>
    </div>
  );
}
