"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Today, the wall and Projects are one screen now.
 *
 * These routes stay so that a bookmark, a home-screen shortcut, or a page the
 * service worker cached before the merge still arrives somewhere real instead
 * of at a 404.
 */
export function Moved() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <p className="label p-8 text-mute">
      That is all on one screen now. Taking you there…
    </p>
  );
}
