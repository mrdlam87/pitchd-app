import { signOut } from "@/auth";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5f0]">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm px-4">
        <h1 className="font-[family-name:var(--font-lora)] text-4xl text-[#2d4a2d]">
          Pitchd
        </h1>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-[#2d4a2d]">
            You&apos;re on the waitlist
          </h2>
          <p className="text-[#5a7a5a] text-sm leading-relaxed">
            Pitchd is currently in closed beta. We&apos;ll send you an invite
            when a spot opens up.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-[#5a7a5a] underline underline-offset-2 hover:text-[#2d4a2d] transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
