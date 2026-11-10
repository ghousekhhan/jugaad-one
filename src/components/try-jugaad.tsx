"use client";

import { playSound } from "@/lib/sound/engine";

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
      void playSound("voice.ready");
      return true;
    }, () => false);
  }}>{children}</Link>;
}
