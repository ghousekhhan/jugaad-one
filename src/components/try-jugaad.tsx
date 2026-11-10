"use client";

import Link from "next/link";
import type { ReactNode } from "react";

let entryPermission: Promise<boolean> | undefined;

export function takeEntryPermission() {
  const request = entryPermission;
  entryPermission = undefined;
  return request;
}

export function TryJugaad({ children, className }: { children: ReactNode; className: string }) {
  return <Link className={className} href="/workspace" onNavigate={() => {
    entryPermission = navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
      return true;
    }, () => false);
  }}>{children}</Link>;
}
