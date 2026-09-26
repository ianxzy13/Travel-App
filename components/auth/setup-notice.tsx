/** Shown instead of the login form until the Supabase keys are configured. */
export function SetupNotice() {
  return (
    <div
      role="status"
      className="border-warning/40 bg-warning/10 space-y-2 rounded-lg border p-4 text-sm"
    >
      <p className="font-medium">Almost there: Supabase isn&apos;t connected yet.</p>
      <p className="text-muted-foreground">
        Create a <code>.env.local</code> file with your Supabase URL and publishable key (see{" "}
        <code>.env.example</code> and the README), then restart <code>npm run dev</code>.
      </p>
    </div>
  );
}
