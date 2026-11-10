import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, HTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "quiet";
type ActionStyle = { variant?: Variant; size?: "standard" | "large" };

export function ActionLink({ variant = "primary", size = "standard", className, ...props }: ComponentProps<typeof Link> & ActionStyle) {
  return <Link className={clsx("action", `action--${variant}`, size === "large" && "action--large", className)} {...props} />;
}

export function Button({ variant = "primary", size = "standard", className, ...props }: ComponentProps<"button"> & ActionStyle) {
  return <button type="button" className={clsx("action", `action--${variant}`, size === "large" && "action--large", className)} {...props} />;
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("panel", className)} {...props} />;
}

export function IndexLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={clsx("index-label", className)}><span aria-hidden="true" />{children}</p>;
}
